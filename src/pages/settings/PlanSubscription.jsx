import React, { useEffect, useState } from 'react';
import { Check, ShieldCheck, Users, CreditCard, RefreshCw, ArrowUpRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { billingApi, loadRazorpay } from '../../lib/billingApi';
import { Modal } from '../../components/ui/Modal';
import './PlanSubscription.scss';
const money = amount => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(amount/100);
const day = value => new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});

export function PlanSubscription({ currentUser }) {
  const [data,setData]=useState(null), [error,setError]=useState(''), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false), [selected,setSelected]=useState(null);
  async function load() { try { setData(await billingApi.overview()); } catch(e) {setError(e.message);} }
  useEffect(() => { let alive=true; billingApi.overview().then(value => {if(alive)setData(value);}).catch(e => {if(alive)setError(e.message);}); return () => {alive=false;}; },[]);
  async function reconcile(id) {setBusy(true);setError('');try {const result=await billingApi.reconcile(id);setNotice(result.pending?'Payment is not captured yet. You can safely check again shortly.':'Payment verified. Your test subscription is active.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function checkout() {
    if (busy) return;
    setBusy(true);setError('');setNotice('');
    try {
      const Checkout=await loadRazorpay();
      const order=await billingApi.create(selected.id);
      setSelected(null); await load();
      let confirming=false;
      const instance=new Checkout({key:order.key_id,order_id:order.provider_order_id,amount:order.amount,currency:order.currency,name:'NextHR',description:`${order.plan_name} · one monthly term · TEST`,theme:{color:'#527357'},prefill:{name:currentUser.name || currentUser.username,email:currentUser.email || ''},
        handler: async response => { confirming=true;setError('');try {await billingApi.verify({purchase_id:order.id,...response});setNotice('Test payment verified. Your test subscription is active; real company access is unchanged.');await load();}catch(e){setError(`${e.message} Use Check payment below to recover this purchase without paying again.`);}finally{setBusy(false);}},
        modal:{ondismiss:() => {if(!confirming){setBusy(false);setNotice('Checkout closed. Your purchase remains available below to resume or check payment.');}}}
      });
      instance.on('payment.failed',() => setError('Payment attempt failed. Retry in checkout or close it; no subscription is activated until payment is verified.'));
      instance.open();
    } catch(e) {setError(e.message);setBusy(false);await load();}
  }
  const pending=data?.orders.find(o=>['pending','creating'].includes(o.status));
  return <section className="billing-section" aria-label="Plan and subscription">
    <div className="billing-heading">
      <div>
        <span className="tenant-eyebrow">GROW WITH YOUR TEAM</span>
        <h2>Plan &amp; Subscription</h2>
        <p>Choose the capacity your company needs. Your Super Admin is always included.</p>
      </div>
      <Button variant="fadeout" size="md" iconOnly icon={RefreshCw} loading={busy} onClick={() => {setError('');load();}} aria-label="Refresh" />
    </div>
    {error && <p className="ws-error" role="alert">{error}</p>}{notice && <p className="ws-notice" role="status">{notice}</p>}
    {!data ? <p className="tenant-empty">{error?'Billing is unavailable. Use Refresh to retry.':'Loading plans...'}</p> : <>
      <div className="billing-mode"><ShieldCheck size={18} /><div><strong>Test payments only</strong><p>No real money is charged. Test subscriptions do not change production limits. Monthly terms renew by a new payment, without automatic debit.</p>{!data.checkoutEnabled && <p>{data.reason}</p>}</div></div>
      <div className="billing-current"><div><span>Current company access</span><strong>{data.capacity.legacy?'Existing workspace':data.capacity.expired?'Subscription expired':'Paid company workspace'}</strong><small>{data.usage.employees} active employees{data.capacity.employee_limit!=null?` / ${data.capacity.employee_limit}`:''} · {data.usage.dashboard_users} / {data.capacity.dashboard_limit} additional dashboard users</small></div><div><span>Test subscription</span><strong>{data.subscription?`${data.plans.find(p=>p.id===data.subscription.plan_id)?.name || data.subscription.plan_id} · ${data.subscription.ends_at>new Date().toISOString()?'Active':'Expired'}`:'Not activated'}</strong><small>{data.subscription?`Until ${day(data.subscription.ends_at)} · Reference ${data.subscription.id}`:'Choose a plan to test automatic activation.'}</small></div></div>
      <div className="billing-plans">{data.plans.map(plan => {
        const over=plan.amount && (data.usage.employees>plan.employee_limit || data.usage.dashboard_users>plan.dashboard_limit);
        const current=data.subscription?.plan_id===plan.id && data.subscription.ends_at>new Date().toISOString();
        return <article className={`billing-plan ${plan.id==='business'?'billing-plan--featured':''}`} key={plan.id}><div className="billing-plan-top"><h3>{plan.name}</h3>{current?<span>Current test plan</span>:plan.id==='business'?<span>More room to grow</span>:null}</div><p>{plan.description}</p><div className="billing-price">{plan.amount?money(plan.amount):'Custom'}{plan.amount && <small>/ month</small>}</div><small className="billing-tax">{plan.amount?'Includes GST · test pricing':'Tailored to your company'}</small><ul><li><Users size={15}/>{plan.employee_limit?`Up to ${plan.employee_limit} active employees`:'Custom employee capacity'}</li><li><Check size={15}/>{plan.dashboard_limit?`${plan.dashboard_limit} additional dashboard users`:'Custom dashboard-user limit'}</li><li><Check size={15}/>Company Super Admin included</li><li><Check size={15}/>Existing dashboard modules</li><li><Check size={15}/>Page-level access controls</li></ul><button className={`tenant-button ${plan.id==='business'?'ws-primary':''}`} disabled={busy || Boolean(plan.amount && (!data.checkoutEnabled || over || (pending && pending.plan_id!==plan.id)))} onClick={()=>setSelected(plan)}>{!plan.amount?'Discuss Enterprise':over?'Above this plan’s limits':pending?.plan_id===plan.id?'Resume test checkout':current?'Renew test plan':'Select plan'}<ArrowUpRight size={14}/></button></article>;
      })}</div>
      <p className="billing-footnote">All plans include the existing dashboard modules; capacity differs by plan. Module limitations still apply, including browser-local geofence rules and Super Admin-only legacy payslip management. Existing company access is preserved until a live subscription is introduced.</p>
      <div className="tenant-panel billing-history"><div className="tenant-panel-head"><div><h2>Recent test purchases</h2><p>Each purchase has its own ID. Use Check payment if checkout closed before confirmation.</p></div><CreditCard size={18}/></div>{!data.orders.length?<p className="tenant-empty">No purchases yet.</p>:<div className="ws-table-wrap"><table className="ws-table"><thead><tr><th>Purchase</th><th>Plan</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.orders.map(o=><tr key={o.id}><td><strong>{day(o.created_at)}</strong><small>{o.id}</small></td><td>{data.plans.find(p=>p.id===o.plan_id)?.name}</td><td>{money(o.amount)}</td><td>{o.status==='activated'?'Test activated':o.status}</td><td>{o.status==='pending' && <button className="tenant-button" disabled={busy || !data.checkoutEnabled} onClick={()=>reconcile(o.id)}>Check payment</button>}{o.status==='creating' && <small>Preparing checkout. Contact support if this persists.</small>}</td></tr>)}</tbody></table></div>}</div>
    </>}
    {selected && <Modal isOpen title={selected.amount?'Review test purchase':'Enterprise plan'} onClose={()=>!busy&&setSelected(null)}><div className="ws-form">{selected.amount?<><p><strong>{selected.name} · {money(selected.amount)}</strong></p><p className="ws-hint">One calendar-month term, including GST. No automatic recurring charge. Renewing the same active plan adds one month to its expiry. Changing plans starts a new term immediately, without proration or credit for the old term. Test activation leaves real company access unchanged.</p><p className="ws-hint">Limits: {selected.employee_limit} active employees and {selected.dashboard_limit} additional dashboard users.</p>{error && <p className="ws-error" role="alert">{error}</p>}<button className="tenant-button ws-primary" disabled={busy} onClick={checkout}>{busy?'Opening checkout...':'Continue to Razorpay test checkout'}</button></>:<><p className="ws-hint">Enterprise capacity and pricing require a custom agreement. Self-service payment is not enabled for this plan.</p><p>Contact your NextHR platform owner with your employee count and dashboard-user requirements.</p></>}</div></Modal>}
  </section>;
}
