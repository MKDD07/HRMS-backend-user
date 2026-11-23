import { mkdir, writeFile } from 'node:fs/promises';
import { createCanvas, loadImage, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { jsPDF } from 'jspdf';
import { buildBillingReceipt } from '../src/lib/billingReceipt.mjs';

globalThis.DOMMatrix=DOMMatrix;globalThis.ImageData=ImageData;globalThis.Path2D=Path2D;
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
let logo=null;
for(const path of ['branding/default/logo']) {
  const response=await fetch('https://hrms-api.mkmkataria07.workers.dev/api/v1/'+path,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)continue;
  const image=await loadImage(Buffer.from(await response.arrayBuffer()));
  const canvas=createCanvas(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);
  logo={data:canvas.toDataURL('image/png'),width:image.width,height:image.height};break;
}
if(!logo)throw new Error('Saved branding could not be loaded.');
const purchase={id:'fc47adff-8429-4dbe-8f68-0d8d7af5d813',receipt_available:true,company_name:'AsterNova Technologies',plan_name:'Business',mode:'live',amount:100,currency:'INR',status:'activated',provider_payment_id:'pay_U0PyW9YyDj1PjV',provider_order_id:'order_preview_reference',created_at:'2026-11-15T10:27:18.525Z',activated_at:'2026-11-15T10:27:56.260Z',term_starts_at:'2026-11-15T10:27:56.260Z',term_ends_at:'2026-12-15T10:27:56.260Z',employee_limit:200,dashboard_limit:10,payment:{method:'upi',status:'captured',amount_refunded:0}};
const doc=buildBillingReceipt(jsPDF,purchase,logo);
const bytes=new Uint8Array(doc.output('arraybuffer'));
await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/billing-receipt-preview.pdf',bytes);
const task=getDocument({data:bytes,useSystemFonts:true});const pdf=await task.promise;
for(let number=1;number<=pdf.numPages;number++){
  const page=await pdf.getPage(number);const viewport=page.getViewport({scale:1.4});
  const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
  await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  await writeFile(`tmp/pdfs/billing-receipt-preview-${number}.png`,canvas.toBuffer('image/png'));
}
console.log(JSON.stringify({pages:pdf.numPages,logoEmbedded:true,preview:'tmp/pdfs/billing-receipt-preview-1.png'}));
await task.destroy();
