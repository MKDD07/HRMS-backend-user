import { BillingStatus, billingStatus } from './BillingStatus';
import React, { useState } from 'react';
import { BillingPurchaseDetails } from './BillingPurchaseDetails';
import { CreditCard, Download, Eye, ReceiptText, RefreshCw } from 'lucide-react';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { Button } from '../../components/ui/Button';

export function BillingHistory({ orders = [], plans = [], busy = false, checkoutEnabled = false, onCheckPayment }) {
  const [details, setDetails] = useState(null);
  return <TenantPanel title="Billing history" subtitle="Your plan purchases, payments and complimentary access." icon={CreditCard} className="billing-history" controls={<span className="badge billing-history-count">{orders.length === 20 ? 'Latest 20' : `${orders.length} ${orders.length === 1 ? 'record' : 'records'}`}</span>}>
    {!orders.length ? <div className="billing-history-empty"><ReceiptText size={28} aria-hidden="true" /><strong>No billing activity yet</strong><p>Your purchases and plan activations will appear here.</p></div> : <>
      <div className="ws-table-wrap billing-history-scroll">
        <table className="ws-table billing-history-table" aria-label="Recent plan purchases">
          <thead><tr><th scope="col">Purchase</th><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Details &amp; receipt</th></tr></thead>
          <tbody>{orders.map(order => {
            const status = billingStatus(order);
            const planName = plans.find(plan => plan.id === order.plan_id)?.name || order.plan_id;
            const date = new Date(order.created_at);
            const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: order.currency || 'INR', maximumFractionDigits: 2 }).format(order.amount / 100);
            return <tr key={order.id}>
              <td><div className="billing-history-purchase"><span className={`billing-history-symbol billing-history-symbol--${status.tone}`}><ReceiptText size={18} aria-hidden="true" /></span><div><strong>{planName} plan</strong><small className="billing-history-reference" title={order.id}>Reference <code>{order.id.slice(0, 8)}</code><span className="sr-only">Full reference: {order.id}</span></small></div></div></td>
              <td><time dateTime={order.created_at}>{date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</time><small>{date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</small></td>
              <td><strong className="billing-history-amount">{amount}</strong><small>{order.source === 'complimentary' ? 'No charge' : order.status === 'activated' ? 'Paid via Razorpay' : 'Order total'}</small></td>
              <td><BillingStatus purchase={order} /><small>{status.detail}</small></td>
              <td className="billing-history-action"><div className="billing-history-actions">
                <Button variant="outline" size="sm" iconOnly icon={Eye} onClick={() => setDetails({ id: order.id, download: false })} aria-label={`View ${planName} payment details`} title="Payment details" />
                <Button variant="outline" size="sm" iconOnly icon={Download} disabled={order.status !== 'activated' || order.source === 'complimentary'} onClick={() => setDetails({ id: order.id, download: true })} aria-label={`Download ${planName} receipt`} title={order.source === 'complimentary' ? 'No paid receipt for complimentary access' : order.status !== 'activated' ? 'Receipt available after payment confirmation' : 'Download receipt PDF'} />
                {(order.status === 'pending' || order.status === 'creating') && <Button variant="outline" size="sm" iconOnly icon={RefreshCw} disabled={busy || !checkoutEnabled || order.status === 'creating'} onClick={() => onCheckPayment?.(order.id)} aria-label={`Check payment for ${planName}, reference ${order.id.slice(0, 8)}`} title={order.status === 'creating' ? 'Preparing payment — refresh shortly' : 'Check payment'} />}
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </>}
    {details && <BillingPurchaseDetails key={details.id} purchaseId={details.id} downloadOnOpen={details.download} onClose={() => setDetails(null)} />}
  </TenantPanel>;
}
