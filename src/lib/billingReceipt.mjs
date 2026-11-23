export const receiptAmount = (amount, currency = 'INR') => `${currency} ${(Number(amount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = value => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST' : 'Not recorded';

export function billingDetailRows(purchase) {
  const payment = purchase.payment;
  return [
    ['Company', purchase.company_name], ['Plan', purchase.plan_name],
    ['Receipt reference', purchase.receipt_available ? `NHR-${purchase.id}` : 'Not issued'],
    ['Purchase reference', purchase.id], ['Payment ID', purchase.provider_payment_id || 'No payment recorded'],
    ['Razorpay order ID', purchase.provider_order_id || 'Not applicable'],
    ['Billing mode', purchase.mode === 'live' ? 'Live' : 'Sandbox'],
    ['Purchase status', purchase.source === 'complimentary' ? 'Complimentary grant' : purchase.status],
    ['Order total', receiptAmount(purchase.amount, purchase.currency)],
    ['Payment status', payment?.status || (purchase.receipt_available ? 'Captured at activation' : 'Not recorded')],
    ['Payment method', payment?.method?.toUpperCase() || 'Not recorded'],
    ['Bank / wallet', payment?.bank || payment?.wallet || 'Not provided'],
    ['Bank reference', payment?.bank_reference || 'Not provided'],
    ['Payer email', payment?.email || 'Not provided'], ['Payer phone', payment?.contact || 'Not provided'],
    ['Refunded amount', payment ? receiptAmount(payment.amount_refunded, purchase.currency) : 'Not verified'],
    ['Refund status', payment ? payment.refund_status || 'No refund reported' : 'Not verified'],
    ['Purchased on', date(purchase.created_at)], ['Payment initiated on', date(payment?.created_at)],
    ['Activated on', date(purchase.activated_at)], ['Term starts', date(purchase.term_starts_at)], ['Term ends', date(purchase.term_ends_at)],
    ['Employee capacity', String(purchase.employee_limit ?? 'Custom')], ['Additional dashboard users', String(purchase.dashboard_limit ?? 'Custom')],
  ];
}

export function buildBillingReceipt(jsPDF, purchase, logo = null) {
  if (!purchase.receipt_available) throw new Error('A receipt is available only for a verified paid purchase.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ink = [30,43,49], muted = [112,123,129], accent = [27,89,158];
  const text = (value,x,y,size=9,bold=false,color=ink,options={}) => {
    doc.setFont('helvetica',bold?'bold':'normal'); doc.setFontSize(size); doc.setTextColor(...color); doc.text(String(value),x,y,options);
  };
  doc.setFillColor(...accent); doc.rect(18,16,174,1.2,'F');
  if (logo?.data) {
    const scale = Math.min(48/logo.width,18/logo.height);
    doc.addImage(logo.data,'PNG',18,25,logo.width*scale,logo.height*scale);
  } else {
    doc.setFont('helvetica','bold');doc.setFontSize(12);
    text('NextHR',18,34,15,true);
  }
  text('PAYMENT RECEIPT',192,32,17,true,ink,{align:'right'});
  text(purchase.mode==='live'?'SUBSCRIPTION PAYMENT':'SANDBOX / NO REAL PAYMENT',192,40,7.5,false,muted,{align:'right'});
  doc.setFillColor(243,247,252); doc.roundedRect(18,54,174,34,3,3,'F');
  text('AMOUNT PAID',24,64,7.5,true,accent); text(receiptAmount(purchase.amount,purchase.currency),24,77,25,true);
  text(purchase.payment?.amount_refunded>0?'REFUND RECORDED':'PAYMENT CONFIRMED',186,65,8,true,accent,{align:'right'});
  text(purchase.payment?.method?.toUpperCase() || 'Razorpay',186,75,9,false,muted,{align:'right'});
  let y = 99;
  function section(title,fields) {
    if (y>247) {doc.addPage();y=24;}
    text(title.toUpperCase(),18,y,8,true,accent); doc.setDrawColor(221,229,225);doc.line(18,y+3,192,y+3);y+=10;
    for(let i=0;i<fields.length;i+=2) {
      const pair=fields.slice(i,i+2);doc.setFont('helvetica','normal');doc.setFontSize(9);
      const wrapped=pair.map(([,value])=>doc.splitTextToSize(String(value || 'Not provided'),81));
      const height=Math.max(...wrapped.map(lines=>lines.length))*4+8;
      if(y+height>274){doc.addPage();y=24;text(title.toUpperCase()+' / CONTINUED',18,y,8,true,accent);y+=12;}
      pair.forEach(([label],column)=>{const x=18+column*90;text(label,x,y,7.5,false,muted);wrapped[column].forEach((line,index)=>text(line,x,y+5+index*4,9));});
      y+=height;
    }
    y+=4;
  }
  section('Receipt details',[
    ['Billed to',purchase.company_name],['Receipt date',date(purchase.activated_at)],
    ['Receipt reference',`NHR-${purchase.id}`],['Payment ID',purchase.provider_payment_id],
  ]);
  section('Subscription',[
    ['Plan',`${purchase.plan_name} subscription`],['Valid until',date(purchase.term_ends_at)],
  ]);
  if (purchase.payment?.amount_refunded>0) section('Refund',[
    ['Refunded amount',receiptAmount(purchase.payment.amount_refunded,purchase.currency)],
    ['Refund status',purchase.payment.refund_status || 'Refund recorded'],
  ]);
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);doc.setDrawColor(221,229,225);doc.line(18,281,192,281);
    text('NextHR / Payment acknowledgement. Not a tax invoice.',18,287,7,false,muted);
    text(`${page} / ${doc.getNumberOfPages()}`,192,287,7,false,muted,{align:'right'});
  }
  return doc;
}

export async function downloadBillingReceipt(purchase) {
  const { jsPDF } = await import('jspdf');
  const { COMPANY_API } = await import('./companyAuth.js');
  let logo = null;
  const urls = [...new Set(['/api/company-auth/branding/default/logo',`${COMPANY_API}/branding/default/logo`])];
  for (const url of urls) {
    try {
      const response = await fetch(url,{signal:AbortSignal.timeout(10000)});
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/') || blob.size>5*1024*1024) continue;
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1,1000/Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      logo={data:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height};break;
    } catch { /* Try the same default branding endpoint on the configured API. */ }
  }
  buildBillingReceipt(jsPDF, purchase, logo).save(`NextHR-receipt-${purchase.id}.pdf`);
}
