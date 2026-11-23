import { workspacePolicy } from './planPolicy.mjs';
import { provider, paymentConfiguration, validSignature } from './billing.mjs';

const fail = (message,status=409) => { throw Object.assign(new Error(message),{status}); };
const statement = (db,sql,values=[]) => db.prepare(sql).bind(...values);
const terminal = ['cancelled','completed','expired','failed'];
const states = ['created','authenticated','active','pending','halted','paused','cancelled','completed','expired'];
const iso = seconds => Number.isFinite(seconds) && seconds>0 ? new Date(seconds*1000).toISOString() : null;
export const renewalWindowOpen = subscription => Boolean(subscription && Date.parse(subscription.ends_at)-Date.now()<=7*86400000);
export const recurringOpen = row => Boolean(row && !terminal.includes(row.status));

export function publicRecurring(row) {
  if (!row) return null;
  const plan=JSON.parse(row.plan_snapshot);
  return { id:row.id,plan_id:row.plan_id,plan_name:plan.name,amount:plan.amount,currency:plan.currency,status:row.status,enabled:['authenticated','active'].includes(row.status),starts_at:row.starts_at,next_charge_at:row.charge_at,provider_subscription_id:row.provider_subscription_id,authorized_at:row.authorized_at,last_synced_at:row.last_synced_at,total_cycles:12 };
}
export async function recurringOverview(db,company,mode) {
  return publicRecurring(await statement(db,'SELECT * FROM billing_recurring WHERE company_id=? AND mode=? ORDER BY created_at DESC LIMIT 1',[company,mode]).first());
}
export async function openRecurring(db,company,mode) {
  return statement(db,"SELECT * FROM billing_recurring WHERE company_id=? AND mode=? AND status NOT IN ('cancelled','completed','expired','failed')",[company,mode]).first();
}

export async function retireEarlyRenewal(db,env,order,subscription,fetcher=fetch) {
  if(!order || order.status!=='pending' || order.plan_id!==subscription?.plan_id || renewalWindowOpen(subscription) || !order.provider_order_id || order.key_id!==env.RAZORPAY_KEY_ID)return false;
  const payments=await provider(env,`orders/${encodeURIComponent(order.provider_order_id)}/payments`,{},fetcher);
  if(!Array.isArray(payments.items) || payments.items.some(payment=>payment.status!=='failed'))fail('An earlier payment is being processed. Check payment before continuing.');
  await statement(db,"UPDATE billing_orders SET status='failed',plan_snapshot=json_set(plan_snapshot,'$.replacement_reason','renewal_policy_changed') WHERE id=? AND status='pending'",[order.id]).run();
  return true;
}

