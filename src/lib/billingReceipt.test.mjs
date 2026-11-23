import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { billingDetailRows, buildBillingReceipt } from './billingReceipt.mjs';

const purchase = { id: 'purchase-example', receipt_available: true, company_name: 'Example Company', plan_name: 'Business', mode: 'live', amount: 100, currency: 'INR', status: 'activated', provider_payment_id: 'pay_example', provider_order_id: 'order_example', created_at: '2026-11-15T10:27:18Z', activated_at: '2026-11-15T10:27:56Z', term_starts_at: '2026-11-15T10:27:56Z', term_ends_at: '2026-12-15T10:27:56Z', employee_limit: 200, dashboard_limit: 10, payment: { method: 'upi', status: 'captured', bank_reference: 'bank-reference', email: 'payer@example.test', amount_refunded: 0 } };
const doc = buildBillingReceipt(jsPDF, purchase);
const task = getDocument({ data: new Uint8Array(doc.output('arraybuffer')), useSystemFonts: true });
const pdf = await task.promise;
let text = '';
for (let number = 1; number <= pdf.numPages; number++) {
  const page = await pdf.getPage(number);
  text += (await page.getTextContent()).items.map(item => item.str).join(' ');
}
for (const expected of ['PAYMENT RECEIPT', 'Example Company', 'Business', 'INR 1.00', 'pay_example', 'NHR-purchase-example', 'Not a tax invoice']) assert.ok(text.includes(expected), `Missing PDF content: ${expected}`);
for (const excluded of ['order_example','bank-reference','payer@example.test','Payer phone','Employee capacity']) assert.ok(!text.includes(excluded), `Detailed field should remain in the app: ${excluded}`);
assert.ok(billingDetailRows(purchase).some(([label, value]) => label === 'Term ends' && value.includes('Dec')));
assert.throws(() => buildBillingReceipt(jsPDF, { ...purchase, receipt_available: false }), /verified paid purchase/);
await task.destroy();
console.log('Receipt PDF checks passed: readable document, amount, references, payment details, term, and unpaid receipt guard.');
