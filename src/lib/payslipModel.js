export const PAYSLIP_DESIGNS = [
  { id: 'classic', name: 'Classic', description: 'Traditional ruled statement with a centered company header.' },
  { id: 'modern', name: 'Modern', description: 'Bold brand header and a highlighted take-home amount.' },
  { id: 'minimal', name: 'Minimal', description: 'Quiet typography, generous spacing and a compact summary.' }
];
export const EARNINGS = [['basic', 'Basic salary'], ['hra', 'House rent allowance'], ['special_allowance', 'Special allowance'], ['conveyance', 'Conveyance'], ['medical_allowance', 'Medical allowance'], ['bonus_incentive', 'Bonus / incentive']];
export const DEDUCTIONS = [['pf_deduction', 'Provident fund'], ['professional_tax', 'Professional tax'], ['tds_tax', 'Income tax (TDS)']];
export const PAY_MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleString('en', { month: 'long' }));
export function newPayslipTemplate(design = 'classic') {
  return { design, name: '', company_name: '', address: '', registration: '', logo: '', signature: '', signatory: '', signatory_title: 'Authorized signatory', accent: '#4e6940', title: 'Salary payslip', note: 'This statement records salary for {{employee_name}} for {{month}} {{year}}.', footer: 'Confidential: for the named employee only.' };
}
export function textValue(value, max = 200) { return String(value ?? '').trim().slice(0, max); }
export function validateTemplate(input) {
  const template = newPayslipTemplate(input.design);
  if (!PAYSLIP_DESIGNS.some(d => d.id === input.design)) throw new Error('Choose one of the three base designs.');
  for (const key of ['name', 'company_name', 'address', 'registration', 'signatory', 'signatory_title', 'title', 'note', 'footer']) template[key] = textValue(input[key], key === 'footer' ? 200 : ['address', 'note'].includes(key) ? 600 : 120);
  if (!template.name || !template.company_name || !template.title) throw new Error('Template name, company name and title are required.');
  template.accent = /^#[0-9a-f]{6}$/i.test(input.accent) ? input.accent : '#4e6940';
  for (const key of ['logo', 'signature']) {
    const value = input[key] || '';
    if (typeof value !== 'string' || value.length > 700000 || (value && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value))) throw new Error('Use PNG or JPEG images smaller than 500 KB.');
    template[key] = value;
  }
  return template;
}
export function normalizeSalary(input) {
  const record = {};
  for (const [key] of [...EARNINGS, ...DEDUCTIONS]) {
    const amount = Number(input[key] ?? 0);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1e9) throw new Error('Salary amounts must be between 0 and 1,000,000,000.');
    record[key] = Math.round(amount * 100) / 100;
  }
  for (const key of ['custom_earnings', 'custom_deductions']) {
    if (input[key] != null && !Array.isArray(input[key])) throw new Error('Custom components must be a list.');
    if ((input[key] || []).length > 40) throw new Error('Use at most 40 custom components per category.');
    record[key] = (input[key] || []).map(item => {
      const amount = Number(item.amount);
      if (!textValue(item.name) || !Number.isFinite(amount) || amount < 0 || amount > 1e9) throw new Error('Every custom component needs a name and a valid non-negative amount.');
      return { name: textValue(item.name, 100), amount: Math.round(amount * 100) / 100 };
    });
  }
  const cents = n => Math.round(n * 100);
  const total = rows => rows.reduce((sum, item) => sum + cents(item.amount), 0) / 100;
  record.monthly_gross = total([...EARNINGS.map(([key]) => ({ amount: record[key] })), ...record.custom_earnings]);
  record.total_deductions = total([...DEDUCTIONS.map(([key]) => ({ amount: record[key] })), ...record.custom_deductions]);
  record.monthly_net = (cents(record.monthly_gross) - cents(record.total_deductions)) / 100;
  if (record.monthly_net < 0) throw new Error('Deductions cannot exceed earnings.');
  for (const key of ['bank_name', 'bank_account', 'pay_date', 'transaction_ref', 'status']) record[key] = textValue(input[key], 100);
  record.paid_days = input.paid_days === '' || input.paid_days == null ? '' : Number(input.paid_days);
  if (record.paid_days !== '' && (!Number.isFinite(record.paid_days) || record.paid_days < 0 || record.paid_days > 31)) throw new Error('Paid days must be between 0 and 31.');
  return record;
}
export function mergePayslipText(text, employee, month, year) {
  const values = { employee_name: [employee.first_name, employee.last_name].filter(Boolean).join(' ') || employee.userid, employee_id: employee.userid, month, year };
  return String(text || '').replace(/\{\{(employee_name|employee_id|month|year)\}\}/g, (_, key) => String(values[key] ?? ''));
}
