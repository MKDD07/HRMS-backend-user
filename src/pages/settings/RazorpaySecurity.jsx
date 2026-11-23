import React from 'react';
import { LockKeyhole } from 'lucide-react';
import razorpayLogo from '../../assets/razorpay.svg';

export function RazorpaySecurity() {
  return <div className="billing-payment-security"><LockKeyhole size={13} aria-hidden="true" /><span>Secured by</span><img src={razorpayLogo} width="89" height="19" alt="Razorpay" /></div>;
}
