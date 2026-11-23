import { grantComplimentaryPlan } from './billingGrant.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { billingHandle, billingWebhook, activatePayment, signature, nextMonth, paymentConfiguration, liveCapacity } from './billing.mjs';

function setup() {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON');
  for (const name of ['0001_core','0002_employee_codes','0003_company_branding','0004_approval_workflows','0005_hr_connect','0006_dashboard_access','0007_billing','0018_billing_recurring','0019_billing_renewal_guards','0020_billing_workspace_policy']) sql.exec(readFileSync(new URL(`../migrations/hrms/${name}.sql`,import.meta.url),'utf8'));
  sql.prepare("INSERT INTO companies(company_id,name) VALUES('a','Company A'),('b','Company B')").run();
  function prepare(query,params=[]) {return {bind(...values){return prepare(query,values);},async first(){return sql.prepare(query).get(...params)||null;},async all(){return {results:sql.prepare(query).all(...params)};},async run(){return sql.prepare(query).run(...params);}};}
  let queue=Promise.resolve();
  const db={prepare,batch(statements){const task=queue.then(async()=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}});queue=task.catch(()=>{});return task;}};
  const env={BILLING_MODE:'test',RAZORPAY_KEY_ID:'rzp_test_example',RAZORPAY_KEY_SECRET:'test-secret',RAZORPAY_WEBHOOK_SECRET:'test-webhook'};
  const actor={company_id:'a',user_id:'admin-a',role:'company_admin'};
  let count=0;const payments=new Map(),orders=new Map(),recurring=new Map(),plans=new Map(),invoices=new Map();
  const fetcher=async(url,options)=>{
    if(url.endsWith('/plans') && options.method==='POST'){const p={...JSON.parse(options.body),id:'plan_'+(plans.size+1)};plans.set(p.id,p);return Response.json(p);}
    if(url.endsWith('/subscriptions') && options.method==='POST'){const b=JSON.parse(options.body);const r={...b,id:'sub_'+(recurring.size+1),status:'created',charge_at:b.start_at,current_start:null,current_end:null};recurring.set(r.id,r);return Response.json(r);}
    if(url.includes('/subscriptions/sub_')){const id=url.split('/subscriptions/')[1].split('/')[0];const r=recurring.get(id);if(url.endsWith('/cancel')){r.status='cancelled';r.charge_at=null;}return Response.json(r);}
    if(url.includes('/invoices?')){const u=new URL(url);const items=[...invoices.values()].filter(v=>v.subscription_id===u.searchParams.get('subscription_id'));return Response.json({items:items.slice(Number(u.searchParams.get('skip')||0),Number(u.searchParams.get('skip')||0)+100)});}

    if(url.endsWith('/orders') && options.method==='POST') {count++;const value=JSON.parse(options.body);const order={...value,id:'order_'+count};orders.set(order.id,order);return Response.json(order);}
    if(url.endsWith('/payments') && url.includes('/orders/')) {const id=url.split('/').at(-2);return Response.json({items:[...payments.values()].filter(p=>p.order_id===id)});}
    if(url.includes('/payments/pay_'))return Response.json(payments.get(url.split('/').at(-1)));
    throw new Error('Unexpected provider request');
  };
  const call=(section,body,who=actor)=>billingHandle({db,env,actor:who,path:'/api/v1/billing/'+section,method:body?'POST':'GET',body:section==='orders'?{accepted:true,confirmed:true,...body}:body,fetcher});
  const capture=order=>{const p={id:'pay_'+order.provider_order_id.slice(6),order_id:order.provider_order_id,amount:order.amount,currency:'INR',status:'captured',captured:true,amount_refunded:0};payments.set(p.id,p);return p;};
  return {sql,db,env,actor,call,capture,payments,fetcher,orders,recurring,plans,invoices};
}

