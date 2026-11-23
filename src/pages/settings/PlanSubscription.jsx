import { PLAN_HIGHLIGHTS } from '../../../shared/planFeatures.mjs';
import { RazorpaySecurity } from './RazorpaySecurity';
import { PlanAutoRenewal } from './PlanAutoRenewal';
import { billingPlanAction } from '../../lib/billingPlanAction.mjs';
import { BillingHistory } from './BillingHistory';
import { PlanSummaryCard } from './PlanSummaryCard';
import { TenantPanel } from '../../components/ui/TenantPanel';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCircle2, Users, ArrowUpRight, Sprout, UsersRound, Building2, Landmark } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { billingApi, loadRazorpay } from '../../lib/billingApi';
import { Modal } from '../../components/ui/Modal';
import './PlanSubscription.scss';
const planIcons = { starter: Sprout, team: UsersRound, business: Building2, enterprise: Landmark };
const money = amount => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(amount/100);

export function PlanSubscription({ currentUser, onOverview, embedded = false, headerControls, headerDetails }) {
  const [data,setData]=useState(null), [error,setError]=useState(''), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false), [selected,setSelected]=useState(null);
  const [accepted,setAccepted]=useState(false),[confirming,setConfirming]=useState(false),[testPrompt,setTestPrompt]=useState(false);
  const selectedAction=selected && data ? billingPlanAction(selected,data) : null;
  const effectiveSubscription=data?.policy?.subscription || data?.liveSubscription;
  const noPayment=Boolean(selectedAction?.free || data?.policy?.testEnabled);
  function choosePlan(plan){setAccepted(false);setConfirming(false);setError('');setSelected(plan);}
  async function changePlan(){setBusy(true);setError('');try{await billingApi.changePlan({plan_id:selected.id,revision:data.policy.revision,simulation:data.policy.testEnabled,accepted,confirmed:true});setSelected(null);await load();window.dispatchEvent(new Event('pulse-permissions-updated'));}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function toggleTest(){setBusy(true);setError('');try{await billingApi.testMode({enabled:!data.policy.testEnabled,revision:data.policy.revision});setTestPrompt(false);await load();window.dispatchEvent(new Event('pulse-permissions-updated'));}catch(e){setError(e.message);}finally{setBusy(false);}}
  useEffect(() => { if (data) onOverview?.(data); }, [data, onOverview]);
  async function load() { try { setData(await billingApi.overview()); } catch(e) {setError(e.message);} }
  useEffect(() => { let alive=true; billingApi.overview().then(value => {if(alive)setData(value);}).catch(e => {if(alive)setError(e.message);}); return () => {alive=false;}; },[]);
  const hasPendingPayment = Boolean(data?.orders.some(order => ['pending', 'creating'].includes(order.status)) || data?.recurring && ['creating','created','pending'].includes(data.recurring.status));
  useEffect(() => {
    let alive = true, refreshing = false;
    async function refreshOverview() {
      if (document.visibilityState === 'hidden' || refreshing) return;
      refreshing = true;
      try {
        const overview = await billingApi.overview();
        if (alive) setData(overview);
      } catch {
        // Keep the last confirmed subscription during a temporary connection failure.
      } finally { refreshing = false; }
    }
    const interval = hasPendingPayment ? window.setInterval(refreshOverview, 8000) : null;
    window.addEventListener('focus', refreshOverview);
    document.addEventListener('visibilitychange', refreshOverview);
    return () => {
      alive = false;
      if (interval !== null) window.clearInterval(interval);
      window.removeEventListener('focus', refreshOverview);
      document.removeEventListener('visibilitychange', refreshOverview);
    };
  }, [hasPendingPayment]);
  async function reconcile(id) {setBusy(true);setError('');try {const result=await billingApi.reconcile(id);setNotice(result.pending?'':'Payment verified. Your subscription is active.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function checkout() {
    if (busy) return;
    setBusy(true);setError('');setNotice('');
    try {
      const Checkout=await loadRazorpay();
      const order=await billingApi.create(selected.id,{accepted,confirmed:confirming});
      setSelected(null); await load();
      let confirming=false;
      const instance=new Checkout({key:order.key_id,order_id:order.provider_order_id,amount:order.amount,currency:order.currency,name:'NextHR',description:`${order.plan_name} - one monthly term`,theme:{color:'#527357'},prefill:{name:currentUser.name || currentUser.username,email:currentUser.email || ''},
        handler: async response => { confirming=true;setError('');try {await billingApi.verify({purchase_id:order.id,...response});setNotice('Payment verified. Your subscription is active.');await load();}catch(e){setError(`${e.message} Use Check payment below to recover this purchase without paying again.`);}finally{setBusy(false);}},
        modal:{ondismiss:() => {if(!confirming){setBusy(false);setNotice('Checkout closed. Your purchase remains available below to resume or check payment.');}}}
      });
      instance.on('payment.failed',() => setError('Payment attempt failed. Retry in checkout or close it; no subscription is activated until payment is verified.'));
      instance.open();
    } catch(e) {setError(e.message);setBusy(false);await load();}
  }
  return <section className="billing-section" aria-label="Plan and subscription">

    {error && <p className="ws-error" role="alert">{error}</p>}{notice && <p className="ws-notice" role="status">{notice}</p>}
    {embedded ? <>{headerControls && createPortal(<div className="billing-renewal-controls">{data && <Button variant={data.policy?.testEnabled?"colored":"outline"} size="sm" aria-pressed={Boolean(data.policy?.testEnabled)} onClick={()=>setTestPrompt(true)} disabled={busy}>{data.policy?.testEnabled?"Test mode on":"Test mode"}</Button>}</div>,headerControls)}{headerDetails && data && !data.policy?.testEnabled && createPortal(<PlanAutoRenewal compact overview={data} currentUser={currentUser} busy={busy} onBusyChange={setBusy} onRefresh={load} />,headerDetails)}</> : <PlanSummaryCard plain overview={data} subtitle="Manage your subscription, workspace capacity and payments." controls={<div className="billing-renewal-controls">{data && <Button variant={data.policy?.testEnabled?"colored":"outline"} size="sm" aria-pressed={Boolean(data.policy?.testEnabled)} onClick={()=>setTestPrompt(true)} disabled={busy}>{data.policy?.testEnabled?"Test mode on":"Test mode"}</Button>}</div>}>{data && !data.policy?.testEnabled && <PlanAutoRenewal overview={data} currentUser={currentUser} busy={busy} onBusyChange={setBusy} onRefresh={load} />}</PlanSummaryCard>}
    {data && <>
      <div className="billing-comparison-heading"><h3>Compare plans</h3><p>Monthly pricing, with your company Super Admin included.</p></div>
      <div className="billing-plans">{data.plans.map(plan => {
        const action = billingPlanAction(plan,data);
        const current=effectiveSubscription?.plan_id===plan.id && (data.policy?.testEnabled || effectiveSubscription.ends_at>new Date().toISOString());
        return <TenantPanel headingLevel={3} title={plan.name} icon={planIcons[plan.id] || Building2} subtitle={plan.description} className={`billing-plan billing-plan--${plan.id} ${current?'billing-plan--current':''}`} key={plan.id} controls={current ? <span className="billing-plan-badge"><CheckCircle2 size={13} aria-hidden="true" />{data.policy?.testEnabled?"Test plan":"Active plan"}</span> : plan.id==='business' ? <span className="billing-plan-badge">More room to grow</span> : null}>
          <div className="billing-plan-body"><div className="billing-price">{plan.amount?money(plan.amount):'Custom'}{Boolean(plan.amount) && <small>/ month</small>}</div><small className="billing-tax">{plan.amount?'Monthly subscription':'Tailored to your company'}</small><ul><li><Users size={15} aria-hidden="true"/>{plan.employee_limit?`Up to ${plan.employee_limit} active employees`:'Custom employee capacity'}</li><li><Check size={15} aria-hidden="true"/>{plan.dashboard_limit?`${plan.dashboard_limit} additional dashboard users`:'Custom dashboard-user limit'}</li><li><Check size={15} aria-hidden="true"/>Company Super Admin included</li>{(PLAN_HIGHLIGHTS[plan.id] || []).map(feature=><li key={feature}><Check size={15} aria-hidden="true"/>{feature}</li>)}<li><Check size={15} aria-hidden="true"/>Page-level access controls</li></ul><Button disabled={busy || action.disabled} title={action.reason} onClick={() => choosePlan(plan)} variant="colored" type="button" endIcon={ArrowUpRight}>{action.label}</Button></div>
        </TenantPanel>;
      })}</div>
      {data.policy?.testEnabled && <p className="ws-notice" role="status">Test mode applies plan limits and features to this workspace. No payment is taken. Turn it off to restore your paid plan.</p>}
      <RazorpaySecurity />
      <BillingHistory orders={data.orders} plans={data.plans} busy={busy} checkoutEnabled={data.checkoutEnabled} onCheckPayment={reconcile} />
    </>}
    {selected && <Modal isOpen className={`billing-plan--${selected.id}`} title={!selected.amount?'Enterprise plan':confirming?'Confirm plan change':noPayment?'Review plan change':'Review purchase'} subtitle={selected.amount?'Review capacity, included features and billing terms.':undefined} busy={busy} onClose={()=>setSelected(null)} footer={selected.amount?<div className="billing-payment-footer">{noPayment?<span className="billing-payment-eyebrow">{data.policy?.testEnabled?'Test mode ? No payment':'No charge for this downgrade'}</span>:<RazorpaySecurity />}<div>{confirming && <Button variant="outline" disabled={busy} onClick={()=>setConfirming(false)}>Back</Button>}<Button disabled={busy || !accepted} loading={busy} onClick={()=>confirming?(noPayment?changePlan():checkout()):setConfirming(true)} variant="colored" endIcon={ArrowUpRight}>{!confirming?'Continue':noPayment?'Confirm change':'Confirm & pay'}</Button></div></div>:undefined}>
      {selected.amount?<div className="billing-purchase-review">
        <div className="billing-purchase-summary"><div><span className="billing-payment-eyebrow">Your selected plan</span><strong>{selected.name}</strong></div><div><span className="billing-payment-eyebrow">Due today</span><strong className="billing-payment-total">{money(noPayment?0:selected.amount)}</strong><small>{noPayment?'No payment required':'One monthly term'}</small></div></div>
        <dl className="billing-purchase-limits"><div><dt><Users size={15} aria-hidden="true" />Active employees</dt><dd>Up to {selected.employee_limit}</dd></div><div><dt><UsersRound size={15} aria-hidden="true" />Additional dashboard users</dt><dd>{selected.dashboard_limit}</dd></div></dl>
        <div className="billing-purchase-terms"><h3>Included features</h3>{(PLAN_HIGHLIGHTS[selected.id] || []).map(feature=><p key={feature}>{feature}</p>)}</div>
        <div className="billing-purchase-terms"><h3>{confirming?'Before you confirm':'Plan terms'}</h3><p>{data.policy?.testEnabled?'This changes the workspace test plan without charging or replacing your paid subscription.':selectedAction?.free?'This downgrade is free and takes effect immediately. Your current expiry date stays the same. Upgrading again requires payment.':effectiveSubscription?.plan_id===selected.id?'One calendar month is added to your current expiry date. No automatic recurring charge.':'Your new plan starts after verified payment. Unused time on the current plan is not credited or refunded.'}</p><p>Only the first {selected.employee_limit} active employees and {selected.dashboard_limit} dashboard users, ordered by employee code, can use the workspace. Extra records are retained but disabled. Features outside this plan become unavailable.</p></div>
        {confirming?<p className="ws-notice" role="status">{noPayment?'Confirm to apply these access changes now.':'Confirm to open Razorpay and pay for this plan. Changes apply only after payment is verified.'}</p>:<label className="billing-renewal-consent"><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)} /><span>I accept the plan terms above, including the billing conditions and changes to employee and feature access.</span></label>}
        {error && <p className="ws-error" role="alert">{error}</p>}
      </div>:<div className="ws-form"><p className="ws-hint">Enterprise capacity and pricing require a custom agreement. Contact your NextHR platform owner with your requirements.</p></div>}
    </Modal>}
    {testPrompt && <Modal isOpen title={data.policy?.testEnabled?'Turn off test mode?':'Enable workspace test mode?'} busy={busy} onClose={()=>setTestPrompt(false)} footer={<Button variant="colored" disabled={busy} loading={busy} onClick={toggleTest}>{data.policy?.testEnabled?'Restore paid plan':'Enable test mode'}</Button>}><p className="ws-hint">{data.policy?.testEnabled?'This restores the features and capacity of your paid subscription.':'Test plan switching without payment. Changes affect features and employee access for everyone in this company. Your paid subscription, payment history and renewal mandate stay unchanged.'}</p>{error && <p className="ws-error" role="alert">{error}</p>}</Modal>}

  </section>;
}
