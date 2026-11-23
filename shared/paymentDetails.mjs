import { validDay } from './overviewModel.mjs';
export const PAYMENT_METHODS = ['Cash', 'Bank transfer', 'Net banking', 'UPI', 'Cheque'];
export function validatePaymentDetails(payment) {
  const fail = message => { throw Object.assign(new Error(message), { status:400 }); };
  if (!payment || !PAYMENT_METHODS.includes(payment.method)) fail('Choose a valid payment method.');
  const fields = ['reference', 'received_by', 'bank_name', 'cheque_date', 'upi_id'];
  const result = {method:payment.method, status:'Recorded'};
  for (const key of fields) { if (payment[key] != null && (typeof payment[key] !== 'string' || payment[key].length > 200)) fail('Invalid payment reference details.'); result[key] = (payment[key] || '').trim(); }
  if (!result.reference) fail(payment.method === 'Cash' ? 'Enter a receipt number.' : 'Enter the payment reference.');
  if (payment.method === 'Cash' && !result.received_by) fail('Enter who received the cash.');
  if (payment.method === 'Cheque' && (!result.bank_name || !validDay(result.cheque_date))) fail('Enter the cheque bank and date.');
  if (!validDay(payment.pay_date)) fail('Enter a valid payment date.');
  result.pay_date = payment.pay_date;
  return result;
}