test('catalogue, server-owned prices, safe defaults and company isolation',async()=>{
  const s=setup();try{
    assert.equal(paymentConfiguration({}).checkoutEnabled,false);
    assert.equal(paymentConfiguration({...s.env,BILLING_MODE:'live',RAZORPAY_KEY_ID:'rzp_live_example'}).checkoutEnabled,true);
    const overview=await s.call('overview');assert.deepEqual(overview.plans.map(p=>p.dashboard_limit),[2,5,10,null]);assert.equal(overview.capacity.dashboard_limit,3);
    const order=await s.call('orders',{plan_id:'starter',amount:1,company_id:'b'});assert.equal(order.amount,199900);
    const repeated=await s.call('orders',{plan_id:'starter'});assert.equal(order.id,repeated.id);assert.equal(s.orders.size,1);
    await assert.rejects(s.call('reconcile',{purchase_id:order.id},{...s.actor,company_id:'b'}),{status:404});
    await assert.rejects(s.call('orders',{plan_id:'team'},{...s.actor,role:'employee'}),{status:403});
    await assert.rejects(s.call('orders',{plan_id:'enterprise'}),{status:400});
    await assert.rejects(s.call('orders',{plan_id:'team'}),{status:409});
  }finally{s.sql.close();}
});
test('verified capture activates exactly once and test mode preserves real limits',async()=>{
  const s=setup();try{
    const order=await s.call('orders',{plan_id:'business'}), payment=s.capture(order);
    const payload={purchase_id:order.id,razorpay_order_id:order.provider_order_id,razorpay_payment_id:payment.id,razorpay_signature:await signature(s.env.RAZORPAY_KEY_SECRET,`${order.provider_order_id}|${payment.id}`)};
    await assert.rejects(s.call('verify',{...payload,razorpay_signature:'0'.repeat(64)}),{status:403});
    const results=await Promise.all([s.call('verify',payload),s.call('verify',payload)]);
    assert.equal(results[0].subscription.ends_at,results[1].subscription.ends_at);
    assert.equal(results[0].subscription.dashboard_limit,10);
    assert.equal(s.sql.prepare('SELECT COUNT(*) AS n FROM subscription_audit').get().n,1);
    assert.equal((await liveCapacity(s.db,'a')).dashboard_limit,3);
    const nearExpiry=new Date(Date.now()+3*86400000).toISOString();
    s.sql.prepare('UPDATE company_subscriptions SET ends_at=?').run(nearExpiry);
    const renewal=await s.call('orders',{plan_id:'business'});s.capture(renewal);await s.call('reconcile',{purchase_id:renewal.id});
    const renewed=(await s.call('overview')).subscription;assert.equal(renewed.ends_at,nextMonth(nearExpiry));
    await s.call('verify',payload);assert.equal((await s.call('overview')).subscription.ends_at,renewed.ends_at);
  }finally{s.sql.close();}
});
test('amount mismatch and uncaptured or refunded payments cannot activate',async()=>{
  const s=setup();try{
    const order=await s.call('orders',{plan_id:'starter'}),p=s.capture(order);
    const row=s.sql.prepare('SELECT * FROM billing_orders WHERE id=?').get(order.id);
    for(const change of [{amount:1},{currency:'USD'},{order_id:'order_other'}])await assert.rejects(activatePayment(s.db,row,{...p,...change}),{status:403});
    for(const change of [{status:'authorized',captured:false},{amount_refunded:100}])await assert.rejects(activatePayment(s.db,row,{...p,...change}),{status:409});
    assert.equal(s.sql.prepare('SELECT COUNT(*) AS n FROM company_subscriptions').get().n,0);
  }finally{s.sql.close();}
});
test('signed raw webhooks recover browser-close payments and handle duplicate events',async()=>{
  const s=setup();try{
    const order=await s.call('orders',{plan_id:'team'});s.capture(order);
    const raw=JSON.stringify({event:'order.paid',payload:{order:{entity:{id:order.provider_order_id}}}});
    const sig=await signature(s.env.RAZORPAY_WEBHOOK_SECRET,raw);
    const request=(body=raw)=>new Request('https://test/api/v1/billing/webhook',{method:'POST',headers:{'x-razorpay-signature':sig,'x-razorpay-event-id':'evt1'},body});
    await assert.rejects(billingWebhook(request(raw+' '),s.env,s.db,s.fetcher),{status:403});
    await billingWebhook(request(),s.env,s.db,s.fetcher);await billingWebhook(request(),s.env,s.db,s.fetcher);
    assert.equal(s.sql.prepare('SELECT COUNT(*) AS n FROM billing_events').get().n,1);
    assert.equal((await s.call('overview')).subscription.plan_id,'team');
  }finally{s.sql.close();}
});
test('live capacity triggers enforce grants and employee insertion without deleting records',async()=>{
  const s=setup();try{
    const order=await s.call('orders',{plan_id:'starter'});s.capture(order);await s.call('reconcile',{purchase_id:order.id});
    // Simulate a future approved live entitlement; test checkout itself never creates this.
    s.sql.prepare("UPDATE company_subscriptions SET mode='live',employee_limit=2 WHERE company_id='a'").run();
    for(let i=0;i<3;i++)s.sql.prepare("INSERT INTO users(user_id,company_id,username,password_hash,role) VALUES(?,'a',?,'hash','employee')").run('u'+i,'user'+i);
    for(let i=0;i<2;i++)s.sql.prepare("INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,dashboard_access) VALUES(?,'a',?,?,?,1)").run('e'+i,'u'+i,'E'+i,'Person');
    assert.throws(()=>s.sql.prepare("INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name) VALUES('e2','a','u2','E2','Third')").run(),/Employee plan limit/);
    s.sql.prepare("INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,status) VALUES('e2','a','u2','E2','Third','Inactive')").run();
    assert.throws(()=>s.sql.prepare("UPDATE employees SET dashboard_access=1 WHERE employee_id='e2'").run(),/Dashboard user plan limit/);
    assert.throws(()=>s.sql.prepare("UPDATE employees SET status='Active' WHERE employee_id='e2'").run(),/Employee plan limit/);
    assert.equal(s.sql.prepare('SELECT COUNT(*) AS n FROM employees').get().n,3);
  }finally{s.sql.close();}
});
test('monthly periods clamp month ends',()=>{assert.equal(nextMonth('2028-01-31T12:00:00.000Z'),'2028-02-29T12:00:00.000Z');});

