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
  const mode = env.BILLING_MODE || 'test';
  const configured = mode === 'test' && String(env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_') && Boolean(env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET);
  return { mode, checkoutEnabled: configured, reason: configured ? '' : mode !== 'test' ? 'Live payments are not enabled in this release.' : 'Razorpay test checkout is awaiting server credentials and webhook configuration.' };
}
async function provider(env, path, options = {}, fetcher = fetch) {
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
const publicOrder = order => ({ id: order.id, plan_id: order.plan_id, amount: order.amount, currency: order.currency, mode: order.mode, provider_order_id: order.provider_order_id, status: order.status, created_at: order.created_at, activated_at: order.activated_at });

export async function activatePayment(db, order, payment) {
  if (payment.order_id !== order.provider_order_id || payment.amount !== order.amount || payment.currency !== order.currency || typeof payment.id !== 'string' || !/^pay_[a-zA-Z0-9]+$/.test(payment.id)) fail('Payment does not match this purchase.', 403);
  if (payment.status !== 'captured' || payment.captured !== true || Number(payment.amount_refunded || 0) !== 0) fail('Payment has not been captured. Refresh its status shortly.', 409);
  const now = new Date().toISOString();
  const plan = JSON.parse(order.plan_snapshot);
  const current = await stmt(db, 'SELECT * FROM company_subscriptions WHERE company_id=? AND mode=?', [order.company_id,order.mode]).first();
  const base = current?.plan_id === order.plan_id && current.ends_at > now ? current.ends_at : now;
  const end = nextMonth(base);
  const guard = "EXISTS(SELECT 1 FROM billing_orders WHERE id=? AND status='pending')";
  await db.batch([
    stmt(db, `INSERT INTO company_subscriptions(company_id,mode,id,plan_id,employee_limit,dashboard_limit,starts_at,ends_at,last_order_id) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT(company_id,mode) DO UPDATE SET plan_id=excluded.plan_id,employee_limit=excluded.employee_limit,dashboard_limit=excluded.dashboard_limit,starts_at=excluded.starts_at,ends_at=excluded.ends_at,last_order_id=excluded.last_order_id`, [order.company_id,order.mode,current?.id || crypto.randomUUID(),order.plan_id,plan.employee_limit,plan.dashboard_limit,current?.plan_id===order.plan_id && current.ends_at>now ? current.starts_at : now,end,order.id,order.id]),
    stmt(db, `INSERT INTO subscription_audit(id,company_id,order_id,action,created_at) SELECT ?,?,?,?,? WHERE ${guard}`, [crypto.randomUUID(),order.company_id,order.id,order.mode==='test'?'test_subscription_activated':'subscription_activated',now,order.id]),
    stmt(db, "UPDATE billing_orders SET status='activated',provider_payment_id=?,activated_at=? WHERE id=? AND status='pending'", [payment.id,now,order.id])
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
  return activatePayment(db,order,captured);
}

export async function billingHandle({ db, env, actor, path, method, body = {}, fetcher = fetch }) {
  if (actor.role !== 'company_admin') fail('Only the company Super Admin can manage billing.',403);
  const section = path.slice('/api/v1/billing/'.length);
  const config = paymentConfiguration(env);
  if (section==='overview' && method==='GET') return {
    ...config, plans: await all(db,'SELECT * FROM billing_plans WHERE enabled=1 ORDER BY sort_order'),
    usage: await billingUsage(db,actor.company_id), capacity: await liveCapacity(db,actor.company_id),
    subscription: await stmt(db,'SELECT * FROM company_subscriptions WHERE company_id=? AND mode=?',[actor.company_id,config.mode]).first(),
    orders: (await all(db,'SELECT * FROM billing_orders WHERE company_id=? AND mode=? ORDER BY created_at DESC LIMIT 20',[actor.company_id,config.mode])).map(publicOrder)
  };
  if (section==='orders' && method==='POST') {
    if (!config.checkoutEnabled) fail(config.reason,503);
    const plan = await stmt(db,'SELECT * FROM billing_plans WHERE id=? AND enabled=1',[body.plan_id || '']).first();
    if (!plan || !plan.amount || !plan.employee_limit || !plan.dashboard_limit) fail('This plan requires a custom quote.');
    const usage = await billingUsage(db,actor.company_id);
    if (usage.employees>plan.employee_limit || usage.dashboard_users>plan.dashboard_limit) fail('Your current team exceeds this plan. Choose a larger plan or reduce active users first.',409);
    let order = await stmt(db,"SELECT * FROM billing_orders WHERE company_id=? AND mode=? AND status IN ('creating','pending')",[actor.company_id,config.mode]).first();
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
    return activatePayment(db,order,payment);
  }
  fail('Billing route not found.',404);
}

export async function billingWebhook(request, env, db, fetcher = fetch) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) fail('Webhook is not configured.',503);
  const raw = await request.text();
  if (encoder.encode(raw).length>262144) fail('Webhook is too large.',413);
  if (!await validSignature(env.RAZORPAY_WEBHOOK_SECRET,raw,request.headers.get('x-razorpay-signature'))) fail('Invalid webhook signature.',403);
  let event; try { event=JSON.parse(raw); } catch { fail('Invalid webhook payload.'); }
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
