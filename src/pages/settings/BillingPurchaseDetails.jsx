import React, { useEffect, useState } from 'react';
import { Download, CreditCard, CalendarDays, UserRound, Hash, ReceiptText, ChevronDown } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { billingApi } from '../../lib/billingApi';
import { billingDetailRows, downloadBillingReceipt, receiptAmount } from '../../lib/billingReceipt.mjs';
import { BillingStatus, billingStatus } from './BillingStatus';
import { RazorpaySecurity } from './RazorpaySecurity';

function DetailSection({ title, icon: Icon, labels, values }) {
  return <section className="billing-payment-section"><h3><Icon size={15} aria-hidden="true" />{title}</h3><dl className="billing-payment-details">{labels.map(label=><div key={label}><dt>{label}</dt><dd>{values[label] || 'Not provided'}</dd></div>)}</dl></section>;
}

export function PaymentDetailsContent({ purchase }) {
  const values=Object.fromEntries(billingDetailRows(purchase));
  const status=billingStatus(purchase);
  return <div className="billing-payment-content">
    <div className="billing-payment-summary"><div className="billing-payment-summary-identity"><span className={`billing-history-symbol billing-history-symbol--${status.tone}`}><ReceiptText size={20} aria-hidden="true" /></span><div><span className="billing-payment-eyebrow">{purchase.source==='complimentary'?'Complimentary access':purchase.status==='activated'?'Amount paid':'Order total'}</span><strong className="billing-payment-total">{receiptAmount(purchase.amount,purchase.currency)}</strong><p>{purchase.plan_name} subscription</p></div></div><div className="billing-payment-summary-status"><BillingStatus purchase={purchase} /><span>{purchase.source==='complimentary'?'No charge was made':status.detail}</span>{purchase.mode==='test' && <span>Sandbox transaction</span>}</div></div>
    <DetailSection title="Payment information" icon={CreditCard} values={values} labels={['Company','Payment method','Activated on','Bank / wallet','Bank reference','Payment status']} />
    <DetailSection title="Subscription" icon={CalendarDays} values={values} labels={['Plan','Term starts','Term ends','Employee capacity','Additional dashboard users']} />
    {purchase.source!=='complimentary' && <DetailSection title="Payer & refunds" icon={UserRound} values={values} labels={['Payer email','Payer phone','Refunded amount','Refund status']} />}
    <details className="billing-payment-references"><summary><Hash size={15} aria-hidden="true" />Transaction references<span>IDs and timestamps</span><ChevronDown className="billing-payment-chevron" size={15} aria-hidden="true" /></summary><dl className="billing-payment-details">{['Receipt reference','Purchase reference','Payment ID','Razorpay order ID','Purchased on','Payment initiated on','Billing mode','Purchase status'].map(label=><div key={label}><dt>{label}</dt><dd>{values[label] || 'Not provided'}</dd></div>)}</dl></details>
  </div>;
}

export function BillingPurchaseDetails({ purchaseId, downloadOnOpen = false, onClose }) {
  const [purchase, setPurchase] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let alive = true;
    billingApi.purchase(purchaseId).then(async result => {
      if (!alive) return;
      setPurchase(result);
      if (downloadOnOpen && result.receipt_available) {
        setDownloading(true);
        try { await downloadBillingReceipt(result); }
        catch { if (alive) setError('Receipt could not be downloaded. Please try again.'); }
        finally { if (alive) setDownloading(false); }
      }
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [purchaseId, downloadOnOpen]);
  async function download() {
    setDownloading(true); setError('');
    try { await downloadBillingReceipt(purchase); }
    catch { setError('Receipt could not be downloaded. Please try again.'); }
    finally { setDownloading(false); }
  }
  return <Modal isOpen title="Payment details" subtitle={purchase ? `${purchase.plan_name} subscription · ${purchase.company_name}` : 'Your purchase and payment record.'} size="lg" onClose={onClose} footer={<div className="billing-payment-footer"><RazorpaySecurity /><div><Button variant="outline" onClick={onClose}>Close</Button>{purchase?.receipt_available && <Button icon={Download} variant="colored" loading={downloading} onClick={download}>Download receipt</Button>}</div></div>}>
    {error && <p className="ws-error" role="alert">{error}</p>}
    {!purchase && !error && <p className="tenant-empty" role="status">Loading payment details...</p>}
    {purchase && <>
      {purchase.payment_unavailable && <p className="ws-notice">Live payment details are temporarily unavailable. Showing the saved activation record; current refund status could not be checked.</p>}
      {purchase.source === 'complimentary' && <p className="ws-notice">Complimentary access. No money was collected and no payment receipt is issued.</p>}
      <PaymentDetailsContent purchase={purchase} />
    </>}
  </Modal>;
}