test('complimentary production grant is audited, free, capacity-enforced and cannot be repeated',async()=>{
 const s=setup();try{
  const granted=await grantComplimentaryPlan(s.db,{companyId:'a',planId:'team',authorizedBy:'owner',reason:'Approved complimentary month'});
  assert.equal(granted.amount_charged,0);
  assert.equal((await liveCapacity(s.db,'a')).dashboard_limit,5);
  s.env.BILLING_MODE='live';
  const overview=await s.call('overview');
  assert.equal(overview.liveSubscription.source,'complimentary');
  assert.equal(overview.subscription.plan_id,'team');
  assert.equal(overview.orders[0].amount,0);
  assert.equal(overview.orders[0].source,'complimentary');
  assert.equal(overview.orders[0].provider_order_id,null);
  assert.equal(s.sql.prepare('SELECT action FROM subscription_audit').get().action,'complimentary_subscription_granted');
  await assert.rejects(grantComplimentaryPlan(s.db,{companyId:'a',planId:'team',authorizedBy:'owner',reason:'Repeat'}));
  assert.equal(s.sql.prepare('SELECT COUNT(*) AS n FROM billing_orders').get().n,1);
 }finally{s.sql.close();}
});
test('live checkout requires matching keys and captured payment activates production capacity',async()=>{
 const s=setup();try{
  assert.equal(paymentConfiguration({...s.env,BILLING_MODE:'live'}).checkoutEnabled,false);
  assert.equal(paymentConfiguration({...s.env,BILLING_MODE:'invalid'}).checkoutEnabled,false);
  s.env.BILLING_MODE='live';s.env.RAZORPAY_KEY_ID='rzp_live_example';
  const order=await s.call('orders',{plan_id:'team'});s.capture(order);
  await s.call('reconcile',{purchase_id:order.id});
  assert.equal((await liveCapacity(s.db,'a')).dashboard_limit,5);
  assert.equal((await s.call('overview')).liveSubscription.source,'payment');
 }finally{s.sql.close();}
});

