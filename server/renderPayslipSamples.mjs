import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { createPayslipDocument } from '../src/lib/payslipDocument.js';
import { newPayslipTemplate, PAYSLIP_DESIGNS } from '../src/lib/payslipModel.js';
globalThis.DOMMatrix = DOMMatrix; globalThis.ImageData = ImageData; globalThis.Path2D = Path2D;
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
await mkdir('tmp/pdfs', { recursive: true });
const logo = createCanvas(180, 70), context = logo.getContext('2d'); context.fillStyle = '#4e6940'; context.fillRect(0, 0, 180, 70); context.fillStyle = 'white'; context.font = 'bold 27px sans-serif'; context.fillText('SAMPLE', 25, 45);
const sign = createCanvas(260, 80), pen = sign.getContext('2d'); pen.fillStyle = '#3e4b35'; pen.font = 'italic 26px serif'; pen.fillText('Sample Signatory', 5, 45);
for (const design of [...PAYSLIP_DESIGNS, { id: 'stress', base: 'modern' }]) {
  const template = { ...newPayslipTemplate(design.base || design.id), name: 'QA only', company_name: 'Sample Company Private Limited', address: 'Sample street address, Business District, City 400001', registration: 'Registration details supplied by company', logo: logo.toDataURL('image/png'), signature: sign.toDataURL('image/png'), signatory: 'Sample Signatory' };
  const pdf = createPayslipDocument({ employee: { userid: 'QA-001', first_name: 'Sample', last_name: 'Employee', department: 'Engineering', designation: 'Software Engineer' }, salaryRecord: { custom_earnings: design.id === 'stress' ? Array.from({ length: 35 }, (_, index) => ({ name: 'QA component ' + index + ' - ' + 'Long benefit description '.repeat(3), amount: index + 1 })) : [], basic: 40000, hra: 18000, special_allowance: 8000, bonus_incentive: 2000, pf_deduction: 4800, professional_tax: 200, tds_tax: 2500, paid_days: 30, pay_date: '2026-09-30', bank_name: 'Sample Bank', bank_account: '1234567890' }, template, month: 'September', year: '2026' });
  const bytes = new Uint8Array(pdf.output('arraybuffer')); await writeFile(`tmp/pdfs/${design.id}.pdf`, bytes);
  const task = getDocument({ data: bytes, useSystemFonts: true }); const document = await task.promise;
  let allText = '';
  if (design.id !== 'stress') assert.equal(document.numPages, 1);
  for (let number = 1; number <= document.numPages; number++) { const page = await document.getPage(number); const content = await page.getTextContent(); for (const item of content.items) { if (item.str) { assert.ok(item.transform[5] >= 25 && item.transform[5] <= page.view[3] - 20, 'PDF text outside page safe area'); allText += item.str + ' '; } } const viewport = page.getViewport({ scale: 1.3 }); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)); await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise; await writeFile(`tmp/pdfs/${design.id}-${number}.png`, canvas.toBuffer('image/png')); }
  assert.ok(allText.includes('60,500.00') || design.id === 'stress');
  if (design.id === 'stress') for (let index = 0; index < 35; index++) assert.ok(allText.includes('QA component ' + index + ' -'));
  console.log(`${design.id}: ${document.numPages} pages`); await task.destroy();
}
