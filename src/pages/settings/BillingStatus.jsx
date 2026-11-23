import React from 'react';
import { CheckCircle2, Clock3, Gift, LoaderCircle, XCircle, RotateCcw } from 'lucide-react';

export function billingStatus(purchase) {
  if (purchase.source === 'complimentary') return { label: 'Complimentary', tone: 'grant', icon: Gift, detail: 'No payment required' };
  if (purchase.payment?.amount_refunded > 0) return { label: purchase.payment.amount_refunded >= purchase.amount ? 'Refunded' : 'Partially refunded', tone: 'closed', icon: RotateCcw, detail: 'Refund recorded by Razorpay' };
  if (purchase.status === 'activated') return { label: 'Paid', tone: 'paid', icon: CheckCircle2, detail: 'Payment verified' };
  if (purchase.status === 'pending') return { label: 'Awaiting payment', tone: 'pending', icon: Clock3, detail: 'Not yet confirmed' };
  if (purchase.status === 'creating') return { label: 'Preparing', tone: 'pending', icon: LoaderCircle, detail: 'Checkout is being created' };
  return { label: 'Closed', tone: 'closed', icon: XCircle, detail: 'Subscription not activated' };
}

export function BillingStatus({ purchase }) {
  const status=billingStatus(purchase), Icon=status.icon;
  return <span className={`badge billing-history-status billing-history-status--${status.tone}`}><Icon size={13} aria-hidden="true" />{status.label}</span>;
}