test('price changes replace unpaid checkouts while preserving late-payment recovery',async()=>{
 const s=setup();try{
  const old=await s.call('orders',{plan_id:'business'});
  s.sql.prepare("UPDATE billing_plans SET amount=100 WHERE id IN ('starter','team','business')").run();
  const fresh=await s.call('orders',{plan_id:'team'});
  assert.equal(fresh.amount,100);assert.notEqual(fresh.id,old.id);
  const oldRow=s.sql.prepare('SELECT * FROM billing_orders WHERE id=?').get(old.id);
  assert.equal(oldRow.amount,599900);assert.equal(oldRow.status,'failed');
  s.capture(old);await s.call('reconcile',{purchase_id:old.id});
  assert.equal(s.sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(old.id).status,'activated');
  s.capture(fresh);await s.call('reconcile',{purchase_id:fresh.id});
  assert.equal((await s.call('overview')).subscription.plan_id,'team');
 }finally{s.sql.close();}
});

test('only the verified selected plan replaces company capacity and old callbacks cannot revert it',async()=>{
 const s=setup();try{
  s.env.BILLING_MODE='live';s.env.RAZORPAY_KEY_ID='rzp_live_example';
  const team=await s.call('orders',{plan_id:'team'});
  assert.equal((await s.call('overview')).liveSubscription,null);
  s.capture(team);await s.call('reconcile',{purchase_id:team.id});
  let overview=await s.call('overview');
  assert.equal(overview.liveSubscription.plan_id,'team');
  assert.equal(overview.capacity.employee_limit,50);assert.equal(overview.capacity.dashboard_limit,5);
  const business=await s.call('orders',{plan_id:'business'});
  assert.equal((await s.call('overview')).liveSubscription.plan_id,'team');
  s.capture(business);await s.call('reconcile',{purchase_id:business.id});
  await s.call('reconcile',{purchase_id:team.id});
  overview=await s.call('overview');
  assert.equal(overview.liveSubscription.plan_id,'business');
  assert.equal(overview.capacity.employee_limit,200);assert.equal(overview.capacity.dashboard_limit,10);
  assert.equal(s.sql.prepare("SELECT COUNT(*) AS n FROM company_subscriptions WHERE company_id='a' AND mode='live'").get().n,1);
  assert.equal(s.sql.prepare('SELECT COUNT(*) AS n FROM subscription_audit').get().n,2);
 }finally{s.sql.close();}
});

