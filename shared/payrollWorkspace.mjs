export function latestSalaryRecords(records = []) {
  const latest = new Map();
  for (const record of [...records].sort((a,b)=>String(b.created_at || '').localeCompare(String(a.created_at || '')))) {
    const key = `${record.year}:${record.month}`;
    if (!latest.has(key)) latest.set(key,{...record.salary,id:record.id,month:record.month,year:String(record.year),status:record.salary_status || 'Draft',pdf_status:record.status});
  }
  return [...latest.values()];
}
export function payrollPaymentState(record, payments = []) {
  const matching = payments.filter(payment => String(payment.year) === String(record.year) && [record.month,String(['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(record.month)+1).padStart(2,'0')].includes(payment.month) && payment.status === 'Recorded');
  const paid = matching.reduce((sum,p)=>sum+Math.max(0,Number(p.amount_paid)||0),0);
  const net = Number(record.monthly_net)||0;
  return {paid,pending:Math.max(0,net-paid),payment_method:matching.map(p=>p.payment_mode).filter(Boolean).join(' / '),payment_reference:matching.map(p=>p.transaction_ref).filter(Boolean).join(' / '),payment_status:paid > 0 ? record.status==='Not started' ? 'Unmatched payment' : paid+0.005 >= net ? 'Paid' : 'Partially paid' : 'Unpaid'};
}
export function payrollReview({employee,record,account,configuration}) {
  const issues=[];
  if (!record || record.status === 'Not started') issues.push('No saved salary draft');
  else if (![record.monthly_net,record.monthly_gross,record.total_deductions].every(value=>Number.isFinite(Number(value)) && Number(value)>=0) || Math.abs(Number(record.monthly_net)-(Number(record.monthly_gross)-Number(record.total_deductions)))>0.005) issues.push('Invalid salary totals');
  const method=account?.preferred_payment_method;
  if (!method) issues.push('Choose a preferred payment method');
  if (['Bank transfer','Net banking'].includes(method) && (!account?.account_holder || !account?.account_no || !account?.bank_name || !account?.ifsc_code)) issues.push('Complete the bank account details');
  if (method==='UPI' && !account?.upi_id) issues.push('Add the UPI ID');
  const assignment=configuration?.assignments?.find(a=>a.userid===employee.userid);
  const group=configuration?.groups?.find(g=>g.id===assignment?.group_id);
  if (!configuration?.templates?.some(t=>t.id===(assignment?.template_id || group?.template_id))) issues.push('Assign an available payslip template');
  return issues;
}