async function applyInvoice(db,env,row,invoice,fetcher) {
  const plan=JSON.parse(row.plan_snapshot);
  if(invoice.subscription_id!==row.provider_subscription_id || invoice.status!=='paid') return;
  if(!iso(invoice.billing_start) || !iso(invoice.billing_end)) return; // Mandate authentication is not a paid subscription cycle.
  if(invoice.billing_end<=invoice.billing_start || iso(invoice.billing_start)<row.starts_at) fail('Unexpected subscription billing period.');
  if(invoice.amount!==plan.amount || invoice.amount_paid!==plan.amount || Number(invoice.amount_due)!==0 || invoice.currency!==plan.currency) fail('Recurring invoice does not match the authorized price.');
  if(!/^inv_[a-zA-Z0-9]+$/.test(invoice.id || '') || !/^pay_[a-zA-Z0-9]+$/.test(invoice.payment_id || '') || !/^order_[a-zA-Z0-9]+$/.test(invoice.order_id || '')) fail('Recurring invoice references are invalid.');
  const existing=await statement(db,'SELECT id FROM billing_orders WHERE provider_payment_id=?',[invoice.payment_id]).first();
  if(existing)return;
  const payment=await provider(env,'payments/'+encodeURIComponent(invoice.payment_id),{},fetcher);
  if(payment.id!==invoice.payment_id || payment.order_id!==invoice.order_id || payment.invoice_id!==invoice.id || payment.amount!==plan.amount || payment.currency!==plan.currency || payment.status!=='captured' || payment.captured!==true || Number(payment.amount_refunded || 0)!==0) fail('Recurring payment is not a matching captured payment.');
  const id='renewal-'+invoice.id,now=new Date().toISOString(),start=iso(invoice.billing_start),end=iso(invoice.billing_end);
  const snapshot=JSON.stringify({...plan,activation_source:'recurring',provider_subscription_id:row.provider_subscription_id,provider_invoice_id:invoice.id,term_starts_at:start,term_ends_at:end});
  const guard="EXISTS(SELECT 1 FROM billing_orders WHERE id=? AND provider_payment_id=?) AND NOT EXISTS(SELECT 1 FROM subscription_audit WHERE order_id=?)";
  await db.batch([
    statement(db,"INSERT OR IGNORE INTO billing_orders(id,company_id,plan_id,plan_snapshot,amount,currency,mode,provider_order_id,provider_payment_id,status,created_at,activated_at,created_by,key_id) VALUES(?,?,?,?,?,?,?,?,?,'activated',?,?,?,?)",[id,row.company_id,row.plan_id,snapshot,plan.amount,plan.currency,row.mode,invoice.order_id,payment.id,now,now,row.created_by,row.key_id]),
    statement(db,`INSERT INTO company_subscriptions(company_id,mode,id,plan_id,employee_limit,dashboard_limit,starts_at,ends_at,last_order_id) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT(company_id,mode) DO UPDATE SET plan_id=excluded.plan_id,employee_limit=excluded.employee_limit,dashboard_limit=excluded.dashboard_limit,starts_at=excluded.starts_at,ends_at=excluded.ends_at,last_order_id=excluded.last_order_id WHERE excluded.ends_at>company_subscriptions.ends_at`,[row.company_id,row.mode,crypto.randomUUID(),row.plan_id,plan.employee_limit,plan.dashboard_limit,start,end,id,id,payment.id,id]),
    statement(db,`INSERT INTO subscription_audit(id,company_id,order_id,action,created_at) SELECT ?,?,?,'recurring_subscription_renewed',? WHERE ${guard}`,[crypto.randomUUID(),row.company_id,id,now,id,payment.id,id])
  ]);
}

export async function syncRecurring(db,env,row,fetcher=fetch) {
  if(!row.provider_subscription_id)return row;
  if(row.key_id!==env.RAZORPAY_KEY_ID || row.mode!==paymentConfiguration(env).mode) fail('Auto-renewal belongs to a different payment configuration. Contact support.');
  const remote=await provider(env,'subscriptions/'+encodeURIComponent(row.provider_subscription_id),{},fetcher);
  if(remote.id!==row.provider_subscription_id || remote.plan_id!==row.provider_plan_id || remote.quantity!==1 || remote.total_count!==12 || remote.start_at!==Math.ceil(Date.parse(row.starts_at)/1000) || !states.includes(remote.status)) fail('Unexpected recurring subscription response.');
  for(let skip=0;skip<1200;skip+=100) {
    const page=await provider(env,`invoices?subscription_id=${encodeURIComponent(remote.id)}&count=100&skip=${skip}`,{},fetcher);
    if(!Array.isArray(page.items))fail('Subscription invoices could not be verified.');
    for(const invoice of page.items)await applyInvoice(db,env,row,invoice,fetcher);
    if(page.items.length<100)break;
    if(skip===1100)fail('Subscription invoice history requires support reconciliation.');
  }
  await statement(db,"UPDATE billing_recurring SET status=?,charge_at=?,current_start=?,current_end=?,authorized_at=CASE WHEN ? IN ('authenticated','active') THEN COALESCE(authorized_at,?) ELSE authorized_at END,last_synced_at=?,last_error=NULL WHERE id=?",[remote.status,iso(remote.charge_at),iso(remote.current_start),iso(remote.current_end),remote.status,new Date().toISOString(),new Date().toISOString(),row.id]).run();
  return statement(db,'SELECT * FROM billing_recurring WHERE id=?',[row.id]).first();
}