test('purchase details are company-owned, use original pricing and expose verified payment fields only',async()=>{
 const s=setup();try{
  s.env.BILLING_MODE='live';s.env.RAZORPAY_KEY_ID='rzp_live_example';
  const order=await s.call('orders',{plan_id:'business'});
  let details=await s.call('purchases/'+order.id);assert.equal(details.receipt_available,false);
  const payment=s.capture(order);Object.assign(payment,{method:'upi',email:'payer@example.test',contact:'+919000000000',acquirer_data:{rrn:'bank123'},created_at:1794738000});
  await s.call('reconcile',{purchase_id:order.id});
  s.sql.prepare("UPDATE billing_plans SET amount=100,name='Renamed' WHERE id='business'").run();
  details=await s.call('purchases/'+order.id);
  assert.equal(details.plan_name,'Business');assert.equal(details.amount,599900);
  assert.equal(details.company_name,'Company A');assert.equal(details.payment.method,'upi');
  assert.equal(details.payment.bank_reference,'bank123');assert.equal(details.receipt_available,true);
  assert.equal(details.term_ends_at,nextMonth(details.term_starts_at));
  assert.equal(JSON.stringify(details).includes('test-secret'),false);assert.equal('key_id' in details,false);
  await assert.rejects(s.call('purchases/'+order.id,undefined,{...s.actor,company_id:'b'}),{status:404});
  await assert.rejects(s.call('purchases/'+order.id,undefined,{...s.actor,role:'employee'}),{status:403});
  payment.amount_refunded=500;payment.refund_status='partial';
  assert.equal((await s.call('purchases/'+order.id)).payment.amount_refunded,500);
  await s.call('change-plan',{plan_id:'team',revision:0,accepted:true,confirmed:true});
  assert.equal((await s.call('purchases/'+order.id)).term_ends_at,details.term_ends_at);
 }finally{s.sql.close();}
});
test('complimentary grants cannot produce paid receipts and provider failures retain saved details',async()=>{
 const s=setup();try{
  const grant=await grantComplimentaryPlan(s.db,{companyId:'a',planId:'team',authorizedBy:'owner',reason:'Approved'});
  s.env.BILLING_MODE='live';s.env.RAZORPAY_KEY_ID='rzp_live_example';
  const overview=await s.call('overview');const details=await s.call('purchases/'+overview.orders[0].id);
  assert.equal(details.receipt_available,false);assert.equal(details.amount,0);assert.equal(details.payment,null);
  const paid=await s.call('orders',{plan_id:'business'});s.capture(paid);await s.call('reconcile',{purchase_id:paid.id});
  const unavailable=await billingHandle({db:s.db,env:s.env,actor:s.actor,path:'/api/v1/billing/purchases/'+paid.id,method:'GET',fetcher:async()=>{throw new Error('Offline');}});
  assert.equal(unavailable.payment_unavailable,true);assert.equal(unavailable.provider_payment_id,s.capture(paid).id);
 }finally{s.sql.close();}
});

