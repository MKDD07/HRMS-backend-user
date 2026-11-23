import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Toggle } from '../../components/ui/Toggle';
import { Modal } from '../../components/ui/Modal';
import { billingApi, loadRazorpay } from '../../lib/billingApi';
import { RazorpaySecurity } from './RazorpaySecurity';

const day = value => value ? new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}) : 'Pending confirmation';
const money = (amount,currency='INR') => new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:2}).format(amount/100);
export function PlanAutoRenewal({ overview, currentUser, busy, onBusyChange, onRefresh, compact = false }) {
  const [modal,setModal]=useState(null),[consent,setConsent]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const subscription=overview.mode==='test'?overview.subscription:overview.liveSubscription;
  const renewal=overview.recurring;
  const open=renewal && !['cancelled','completed','expired','failed'].includes(renewal.status);
  const plan=overview.plans.find(item=>item.id===subscription?.plan_id);
  const amount=open?renewal.amount:plan?.amount,currency=open?renewal.currency:plan?.currency;
  const eligible=subscription && Date.parse(subscription.ends_at)>Date.now()+3600000 && Boolean(plan?.amount);
  if(!subscription)return null;
  async function enable() {
    onBusyChange(true);setError('');setNotice('');
    try {
      const Checkout=await loadRazorpay();
      const result=await billingApi.enableRenewal({plan_id:open?renewal.plan_id:plan.id,amount,currency,accepted:consent});
      setModal(null);await onRefresh();
      if(result.enabled){setNotice('Auto-renewal is already enabled.');onBusyChange(false);return;}
      let confirming=false;
      const instance=new Checkout({key:result.key_id,subscription_id:result.provider_subscription_id,name:'NextHR',description:`${result.plan_name} monthly auto-renewal`,prefill:{name:currentUser.name || currentUser.username,email:currentUser.email || ''},theme:{color:'#527357'},handler:async response=>{
        confirming=true;
        try{const confirmed=await billingApi.verifyRenewal({recurring_id:result.id,...response});setNotice(confirmed.enabled?'Auto-renewal approved. Your next charge is scheduled with Razorpay.':'Mandate approval is still being confirmed. Use the header refresh button.');await onRefresh();}
        catch(e){setError(e.message+' Use the header refresh button before trying again.');}
        finally{onBusyChange(false);}
      },modal:{ondismiss:()=>{if(!confirming){onBusyChange(false);setNotice('Mandate approval was not completed. Finish setup or turn it off below.');onRefresh();}}}});
      instance.on('payment.failed',()=>setError('Mandate authorization failed. No automatic renewal is enabled until Razorpay confirms approval.'));
      instance.open();
    }catch(e){setError(e.message);onBusyChange(false);await onRefresh();}
  }
  async function cancel() {
    onBusyChange(true);setError('');
    try{const result=await billingApi.cancelRenewal(renewal.id);setNotice(result.status==='cancelled'?'Auto-renewal is off. Your already-paid access remains available until expiry.':'Cancellation is awaiting provider confirmation. Use the header refresh button.');setModal(null);await onRefresh();}
    catch(e){setError(e.message);}finally{onBusyChange(false);}
  }
  const status=renewal?.enabled?'Auto-renewal on':open?['pending','halted','paused'].includes(renewal.status)?'Renewal needs attention':'Finish auto-renewal setup':'Auto-renewal off';
  return <div className="billing-renewal">
    <div className="billing-renewal-row"><div><strong><RefreshCw size={15} aria-hidden="true" />{status}</strong><p>{renewal?.enabled?`${money(amount,currency)} / month · Next charge ${day(renewal.next_charge_at || renewal.starts_at)}`:open?'Razorpay has not confirmed a working renewal mandate.':eligible?(compact?`Starts ${day(subscription.ends_at)}`:`Renew ${plan.name} automatically from ${day(subscription.ends_at)}.`):'Your current access ends on '+day(subscription.ends_at)+'.'}</p></div><div className="billing-renewal-controls">
      {open && !renewal.enabled && <Button size="sm" variant="outline" disabled={busy} onClick={()=>{setConsent(false);setModal('enable');}}>Finish setup</Button>}
      {open && !renewal.enabled ? <Button size="sm" variant="fadeout" disabled={busy} onClick={()=>setModal('cancel')}>Turn off</Button> : <Toggle checked={Boolean(renewal?.enabled)} disabled={busy || (!open && (!eligible || !overview.checkoutEnabled))} onChange={checked=>{setConsent(false);setModal(checked?'enable':'cancel');}} aria-label="Automatic monthly plan renewal" />}
    </div></div>
    {!compact && !open && <p className="billing-renewal-hint">Manual renewal becomes available 7 days before expiry. Auto-renewal requires your approval in Razorpay.</p>}
    {!overview.checkoutEnabled && <p className="billing-renewal-hint">{overview.reason}</p>}
    {open && <p className="billing-renewal-hint">The authorized amount is fixed for up to 12 monthly charges. Turn off auto-renewal before changing plans or paying manually.</p>}
    {error && <p className="ws-error" role="alert">{error}</p>}{notice && <p className="ws-notice" role="status">{notice}</p>}
    {modal && <Modal isOpen title={modal==='enable'?'Enable monthly auto-renewal':'Turn off auto-renewal?'} onClose={()=>setModal(null)} busy={busy} footer={<div className="billing-payment-footer"><RazorpaySecurity /><div><Button variant={modal==='enable'?'colored':'danger'} disabled={busy || (modal==='enable'&&!consent)} loading={busy} onClick={modal==='enable'?enable:cancel}>{modal==='enable'?`Authorize ${money(amount,currency)} / month`:'Turn off auto-renewal'}</Button></div></div>}>
      {modal==='enable'?<div className="billing-renewal-setup">
        <div className="billing-renewal-preview"><span className="billing-payment-eyebrow">{open?renewal.plan_name:plan?.name} plan</span><strong className="billing-payment-total">{money(amount,currency)}<small> / month</small></strong><span className="billing-summary-term"><RefreshCw size={13} aria-hidden="true" />First renewal {day(open?renewal.starts_at:subscription.ends_at)}</span></div>
        <p className="ws-hint">Authorize up to 12 monthly payments through Razorpay. You can turn off future renewals here at any time.</p>
        <label className="billing-renewal-consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} /><span>I agree to {money(amount,currency)} per month and authorize recurring payments through Razorpay.</span></label>
        <p className="ws-hint">Your payment method may require an authentication transaction. Authentication alone does not extend your paid plan.</p>
      </div>:<p className="ws-hint">This stops future automatic charges with Razorpay. Your existing paid plan remains valid until {day(subscription.ends_at)}. A charge already being processed may still complete.</p>}
      {error && <p className="ws-error" role="alert">{error}</p>}
    </Modal>}
  </div>;
}
