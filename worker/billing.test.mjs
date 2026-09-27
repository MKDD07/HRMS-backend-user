import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { billingHandle, billingWebhook, activatePayment, signature, nextMonth, paymentConfiguration, liveCapacity } from './billing.mjs';

function setup() {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON');
  for (const name of ['0001_core','0002_employee_codes','0003_company_branding','0004_approval_workflows','0005_hr_connect','0006_dashboard_access','0007_billing']) sql.exec(readFileSync(new URL(`../migrations/hrms/${name}.sql`,import.meta.url),'utf8'));
  sql.prepare("INSERT INTO companies(company_id,name) VALUES('a','Company A'),('b','Company B')").run();
  function prepare(query,params=[]) {return {bind(...values){return prepare(query,values);},async first(){return sql.prepare(query).get(...params)||null;},async all(){return {results:sql.prepare(query).all(...params)};},async run(){return sql.prepare(query).run(...params);}};}
  let queue=Promise.resolve();
  const db={prepare,batch(statements){const task=queue.then(async()=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}});queue=task.catch(()=>{});return task;}};
  const env={BILLING_MODE:'test',RAZORPAY_KEY_ID:'rzp_test_example',RAZORPAY_KEY_SECRET:'test-secret',RAZORPAY_WEBHOOK_SECRET:'test-webhook'};
  const actor={company_id:'a',user_id:'admin-a',role:'company_admin'};
  let count=0;const payments=new Map(),orders=new Map();
  const fetcher=async(url,options)=>{
    if(url.endsWith('/orders') && options.method==='POST') {count++;const value=JSON.parse(options.body);const order={...value,id:'order_'+count};orders.set(order.id,order);return Response.json(order);}
    if(url.endsWith('/payments') && url.includes('/orders/')) {const id=url.split('/').at(-2);return Response.json({items:[...payments.values()].filter(p=>p.order_id===id)});}
    if(url.includes('/payments/pay_'))return Response.json(payments.get(url.split('/').at(-1)));
    throw new Error('Unexpected provider request');
  };
  const call=(section,body,who=actor)=>billingHandle({db,env,actor:who,path:'/api/v1/billing/'+section,method:body?'POST':'GET',body,fetcher});
  const capture=order=>{const p={id:'pay_'+order.provider_order_id.slice(6),order_id:order.provider_order_id,amount:order.amount,currency:'INR',status:'captured',captured:true,amount_refunded:0};payments.set(p.id,p);return p;};
  return {sql,db,env,actor,call,capture,payments,fetcher,orders};
}

test('catalogue, server-owned prices, safe defaults and company isolation',async()=>{
  const s=setup();try{
    assert.equal(paymentConfiguration({}).checkoutEnabled,false);
    assert.equal(paymentConfiguration({...s.env,BILLING_MODE:'live',RAZORPAY_KEY_ID:'rzp_live_example'}).checkoutEnabled,false);
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
    const renewal=await s.call('orders',{plan_id:'business'});s.capture(renewal);await s.call('reconcile',{purchase_id:renewal.id});
    const renewed=(await s.call('overview')).subscription;assert.equal(renewed.ends_at,nextMonth(results[0].subscription.ends_at));
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