async function renewalSetup(){
 const s=setup();s.env.BILLING_MODE='live';s.env.RAZORPAY_KEY_ID='rzp_live_example';
 const first=await s.call('orders',{plan_id:'business'});s.capture(first);await s.call('reconcile',{purchase_id:first.id});
 s.initial=(await s.call('overview')).liveSubscription;
 s.request={plan_id:'business',amount:599900,currency:'INR',accepted:true};
 return s;
}
function renewalInvoice(s,renewal,number=1){
 const remote=s.recurring.get(renewal.provider_subscription_id);
 const start=remote.start_at+(number-1)*31*86400,end=start+31*86400;
 const invoice={id:'inv_cycle'+number,subscription_id:remote.id,status:'paid',amount:599900,amount_paid:599900,amount_due:0,currency:'INR',billing_start:start,billing_end:end,payment_id:'pay_cycle'+number,order_id:'order_cycle'+number};
 const payment={id:invoice.payment_id,invoice_id:invoice.id,order_id:invoice.order_id,amount:599900,currency:'INR',captured:true,status:'captured',amount_refunded:0};
 s.invoices.set(invoice.id,invoice);s.payments.set(payment.id,payment);Object.assign(remote,{status:'active',current_start:start,current_end:end,charge_at:end});
 return {invoice,payment,remote};
}
test('manual renewal is permitted only near expiry and plan switching remains possible',async()=>{
 const s=await renewalSetup();try{
  await assert.rejects(s.call('orders',{plan_id:'business'}),{status:409});
  const near=new Date(Date.now()+5*86400000).toISOString();s.sql.prepare('UPDATE company_subscriptions SET ends_at=?').run(near);
  assert.equal((await s.call('orders',{plan_id:'business'})).plan_id,'business');
 }finally{s.sql.close();}
});
test('recurring setup requires consent, uses a server-owned price and never extends access on authentication',async()=>{
 const s=await renewalSetup();try{
  await assert.rejects(s.call('recurring/create',{...s.request,amount:1}),{status:409});
  await assert.rejects(s.call('recurring/create',{...s.request,accepted:false}),{status:409});
  await assert.rejects(s.call('recurring/create',s.request,{...s.actor,role:'employee'}),{status:403});
  const renewal=await s.call('recurring/create',s.request);
  assert.equal(renewal.enabled,false);assert.equal(renewal.amount,599900);assert.equal(renewal.total_cycles,12);
  assert.equal(s.recurring.get(renewal.provider_subscription_id).start_at,Math.ceil(Date.parse(s.initial.ends_at)/1000));
  const repeat=await s.call('recurring/create',s.request);assert.equal(repeat.id,renewal.id);assert.equal(s.recurring.size,1);
  await assert.rejects(s.call('orders',{plan_id:'team'}),{status:409});
  await assert.rejects(s.call('recurring/sync',{recurring_id:renewal.id},{...s.actor,company_id:'b'}),{status:404});
  await assert.rejects(s.call('recurring/verify',{recurring_id:renewal.id,razorpay_subscription_id:renewal.provider_subscription_id,razorpay_payment_id:'pay_auth',razorpay_signature:'0'.repeat(64)}),{status:403});
  s.recurring.get(renewal.provider_subscription_id).status='authenticated';
  const verified=await s.call('recurring/verify',{recurring_id:renewal.id,razorpay_subscription_id:renewal.provider_subscription_id,razorpay_payment_id:'pay_auth',razorpay_signature:await signature(s.env.RAZORPAY_KEY_SECRET,'pay_auth|'+renewal.provider_subscription_id)});
  assert.equal(verified.enabled,true);assert.ok(verified.authorized_at);
  assert.equal((await s.call('overview')).liveSubscription.ends_at,s.initial.ends_at);
 }finally{s.sql.close();}
});
test('captured recurring invoices renew the database once, preserve term snapshots and create receipt history',async()=>{
 const s=await renewalSetup();try{
  const renewal=await s.call('recurring/create',s.request);const {invoice}=renewalInvoice(s,renewal);
  await s.call('recurring/sync',{recurring_id:renewal.id});await s.call('recurring/sync',{recurring_id:renewal.id});
  const overview=await s.call('overview');assert.equal(overview.liveSubscription.ends_at,new Date(invoice.billing_end*1000).toISOString());assert.equal(overview.capacity.dashboard_limit,10);
  const receipts=overview.orders.filter(o=>o.source==='recurring');assert.equal(receipts.length,1);
  const details=await s.call('purchases/'+receipts[0].id);assert.equal(details.receipt_available,true);assert.equal(details.term_starts_at,new Date(invoice.billing_start*1000).toISOString());
  assert.equal(s.sql.prepare("SELECT COUNT(*) AS n FROM subscription_audit WHERE action='recurring_subscription_renewed'").get().n,1);
 }finally{s.sql.close();}
});
test('recurring invoice mismatches and refunded or uncaptured payments never extend access',async()=>{
 for(const mutation of ['price','foreign','refunded','uncaptured']){
  const s=await renewalSetup();try{
   const renewal=await s.call('recurring/create',s.request);const {invoice,payment}=renewalInvoice(s,renewal);
   if(mutation==='price')invoice.amount=1;
   if(mutation==='foreign')payment.invoice_id='inv_foreign';
   if(mutation==='refunded')payment.amount_refunded=100;
   if(mutation==='uncaptured')payment.captured=false;
   await assert.rejects(s.call('recurring/sync',{recurring_id:renewal.id}));
   assert.equal((await s.call('overview')).liveSubscription.ends_at,s.initial.ends_at);
  }finally{s.sql.close();}
 }
});
test('subscription webhooks verify signatures, recover renewals and ignore duplicate delivery',async()=>{
 const s=await renewalSetup();try{
  const renewal=await s.call('recurring/create',s.request);const {remote}=renewalInvoice(s,renewal);
  const raw=JSON.stringify({event:'subscription.charged',payload:{subscription:{entity:{id:remote.id}}}});
  const headers={'x-razorpay-signature':await signature(s.env.RAZORPAY_WEBHOOK_SECRET,raw),'x-razorpay-event-id':'recurring-event'};
  await assert.rejects(billingWebhook(new Request('https://test/webhook',{method:'POST',body:raw}),s.env,s.db,s.fetcher),{status:403});
  for(let n=0;n<2;n++)await billingWebhook(new Request('https://test/webhook',{method:'POST',headers,body:raw}),s.env,s.db,s.fetcher);
  assert.equal(s.sql.prepare('SELECT COUNT(*) AS n FROM billing_recurring_events').get().n,1);
  assert.equal(s.sql.prepare("SELECT COUNT(*) AS n FROM subscription_audit WHERE action='recurring_subscription_renewed'").get().n,1);
 }finally{s.sql.close();}
});
test('cancellation stops provider mandate, preserves paid access and survives invoice outage',async()=>{
 const s=await renewalSetup();try{
  const renewal=await s.call('recurring/create',s.request);s.recurring.get(renewal.provider_subscription_id).status='authenticated';
  const result=await billingHandle({db:s.db,env:s.env,actor:s.actor,path:'/api/v1/billing/recurring/cancel',method:'POST',body:{recurring_id:renewal.id},fetcher:async(url,options)=>{if(url.includes('/invoices?'))throw new Error('Invoice outage');return s.fetcher(url,options);}});
  assert.equal(result.status,'cancelled');assert.equal(result.enabled,false);assert.equal(s.recurring.get(renewal.provider_subscription_id).status,'cancelled');
  assert.equal((await s.call('overview')).liveSubscription.ends_at,s.initial.ends_at);
  assert.equal((await s.call('recurring/cancel',{recurring_id:renewal.id})).status,'cancelled');
 }finally{s.sql.close();}
});

