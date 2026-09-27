import { companyRequest } from './companyAuth';
const call = (path, body) => companyRequest('/billing/' + path, { token: localStorage.getItem('pulse_hrms_token'), ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
export const billingApi = {
  overview: () => call('overview'),
  create: plan_id => call('orders', { plan_id }),
  verify: body => call('verify', body),
  reconcile: purchase_id => call('reconcile', { purchase_id })
};
let checkoutScript;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!checkoutScript) checkoutScript = new Promise((resolve,reject) => {
    const script=document.createElement('script');
    const failed=() => { clearTimeout(timeout); script.remove(); checkoutScript=null; reject(new Error('Checkout could not load. Check your connection and retry.')); };
    const timeout=setTimeout(failed,15000);
    script.src='https://checkout.razorpay.com/v1/checkout.js'; script.async=true;
    script.onload=() => { clearTimeout(timeout); if(window.Razorpay) resolve(window.Razorpay); else failed(); };
    script.onerror=failed; document.head.appendChild(script);
  });
  return checkoutScript;
}
