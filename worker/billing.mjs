import { workspacePolicy, changeWorkspacePlan, togglePlanTest } from './planPolicy.mjs';
import { recurringHandle, recurringOverview, recurringWebhook, openRecurring, renewalWindowOpen, retireEarlyRenewal } from './billingRecurring.mjs';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const stmt = (db, sql, values = []) => db.prepare(sql).bind(...values);
const all = async (db, sql, values = []) => (await stmt(db, sql, values).all()).results;
const encoder = new TextEncoder();
export async function signature(secret, message) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))].map(b => b.toString(16).padStart(2,'0')).join('');
}
export async function validSignature(secret, message, supplied) {
  if (!secret || typeof supplied !== 'string' || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = await signature(secret, message);
  let diff = 0;
  for (let i=0;i<64;i++) diff |= expected.charCodeAt(i) ^ supplied.toLowerCase().charCodeAt(i);
  return diff === 0;
}
export function paymentConfiguration(env) {
  const mode = env.BILLING_MODE || 'live';
  const configured = ['live','test'].includes(mode) && String(env.RAZORPAY_KEY_ID || '').startsWith(`rzp_${mode}_`) && Boolean(env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET);
  return { mode, checkoutEnabled: configured, reason: configured ? '' : 'Payment checkout is unavailable. Contact your platform administrator.' };
}
export async function provider(env, path, options = {}, fetcher = fetch) {
  if (!paymentConfiguration(env).checkoutEnabled) fail(paymentConfiguration(env).reason, 503);
  let response;
  try { response = await fetcher('https://api.razorpay.com/v1/' + path, { ...options, headers: { Authorization: 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`), 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) }); }
  catch { fail('Payment service could not be reached. Refresh payment status before trying again.', 503); }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) fail('Payment service could not complete the request. Please retry.', 503);
  return result;
}
export async function billingUsage(db, company) {
  return stmt(db, "SELECT COALESCE(SUM(CASE WHEN e.status!='Inactive' THEN 1 ELSE 0 END),0) AS employees, COALESCE(SUM(e.dashboard_access),0) AS dashboard_users FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND u.role='employee'", [company]).first();
}
export async function liveCapacity(db, company) {
  const sub = await stmt(db, "SELECT * FROM company_subscriptions WHERE company_id=? AND mode='live'", [company]).first();
  return { dashboard_limit: sub?.dashboard_limit ?? 3, employee_limit: sub?.employee_limit ?? null, expired: Boolean(sub && sub.ends_at <= new Date().toISOString()), legacy: !sub };
}
export function nextMonth(iso) {
  const d = new Date(iso), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+1);
  const last = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,last)); return d.toISOString();
}
const publicOrder = order => ({ source: JSON.parse(order.plan_snapshot).activation_source || 'payment', id: order.id, plan_id: order.plan_id, amount: JSON.parse(order.plan_snapshot).activation_source === 'complimentary' ? 0 : order.amount, currency: order.currency, mode: order.mode, provider_order_id: order.provider_order_id, status: order.status, created_at: order.created_at, activated_at: order.activated_at });

export async function activatePayment(db, order, payment, env, fetcher=fetch) {
  if (payment.order_id !== order.provider_order_id || payment.amount !== order.amount || payment.currency !== order.currency || typeof payment.id !== 'string' || !/^pay_[a-zA-Z0-9]+$/.test(payment.id)) fail('Payment does not match this purchase.', 403);
  if (payment.status !== 'captured' || payment.captured !== true || Number(payment.amount_refunded || 0) !== 0) fail('Payment has not been captured. Refresh its status shortly.', 409);
  const saved=await stmt(db,'SELECT status,plan_snapshot FROM billing_orders WHERE id=?',[order.id]).first();
  if(saved?.status==='activated')return {order:publicOrder(await stmt(db,'SELECT * FROM billing_orders WHERE id=?',[order.id]).first()),subscription:await stmt(db,'SELECT * FROM company_subscriptions WHERE company_id=? AND mode=?',[order.company_id,order.mode]).first()};
  if(!saved || !(saved.status==='pending' || saved.status==='failed' && ['price_changed','renewal_policy_changed'].includes(JSON.parse(saved.plan_snapshot).replacement_reason)))fail('This payment requires support reconciliation before activation.',409);
  const recurring=await openRecurring(db,order.company_id,order.mode);
  if(recurring) {
    if(!env)fail('Auto-renewal must be cancelled before this manual payment can be applied.',409);
    // A late capture from an old checkout must not overlap a newly approved mandate.
    await recurringHandle({db,env,actor:{company_id:order.company_id},section:'recurring/cancel',body:{recurring_id:recurring.id},fetcher});
  }
  const now = new Date().toISOString();
  const plan = JSON.parse(order.plan_snapshot);
  const current = await stmt(db, 'SELECT * FROM company_subscriptions WHERE company_id=? AND mode=?', [order.company_id,order.mode]).first();
  const base = current?.plan_id === order.plan_id && current.ends_at > now ? current.ends_at : now;
  const end = nextMonth(base);
  const startsAt = current?.plan_id === order.plan_id && current.ends_at > now ? current.starts_at : now;
  const payable = "(status='pending' OR (status='failed' AND json_extract(plan_snapshot,'$.replacement_reason') IN ('price_changed','renewal_policy_changed')))";
  const guard = `EXISTS(SELECT 1 FROM billing_orders WHERE id=? AND ${payable})`;
  await db.batch([
    stmt(db, `INSERT INTO company_subscriptions(company_id,mode,id,plan_id,employee_limit,dashboard_limit,starts_at,ends_at,last_order_id) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT(company_id,mode) DO UPDATE SET plan_id=excluded.plan_id,employee_limit=excluded.employee_limit,dashboard_limit=excluded.dashboard_limit,starts_at=excluded.starts_at,ends_at=excluded.ends_at,last_order_id=excluded.last_order_id`, [order.company_id,order.mode,current?.id || crypto.randomUUID(),order.plan_id,plan.employee_limit,plan.dashboard_limit,startsAt,end,order.id,order.id]),
    stmt(db, `INSERT INTO subscription_audit(id,company_id,order_id,action,created_at) SELECT ?,?,?,?,? WHERE ${guard}`, [crypto.randomUUID(),order.company_id,order.id,order.mode==='test'?'test_subscription_activated':'subscription_activated',now,order.id]),
    stmt(db, `UPDATE billing_orders SET status='activated',provider_payment_id=?,activated_at=?,plan_snapshot=json_set(plan_snapshot,'$.term_starts_at',?,'$.term_ends_at',?) WHERE id=? AND ${payable}`, [payment.id,now,base,end,order.id])
  ]);
  return { order: publicOrder(await stmt(db,'SELECT * FROM billing_orders WHERE id=?',[order.id]).first()), subscription: await stmt(db,'SELECT * FROM company_subscriptions WHERE company_id=? AND mode=?',[order.company_id,order.mode]).first() };
}

export async function reconcileOrder(db, env, order, fetcher = fetch) {
  if (order.status === 'activated') return { order: publicOrder(order) };
  if (!order.provider_order_id) return { order: publicOrder(order), pending: true };
  if (order.key_id !== env.RAZORPAY_KEY_ID || order.mode !== paymentConfiguration(env).mode) fail('This purchase belongs to a different payment configuration. Contact support.',409);
  const payments = await provider(env, `orders/${encodeURIComponent(order.provider_order_id)}/payments`, {}, fetcher);
  const captured = payments.items?.find(p => p.status === 'captured');
  if (!captured) return { order: publicOrder(order), pending: true };
  return activatePayment(db,order,captured,env,fetcher);
}

export async function billingHandle({ db, env, actor, path, method, body = {}, fetcher = fetch }) {
  if (actor.role !== 'company_admin') fail('Only the company Super Admin can manage billing.',403);
  const section = path.slice('/api/v1/billing/'.length);
  const config = paymentConfiguration(env);
  if (section==='test-mode' && method==='POST') return togglePlanTest(db,actor,body);
  if (section==='change-plan' && method==='POST') {
    // Resolve an abandoned checkout before a live downgrade, never discard an authorized payment.
    const policy=await workspacePolicy(db,actor.company_id);
    const target=await stmt(db,'SELECT sort_order FROM billing_plans WHERE id=? AND enabled=1',[body.plan_id || '']).first();
    const active=await stmt(db,'SELECT sort_order FROM billing_plans WHERE id=?',[policy.live?.plan_id || '']).first();
    if(body.simulation!==true && !policy.testEnabled && body.revision===policy.revision && target?.sort_order<active?.sort_order && body.accepted===true && body.confirmed===true){
      const pending=await stmt(db,"SELECT * FROM billing_orders WHERE company_id=? AND mode='live' AND status IN ('creating','pending')",[actor.company_id]).first();
      if(pending){
        if(!pending.provider_order_id || pending.key_id!==env.RAZORPAY_KEY_ID)fail('An unfinished checkout needs payment reconciliation.',409);
        const payments=await provider(env,`orders/${encodeURIComponent(pending.provider_order_id)}/payments`,{},fetcher);
        if(!Array.isArray(payments.items) || payments.items.some(p=>p.status!=='failed'))fail('Check your unfinished payment before downgrading.',409);
        await stmt(db,"UPDATE billing_orders SET status='failed',plan_snapshot=json_set(plan_snapshot,'$.replacement_reason','plan_changed') WHERE id=? AND status='pending'",[pending.id]).run();
      }
    }
    return changeWorkspacePlan({db,actor,body,simulation:body.simulation===true});
  }
  if (section.startsWith('recurring/') && method==='POST') return recurringHandle({db,env,actor,section,body,fetcher});
  if (section.startsWith('purchases/') && method === 'GET') {
    const id = section.slice('purchases/'.length);
    const order = await stmt(db,'SELECT * FROM billing_orders WHERE id=? AND company_id=? AND mode=?',[id,actor.company_id,config.mode]).first();
    if (!order) fail('Purchase not found.',404);
    const snapshot = JSON.parse(order.plan_snapshot);
    const company = await stmt(db,'SELECT name FROM companies WHERE company_id=?',[actor.company_id]).first();
    const term = await stmt(db,'SELECT starts_at,ends_at FROM company_subscriptions WHERE company_id=? AND mode=? AND last_order_id=?',[actor.company_id,config.mode,order.id]).first();
    let payment = null, paymentUnavailable = false;
    if (order.provider_payment_id) {
      try {
        if (order.key_id !== env.RAZORPAY_KEY_ID) throw new Error('Payment key changed.');
        const verified = await provider(env,'payments/'+encodeURIComponent(order.provider_payment_id),{},fetcher);
        if (verified.id !== order.provider_payment_id || verified.order_id !== order.provider_order_id || verified.amount !== order.amount || verified.currency !== order.currency) throw new Error('Payment mismatch.');
        payment = { id: verified.id, status: verified.status, method: verified.method || null, bank: verified.bank || null, wallet: verified.wallet || null, email: verified.email || null, contact: verified.contact || null, amount_refunded: Number(verified.amount_refunded || 0), refund_status: verified.refund_status || null, created_at: verified.created_at ? new Date(verified.created_at * 1000).toISOString() : null, bank_reference: verified.acquirer_data?.rrn || verified.acquirer_data?.bank_transaction_id || verified.acquirer_data?.auth_code || null };
      } catch { paymentUnavailable = true; }
    }
    return { ...publicOrder(order), company_id: actor.company_id, company_name: company?.name || '', plan_name: snapshot.name, employee_limit: snapshot.employee_limit, dashboard_limit: snapshot.dashboard_limit, provider_payment_id: order.provider_payment_id, term_starts_at: snapshot.term_starts_at || term?.starts_at || null, term_ends_at: snapshot.term_ends_at || term?.ends_at || null, payment, payment_unavailable: paymentUnavailable, receipt_available: order.status === 'activated' && Boolean(order.provider_payment_id) && snapshot.activation_source !== 'complimentary' };
  }
  if (section==='overview' && method==='GET') return {
    ...config, policy: await workspacePolicy(db,actor.company_id), plans: await all(db,'SELECT * FROM billing_plans WHERE enabled=1 ORDER BY sort_order'),
    usage: await billingUsage(db,actor.company_id), capacity: await liveCapacity(db,actor.company_id),
    subscription: await stmt(db,'SELECT * FROM company_subscriptions WHERE company_id=? AND mode=?',[actor.company_id,config.mode]).first(),
    recurring: await recurringOverview(db,actor.company_id,config.mode),
    liveSubscription: await stmt(db,"SELECT s.*, CASE WHEN json_extract(o.plan_snapshot,'$.activation_source')='complimentary' THEN 'complimentary' ELSE 'payment' END AS source FROM company_subscriptions s JOIN billing_orders o ON o.id=s.last_order_id WHERE s.company_id=? AND s.mode='live'",[actor.company_id]).first(),
    orders: (await all(db,'SELECT * FROM billing_orders WHERE company_id=? AND mode=? ORDER BY created_at DESC LIMIT 20',[actor.company_id,config.mode])).map(publicOrder)
  };
  if (section==='orders' && method==='POST') {
    if(body.accepted!==true || body.confirmed!==true)fail('Accept the plan terms and confirm the purchase.',400);
    if ((await workspacePolicy(db,actor.company_id)).testEnabled) fail('Turn off test mode before starting a payment.',409);
    if (!config.checkoutEnabled) fail(config.reason,503);
    const plan = await stmt(db,'SELECT * FROM billing_plans WHERE id=? AND enabled=1',[body.plan_id || '']).first();
    if (!plan || !plan.amount || !plan.employee_limit || !plan.dashboard_limit) fail('This plan requires a custom quote.');
    if (await openRecurring(db,actor.company_id,config.mode)) fail('Turn off auto-renewal before making a manual purchase or changing plans.',409);
    const subscription = await stmt(db,'SELECT * FROM company_subscriptions WHERE company_id=? AND mode=?',[actor.company_id,config.mode]).first();
    if (subscription?.plan_id===plan.id && !renewalWindowOpen(subscription)) fail('Manual renewal opens 7 days before your plan expires.',409);
    if (subscription && subscription.ends_at>new Date().toISOString()) { const active=await stmt(db,'SELECT sort_order FROM billing_plans WHERE id=?',[subscription.plan_id]).first(); if(plan.sort_order<active?.sort_order) fail('Use the free downgrade option for a lower plan.',409); }
    const usage = await billingUsage(db,actor.company_id);
    if (usage.employees>plan.employee_limit || usage.dashboard_users>plan.dashboard_limit) fail('Your current team exceeds this plan. Choose a larger plan or reduce active users first.',409);
    let order = await stmt(db,"SELECT * FROM billing_orders WHERE company_id=? AND mode=? AND status IN ('creating','pending')",[actor.company_id,config.mode]).first();
    if(order && await retireEarlyRenewal(db,env,order,subscription,fetcher))order=null;
    if (order && order.amount !== (await stmt(db,'SELECT amount FROM billing_plans WHERE id=?',[order.plan_id]).first())?.amount) {
      if (!order.provider_order_id || order.key_id !== env.RAZORPAY_KEY_ID) fail('An earlier checkout needs support reconciliation before starting a new one.',409);
      const payments = await provider(env,`orders/${encodeURIComponent(order.provider_order_id)}/payments`,{},fetcher);
      if (!Array.isArray(payments.items) || payments.items.some(payment => payment.status !== 'failed')) fail('An earlier payment needs reconciliation. Check payment before starting another purchase.',409);
      // Keep the original provider ID and amount so a late capture remains recoverable.
      await stmt(db,"UPDATE billing_orders SET status='failed',plan_snapshot=json_set(plan_snapshot,'$.replacement_reason','price_changed') WHERE id=? AND status='pending'",[order.id]).run();
      order = null;
    }
    if (order && order.plan_id!==plan.id) fail('An unfinished purchase exists for another plan. Complete it or contact support before changing plans.',409);
    if (!order) {
      const id = crypto.randomUUID();
      try { await stmt(db,"INSERT INTO billing_orders(id,company_id,plan_id,plan_snapshot,amount,currency,mode,status,created_at,created_by,key_id) VALUES(?,?,?,?,?,?,?,'creating',?,?,?)",[id,actor.company_id,plan.id,JSON.stringify(plan),plan.amount,plan.currency,config.mode,new Date().toISOString(),actor.user_id,env.RAZORPAY_KEY_ID]).run(); }
      catch { fail('Another checkout is starting. Refresh before trying again.',409); }
      let created;
      try { created = await provider(env,'orders',{ method:'POST',body:JSON.stringify({amount:plan.amount,currency:plan.currency,receipt:id,partial_payment:false,notes:{purchase_id:id}}) },fetcher); }
      catch (error) {
        // No provider order is exposed to a customer on this path; it cannot be paid from this app.
        await stmt(db,"UPDATE billing_orders SET status='failed' WHERE id=? AND status='creating'",[id]).run(); throw error;
      }
      if (!/^order_[a-zA-Z0-9]+$/.test(created.id || '') || created.amount!==plan.amount || created.currency!==plan.currency) fail('Unexpected payment order response. Contact support.',503);
      await stmt(db,"UPDATE billing_orders SET provider_order_id=?,status='pending' WHERE id=? AND status='creating'",[created.id,id]).run();
      order = await stmt(db,'SELECT * FROM billing_orders WHERE id=?',[id]).first();
    }
    if (!order.provider_order_id) fail('Checkout is being prepared. Refresh shortly; contact support if it remains pending.',409);
    if (order.key_id!==env.RAZORPAY_KEY_ID) fail('The payment key changed. Contact support about this pending purchase.',409);
    return { ...publicOrder(order), key_id:env.RAZORPAY_KEY_ID, plan_name:JSON.parse(order.plan_snapshot).name };
  }
  if ((section==='verify' || section==='reconcile') && method==='POST') {
    const order = await stmt(db,'SELECT * FROM billing_orders WHERE id=? AND company_id=? AND mode=?',[body.purchase_id || '',actor.company_id,config.mode]).first();
    if (!order) fail('Purchase not found.',404);
    if (section==='reconcile') return reconcileOrder(db,env,order,fetcher);
    if (order.key_id!==env.RAZORPAY_KEY_ID || body.razorpay_order_id!==order.provider_order_id || !/^pay_[a-zA-Z0-9]+$/.test(body.razorpay_payment_id || '') || !await validSignature(env.RAZORPAY_KEY_SECRET,`${order.provider_order_id}|${body.razorpay_payment_id}`,body.razorpay_signature)) fail('Payment signature could not be verified.',403);
    const payment = await provider(env,'payments/'+encodeURIComponent(body.razorpay_payment_id),{},fetcher);
    return activatePayment(db,order,payment,env,fetcher);
  }
  fail('Billing route not found.',404);
}

export async function billingWebhook(request, env, db, fetcher = fetch) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) fail('Webhook is not configured.',503);
  const raw = await request.text();
  if (encoder.encode(raw).length>262144) fail('Webhook is too large.',413);
  if (!await validSignature(env.RAZORPAY_WEBHOOK_SECRET,raw,request.headers.get('x-razorpay-signature'))) fail('Invalid webhook signature.',403);
  let event; try { event=JSON.parse(raw); } catch { fail('Invalid webhook payload.'); }
  if (String(event.event).startsWith('subscription.')) return recurringWebhook(db,env,event,request.headers.get('x-razorpay-event-id') || await signature(env.RAZORPAY_WEBHOOK_SECRET,raw),fetcher);
  if (!['payment.captured','order.paid'].includes(event.event)) return {ignored:true};
  const providerId = event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id;
  const order = await stmt(db,'SELECT * FROM billing_orders WHERE provider_order_id=? AND mode=?',[providerId || '',paymentConfiguration(env).mode]).first();
  if (!order) return {ignored:true};
  const result = await reconcileOrder(db,env,order,fetcher);
  if (result.pending) fail('Payment capture is not yet available. Retry webhook delivery.',503);
  const id = request.headers.get('x-razorpay-event-id') || await signature(env.RAZORPAY_WEBHOOK_SECRET,raw);
  await stmt(db,'INSERT OR IGNORE INTO billing_events(event_id,order_id,event_type,received_at) VALUES(?,?,?,?)',[id,order.id,event.event,new Date().toISOString()]).run();
  return {received:true};
}