test('database guards prevent manual and recurring purchases from racing',async()=>{
 const s=await renewalSetup();try{
  await s.call('recurring/create',s.request);
  assert.throws(()=>s.sql.prepare("INSERT INTO billing_orders(id,company_id,plan_id,plan_snapshot,amount,currency,mode,status,created_at,created_by,key_id) VALUES('race','a','team','{}',100,'INR','live','creating','now','a','key')").run(),/auto-renewal/);
 }finally{s.sql.close();}
});

test('an abandoned early checkout cannot block setup, and a late capture cancels the mandate before renewal',async()=>{
 const s=await renewalSetup();try{
  const later=new Date(Date.now()+30*86400000).toISOString();
  s.sql.prepare('UPDATE company_subscriptions SET ends_at=?').run(new Date(Date.now()+3*86400000).toISOString());
  const abandoned=await s.call('orders',{plan_id:'business'});
  s.sql.prepare('UPDATE company_subscriptions SET ends_at=?').run(later);
  const renewal=await s.call('recurring/create',s.request);
  assert.equal(s.sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(abandoned.id).status,'failed');
  s.recurring.get(renewal.provider_subscription_id).status='authenticated';
  s.capture(abandoned);await s.call('reconcile',{purchase_id:abandoned.id});
  assert.equal(s.recurring.get(renewal.provider_subscription_id).status,'cancelled');
  assert.equal((await s.call('overview')).liveSubscription.ends_at,nextMonth(later));
 }finally{s.sql.close();}
});

test('scheduled reconciliation recovers a captured renewal without a webhook',async()=>{
 const s=await renewalSetup();try{
  const renewal=await s.call('recurring/create',s.request);const {invoice}=renewalInvoice(s,renewal);
  const {reconcileRecurringSubscriptions}=await import('./billingRecurring.mjs');
  await reconcileRecurringSubscriptions(s.db,s.env,s.fetcher);
  assert.equal((await s.call('overview')).liveSubscription.ends_at,new Date(invoice.billing_end*1000).toISOString());
 }finally{s.sql.close();}
});

test('paid checkout cannot be used to charge for a downgrade',async()=>{
 const s=await renewalSetup();try{
  s.sql.prepare('UPDATE company_subscriptions SET ends_at=?').run(new Date(Date.now()+3*86400000).toISOString());
  const abandoned=await s.call('orders',{plan_id:'business'});
  s.sql.prepare('UPDATE company_subscriptions SET ends_at=?').run(new Date(Date.now()+30*86400000).toISOString());
  await assert.rejects(s.call('orders',{plan_id:'team'}),{status:409});
  assert.equal(s.sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(abandoned.id).status,'pending');
  assert.equal((await s.call('overview')).liveSubscription.plan_id,'business');
 }finally{s.sql.close();}
});

export { setup };
