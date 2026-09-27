import { jsPDF } from 'jspdf';
import { EARNINGS, DEDUCTIONS, normalizeSalary, mergePayslipText } from './payslipModel.js';

// Shared by the browser preview and server generation; no invented pay or identity values.
export function createPayslipDocument({ employee, salaryRecord, template, month, year }) {
  const record = normalizeSalary(salaryRecord);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const rgb = template.accent.match(/[a-f0-9]{2}/gi).map(hex => parseInt(hex, 16));
  let y = 18;
  const text = (value, x, top, size = 10, bold = false, width = 174) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(value || ''), width);
    doc.text(lines, x, top); return Math.max(1, lines.length) * size * .43;
  };
  const image = (data, x, top, width, height) => {
    if (!data) return;
    const props = doc.getImageProperties(data);
    if (props.width > 4096 || props.height > 4096) throw new Error('Logo and signature images must be at most 4096 pixels per side.');
    const ratio = Math.min(width / props.width, height / props.height);
    doc.addImage(data, props.fileType, x, top, props.width * ratio, props.height * ratio);
  };
  const money = n => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nextPage = (height = 12) => { if (y + height > 267) { doc.addPage(); y = 20; doc.setTextColor(75); y += text(`${template.company_name} / ${month} ${year} / continued`, 18, y, 9) + 7; } };
  doc.setTextColor(40, 50, 35);
  if (template.design === 'modern') {
    doc.setFillColor(...rgb); doc.rect(0, 0, 210, 12, 'F'); y = 24;
  } else if (template.design === 'classic') { doc.setDrawColor(...rgb); doc.rect(12, 12, 186, 273); }
  if (template.logo) image(template.logo, 18, y, 25, 18);
  const headerX = template.logo ? 50 : 18;
  y += text(template.company_name, headerX, y + 4, template.design === 'minimal' ? 17 : 15, true, 192 - headerX) + 4;
  if (template.address) y += text(template.address, headerX, y, 9, false, 192 - headerX) + 3;
  if (template.registration) y += text(template.registration, headerX, y, 8, false, 192 - headerX) + 3;
  y = Math.max(y + 4, 45);
  doc.setDrawColor(220, 228, 213); doc.line(18, y, 192, y); y += 9;
  doc.setTextColor(...rgb); y += text(template.title, 18, y, 14, true) + 3;
  doc.setTextColor(80); y += text(`${month} ${year} / ${employee.userid}`, 18, y, 9) + 7;
  const name = [employee.first_name, employee.last_name].filter(Boolean).join(' ') || employee.userid;
  for (const [label, value] of [['Employee', name], ['Department / role', [employee.department, employee.designation].filter(Boolean).join(' / ')], ['Paid days / payment date', [record.paid_days === '' ? '' : `${record.paid_days} days`, record.pay_date].filter(Boolean).join(' / ')], ['Bank / account', [record.bank_name, record.bank_account ? `Ending ${record.bank_account.slice(-4)}` : ''].filter(Boolean).join(' / ')]]) {
    if (!value) continue;
    nextPage(14); doc.setTextColor(115); text(label, 18, y, 8, false, 43); doc.setTextColor(45); y += Math.max(6, text(value, 66, y, 9, false, 126) + 2);
  }
  y += 5;
  for (const [title, fields, custom, subtotal] of [['Earnings', EARNINGS, record.custom_earnings, record.monthly_gross], ['Deductions', DEDUCTIONS, record.custom_deductions, record.total_deductions]]) {
    nextPage(28); doc.setFillColor(243, 247, 238); doc.rect(18, y - 4, 174, 9, 'F'); doc.setTextColor(...rgb); text(title, 21, y + 2, 10, true); doc.setFontSize(8); doc.text('INR', 188, y + 2, { align: 'right' }); y += 10;
    for (const row of [...fields.map(([key, label]) => ({ name: label, amount: record[key] })), ...custom]) {
      const lines = doc.splitTextToSize(row.name, 125); const height = Math.max(6, lines.length * 4 + 2); nextPage(height);
      doc.setTextColor(60); text(row.name, 21, y, 9, false, 125); doc.setFontSize(9); doc.text(money(row.amount), 188, y, { align: 'right' }); y += height;
    }
    nextPage(12); doc.setDrawColor(229); doc.line(18, y - 3, 192, y - 3); text(`Total ${title.toLowerCase()}`, 21, y + 2, 9, true); doc.text(money(subtotal), 188, y + 2, { align: 'right' }); y += 12;
  }
  nextPage(25);
  if (template.design === 'modern') { doc.setFillColor(...rgb); doc.rect(18, y - 4, 174, 16, 'F'); doc.setTextColor(255); } else { doc.setTextColor(...rgb); doc.setDrawColor(...rgb); doc.line(18, y - 4, 192, y - 4); }
  text('NET PAY / INR', 22, y + 5, 10, true); doc.setFontSize(15); doc.text(money(record.monthly_net), 188, y + 5, { align: 'right' }); y += 18; doc.setTextColor(95);
  const note = mergePayslipText(template.note, employee, month, year);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const noteHeight = doc.splitTextToSize(note, 96).length * 4;
  const signatureHeight = (template.signature ? 19 : 0) + (template.signatory ? doc.splitTextToSize(template.signatory, 72).length * 5 + 6 : 0);
  if (noteHeight > 220) throw new Error('The personalized statement note is too long. Shorten the note.');
  nextPage(Math.max(noteHeight + 5, signatureHeight + 8));
  if (note) text(note, 18, y, 9, false, 96);
  let signY = y;
  if (template.signature) { image(template.signature, 145, signY, 42, 16); signY += 19; }
  if (template.signatory) signY += text(template.signatory, 120, signY, 10, true, 72) + 2;
  if (template.signatory || template.signature) text(template.signatory_title, 120, signY, 8, false, 72);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setTextColor(125); doc.setFontSize(7);
    const footer = doc.splitTextToSize(mergePayslipText(template.footer, employee, month, year), 150);
    if (footer.length > 3) throw new Error('The personalized footer is too long. Shorten it to three lines.');
    doc.text(footer, 18, 277); doc.text(`${page} / ${pages}`, 192, 282, { align: 'right' });
  }
  return doc;
}