export async function recurringHandle({db,env,actor,section,body={},fetcher=fetch}) {
  const mode=paymentConfiguration(env).mode;
  let row=await openRecurring(db,actor.company_id,mode);
  if(section==='recurring/create') {
    if((await workspacePolicy(db,actor.company_id)).testEnabled)fail('Turn off test mode before authorizing auto-renewal.',409);
    if(row){row=await syncRecurring(db,env,row,fetcher);if(recurringOpen(row)){
      if(!row.provider_subscription_id)fail('Auto-renewal setup is still being prepared. Refresh shortly or contact support.');
      const existing=JSON.parse(row.plan_snapshot);
      if(body.accepted!==true || body.plan_id!==row.plan_id || body.amount!==existing.amount || body.currency!==existing.currency)fail('Review the existing renewal mandate price before continuing.');
      return {...publicRecurring(row),key_id:env.RAZORPAY_KEY_ID};
    }}
    const sub=await statement(db,'SELECT * FROM company_subscriptions WHERE company_id=? AND mode=?',[actor.company_id,mode]).first();
    if(!sub || Date.parse(sub.ends_at)<Date.now()+3600000)fail('An active plan with at least one hour remaining is required to set up auto-renewal.');
    const plan=await statement(db,'SELECT * FROM billing_plans WHERE id=? AND enabled=1',[sub.plan_id]).first();
    if(!plan?.amount || !plan.employee_limit || !plan.dashboard_limit)fail('This plan needs a custom renewal agreement.');
    if(body.plan_id!==plan.id || body.amount!==plan.amount || body.currency!==plan.currency || body.accepted!==true)fail('Review and accept the current monthly renewal price before continuing.');
    const pending=await statement(db,"SELECT * FROM billing_orders WHERE company_id=? AND mode=? AND status IN ('creating','pending')",[actor.company_id,mode]).first();
    if(pending) {
      if(!await retireEarlyRenewal(db,env,pending,sub,fetcher))fail('Complete or reconcile the unfinished purchase before enabling auto-renewal.');
    }
    const id=crypto.randomUUID(),now=new Date().toISOString();
    try{await statement(db,"INSERT INTO billing_recurring(id,company_id,mode,plan_id,plan_snapshot,key_id,status,starts_at,created_at,created_by) VALUES(?,?,?,?,?,?,'creating',?,?,?)",[id,actor.company_id,mode,plan.id,JSON.stringify(plan),env.RAZORPAY_KEY_ID,sub.ends_at,now,actor.user_id]).run();}catch{fail('Auto-renewal is already being set up. Refresh before retrying.');}
    let remote;
    try {
      const rp=await provider(env,'plans',{method:'POST',body:JSON.stringify({period:'monthly',interval:1,item:{name:`NextHR ${plan.name} monthly`,amount:plan.amount,currency:plan.currency,description:'Monthly workspace subscription'}})},fetcher);
      if(!/^plan_[a-zA-Z0-9]+$/.test(rp.id || '') || rp.period!=='monthly' || rp.interval!==1 || rp.item?.amount!==plan.amount || rp.item?.currency!==plan.currency)fail('Unexpected Razorpay plan response.');
      await statement(db,'UPDATE billing_recurring SET provider_plan_id=? WHERE id=?',[rp.id,id]).run();
      remote=await provider(env,'subscriptions',{method:'POST',body:JSON.stringify({plan_id:rp.id,total_count:12,quantity:1,customer_notify:true,start_at:Math.ceil(Date.parse(sub.ends_at)/1000),expire_by:Math.floor(Math.min(Date.now()+7*86400000,Date.parse(sub.ends_at)-300000)/1000),notes:{company_id:actor.company_id,recurring_id:id}})},fetcher);
      if(!/^sub_[a-zA-Z0-9]+$/.test(remote.id || '') || remote.plan_id!==rp.id || remote.status!=='created')fail('Unexpected Razorpay mandate response.');
      await statement(db,"UPDATE billing_recurring SET provider_subscription_id=?,status='created',charge_at=? WHERE id=?",[remote.id,iso(remote.charge_at || remote.start_at),id]).run();
    }catch(error){await statement(db,"UPDATE billing_recurring SET status='failed',last_error='Mandate creation did not complete' WHERE id=? AND provider_subscription_id IS NULL",[id]).run();throw error;}
    row=await statement(db,'SELECT * FROM billing_recurring WHERE id=?',[id]).first();
    return {...publicRecurring(row),key_id:env.RAZORPAY_KEY_ID};
  }
  row=await statement(db,'SELECT * FROM billing_recurring WHERE id=? AND company_id=? AND mode=?',[body.recurring_id || '',actor.company_id,mode]).first();
  if(!row)fail('Auto-renewal record not found.',404);
  if(section==='recurring/verify') {
    if(body.razorpay_subscription_id!==row.provider_subscription_id || !/^pay_[a-zA-Z0-9]+$/.test(body.razorpay_payment_id || '') || !await validSignature(env.RAZORPAY_KEY_SECRET,`${body.razorpay_payment_id}|${row.provider_subscription_id}`,body.razorpay_signature))fail('Mandate signature could not be verified.',403);
  }else if(section==='recurring/cancel') {
    if(row.key_id!==env.RAZORPAY_KEY_ID)fail('Payment configuration changed. Contact support to cancel the mandate.');
    const remote=await provider(env,`subscriptions/${encodeURIComponent(row.provider_subscription_id)}`,{},fetcher);
    if(remote.id!==row.provider_subscription_id || remote.plan_id!==row.provider_plan_id)fail('Subscription identity could not be verified.');
    const cancelled=terminal.includes(remote.status)?remote:await provider(env,`subscriptions/${encodeURIComponent(row.provider_subscription_id)}/cancel`,{method:'POST',body:JSON.stringify({cancel_at_cycle_end:false})},fetcher);
    if(cancelled.id!==row.provider_subscription_id || !terminal.includes(cancelled.status))fail('Cancellation is not yet confirmed. Refresh status before retrying.');
    await statement(db,'UPDATE billing_recurring SET status=?,charge_at=NULL,last_synced_at=? WHERE id=?',[cancelled.status,new Date().toISOString(),row.id]).run();
    // A temporary invoice outage must never prevent stopping future charges.
    try{return publicRecurring(await syncRecurring(db,env,row,fetcher));}catch{return publicRecurring(await statement(db,'SELECT * FROM billing_recurring WHERE id=?',[row.id]).first());}
  }else if(section!=='recurring/sync')fail('Auto-renewal route not found.',404);
  return publicRecurring(await syncRecurring(db,env,row,fetcher));
}

export async function recurringWebhook(db,env,event,eventId,fetcher=fetch) {
  const id=event.payload?.subscription?.entity?.id;
  if(!id)return {ignored:true};
  const row=await statement(db,'SELECT * FROM billing_recurring WHERE provider_subscription_id=? AND mode=?',[id,paymentConfiguration(env).mode]).first();
  if(!row)return {ignored:true};
  await syncRecurring(db,env,row,fetcher);
  await statement(db,'INSERT OR IGNORE INTO billing_recurring_events(event_id,recurring_id,event_type,received_at) VALUES(?,?,?,?)',[eventId,row.id,event.event,new Date().toISOString()]).run();
  return {received:true};
}

export async function reconcileRecurringSubscriptions(db,env,fetcher=fetch) {
  const rows=(await statement(db,"SELECT * FROM billing_recurring WHERE mode=? AND status NOT IN ('failed','creating') ORDER BY COALESCE(last_synced_at,created_at) LIMIT 10",[paymentConfiguration(env).mode]).all()).results;
  for(const row of rows)try{await syncRecurring(db,env,row,fetcher);}catch{await statement(db,"UPDATE billing_recurring SET last_error='Reconciliation requires retry',last_synced_at=? WHERE id=?",[new Date().toISOString(),row.id]).run();}
}
