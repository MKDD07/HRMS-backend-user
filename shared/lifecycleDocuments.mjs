import { PREMADE_LETTERS } from './premadeLetters.mjs';
export const DOCUMENT_TYPES = {
  onboarding: [
    ['joining', 'Joining letter', 'We welcome {{employee_name}} as {{designation}} in {{department}}, joining on {{joining_date}}.\nReporting manager: {{manager}}.\nPlease complete the joining checklist and acknowledge receipt of company policies.'],
    ['appointment', 'Appointment letter', 'Dear {{employee_name}},\nYour appointment as {{designation}} takes effect on {{joining_date}}.\nCompensation and benefits: {{compensation}}.\nWorking hours and location: {{work_terms}}.\nProbation review date: {{probation_end_date}}.\nNotice and other agreed terms: {{employment_terms}}.'],
    ['scope', 'Scope of work', 'Employee: {{employee_name}}\nRole: {{designation}} / {{department}}\nResponsibilities: {{responsibilities}}\nDeliverables and review criteria: {{deliverables}}\nReporting manager: {{manager}}'],
    ['request', 'Document submission request', 'Dear {{employee_name}},\nPlease submit the documents applicable to your role by {{submission_deadline}}.\nIdentity and address evidence: {{identity_requirements}}\nEducation and prior employment evidence: {{qualification_requirements}}\nPayroll information: {{payroll_requirements}}\nSubmission instructions: {{submission_instructions}}'],
    ['confidentiality', 'Confidentiality agreement', 'Employee: {{employee_name}}\nProtected information and permitted use: {{confidentiality_terms}}\nDuration and return of information: {{return_terms}}\nEmployee acknowledgement: {{acknowledgement}}'],
    ['policy', 'Policy acknowledgement', 'Employee: {{employee_name}}\nPolicies and versions supplied: {{policy_list}}\nI acknowledge receipt of the listed policies.\nEmployee signature and date: {{employee_signature}}'],
    ['probation', 'Probation review', 'Employee: {{employee_name}}\nJoining date: {{joining_date}}\nProbation ends: {{probation_end_date}}\nPerformance assessment: {{assessment}}\nManager recommendation: {{recommendation}}\nHR decision and effective date: {{decision}}'],
    ['confirmation', 'Probation confirmation letter', 'Dear {{employee_name}},\nFollowing the approved probation review, your employment is confirmed effective {{effective_date}}.\nRole: {{designation}}\nApproved terms: {{confirmation_terms}}'],
    ['extension', 'Probation extension letter', 'Dear {{employee_name}},\nFollowing your probation review, the revised end date is {{revised_end_date}}.\nReason and improvement objectives: {{extension_reason}}\nSupport and next review: {{review_plan}}']
  ],
  offboarding: [
    ['resignation', 'Resignation acknowledgement', 'Dear {{employee_name}},\nWe acknowledge your resignation received on {{notice_date}}.\nYour planned last working date is {{last_working_date}}.\nPlease coordinate handover and clearance with {{manager}}.'],
    ['handover', 'Handover and asset return', 'Employee: {{employee_name}}\nLast working date: {{last_working_date}}\nWork and knowledge transfer: {{handover_details}}\nAssets and access to return: {{assets}}\nReceiving colleague and acknowledgement: {{recipient}}'],
    ['clearance', 'Exit clearance', 'Employee: {{employee_name}}\nDepartment clearance: {{department_clearance}}\nIT and asset clearance: {{it_clearance}}\nPayroll and settlement review: {{settlement_review}}\nApproving officer: {{approver}}'],
    ['experience', 'Experience letter', 'This records the employment of {{employee_name}} as {{designation}} in {{department}} from {{joining_date}} to {{last_working_date}}.\nResponsibilities and verified service details: {{service_details}}'],
    ['relieving', 'Relieving letter', 'Dear {{employee_name}},\nFollowing approval of your exit clearance, your last working date is {{last_working_date}}.\nHandover and release terms: {{release_terms}}\nWe wish you well in your future endeavours.']
  ]
};
for (const entry of DOCUMENT_TYPES.onboarding) if (PREMADE_LETTERS[entry[0]]) entry[2] = PREMADE_LETTERS[entry[0]];
export const fieldLabel = key => ({ annual_ctc: 'Annual CTC (₹)', employee_id: 'Employee ID', hr_email: 'HR email', hr_phone: 'HR phone', signatory: 'Authorized signatory', signatory_role: 'Signatory designation' })[key] || key.replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
export function inlineContent(text) {
  return String(text).split(/(\*\*.*?\*\*)/g).filter(Boolean).flatMap(part => {
    const bold = part.startsWith('**') && part.endsWith('**');
    const value = bold ? part.slice(2, -2) : part;
    return value.split(/(\{\{\w+\}\})/g).filter(Boolean).map(piece => /^\{\{\w+\}\}$/.test(piece) ? { type: 'field', attrs: { key: piece.slice(2, -2), value: '', label: fieldLabel(piece.slice(2, -2)) } } : { type: 'text', text: piece, ...(bold ? { marks: [{ type: 'bold' }] } : {}) });
  });
}
const paragraph = text => ({ type: 'paragraph', content: inlineContent(text) });
export function markdownBlocks(text) {
  const nodes = [], lines = String(text).split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line === '---') continue;
    if (line.startsWith('|')) {
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        const cells = lines[index].trim().slice(1, -1).split('|').map(cell => cell.trim()); index++;
        if (cells.every(cell => /^:?-+:?$/.test(cell))) continue;
        rows.push({ type: 'tableRow', content: cells.map(cell => ({ type: rows.length ? 'tableCell' : 'tableHeader', attrs: { colspan: 1, rowspan: 1 }, content: [paragraph(cell)] })) });
      }
      index--; nodes.push({ type: 'table', content: rows });
    } else if (line.startsWith('- ')) {
      const items = [];
      while (index < lines.length && lines[index].trim().startsWith('- ')) { items.push({ type: 'listItem', content: [paragraph(lines[index].trim().slice(2))] }); index++; }
      index--; nodes.push({ type: 'bulletList', content: items });
    } else if (/^\*\*[^*]+\*\*$/.test(line)) nodes.push({ type: 'heading', attrs: { level: 2 }, content: inlineContent(line.slice(2, -2)) });
    else nodes.push(paragraph(line));
  }
  return nodes.length ? nodes : [paragraph('')];
}
export function defaultContent(title, body) {
  const doc = text => ({ type: 'doc', content: markdownBlocks(text) });
  return { mode: 'premade', header: doc('{{company_name}}'), body: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] }, ...doc(body).content] }, footer: doc('Authorized signatory: {{signatory}}') };
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function probationEnd(person, plan = {}) {
  const p = { ...(person.profile || {}), ...person };
  const explicit = plan.probation_end_date || p.probation_end_date;
  if (explicit) return validDate(explicit) ? explicit : '';
  const joined = plan.start_date || p.date_of_joining || p.joining_date;
  const months = Number(plan.probation_months || p.probation_months);
  if (!validDate(joined) || !Number.isInteger(months) || months < 1 || months > 36) return '';
  const date = new Date(joined + 'T00:00:00Z'), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function mergeContent(content, fields) {
  const visit = node => ({ ...node, ...(node.type === 'field' && Object.hasOwn(fields, node.attrs.key) && fields[node.attrs.key] != null ? { attrs: { ...node.attrs, value: String(fields[node.attrs.key]) } } : {}), ...(node.content ? { content: node.content.flatMap(child => child.type === 'text' && /\{\{\w+\}\}/.test(child.text) ? inlineContent(child.text).map(visit) : [visit(child)]) } : {}) });
  return { ...content, ...Object.fromEntries(['header', 'body', 'footer'].map(key => [key, visit(content[key])])) };
}
export function documentFields(content) {
  const fields = new Map();
  const visit = node => { if (node.type === 'field') fields.set(node.attrs.key, { key: node.attrs.key, label: fieldLabel(node.attrs.key), value: fields.get(node.attrs.key)?.value === '' ? '' : node.attrs.value || '' }); (node.content || []).forEach(visit); };
  ['header', 'body', 'footer'].forEach(key => visit(content[key]));
  return [...fields.values()];
}
export function missingFields(content) { return documentFields(content).filter(field => !field.value.trim()); }
export function hasBodyContent(content) {
  const filled = node => node.type === 'image' || Boolean(node.text?.trim()) || Boolean(node.type === 'field' && node.attrs.value?.trim()) || (node.content || []).some(filled);
  return filled(content.body);
}
export function reusableContent(content) {
  const personal = /^(employee_|joining_date$|probation_end_date$|last_working_date$|notice_date$|letter_date$|reference_number$)/;
  return mergeContent(content, Object.fromEntries(documentFields(content).filter(field => personal.test(field.key)).map(field => [field.key, ''])));
}
export function employeeFields(person = {}, plan = {}, branding = {}) {
  const p = { ...(person.profile || {}), ...person };
  return { ...p, employee_name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || '', employee_id: p.employee_code || p.userid || p.user_id || '', company_name: branding.company_name || p.company_name || '', company_address: branding.company_address || '', signatory: branding.signatory || '', signatory_role: branding.signatory_role || '', joining_date: plan.start_date || p.date_of_joining || p.joining_date || '', probation_end_date: probationEnd(person, plan), probation_months: plan.probation_months || p.probation_months || '', notice_date: plan.start_date || '', last_working_date: plan.due_date || '', letter_date: new Date().toISOString().slice(0, 10) };
}
export function paperCounts(documents) {
  return { pending: documents.filter(doc => !doc.delivery?.id).length, sent: documents.filter(doc => doc.delivery?.id).length, ready: documents.filter(doc => doc.status === 'Finalized' && !doc.delivery?.id).length };
}
export function documentText(content) {
  const text = node => node.type === 'field' ? node.attrs.value || '' : node.text ?? (node.content || []).map(text).join(['doc', 'tableRow', 'table'].includes(node.type) ? '\n' : '');
  return ['header', 'body', 'footer'].map(key => text(content[key])).join('\n');
}
export function validateContent(raw) {
  const content = JSON.parse(raw);
  let count = 0;
  const allowed = ['doc', 'paragraph', 'heading', 'text', 'bulletList', 'orderedList', 'listItem', 'hardBreak', 'horizontalRule', 'blockquote', 'field', 'table', 'tableRow', 'tableCell', 'tableHeader', 'image', 'codeBlock', 'pageBreak'];
  function visit(node, depth = 0) {
    if (!node || typeof node !== 'object' || ++count > 2500 || depth > 15 || !allowed.includes(node.type)) throw new Error('Unsupported document block.');
    if (node.type === 'text' && typeof node.text !== 'string') throw new Error('Invalid text block.');
    if (node.type === 'field' && (!/^[a-zA-Z0-9_]{1,80}$/.test(node.attrs?.key || '') || typeof node.attrs?.value !== 'string' || node.attrs.value.length > 10000)) throw new Error('Invalid letter field.');
    if (node.type === 'image' && !safeImage(node.attrs?.src)) throw new Error('Use an uploaded PNG or JPEG image under 180 KB.');
    if (node.type === 'image' && (!Number.isFinite(Number(node.attrs?.width)) || Number(node.attrs.width) < 1 || Number(node.attrs.width) > 640 || !Number.isFinite(Number(node.attrs?.height)) || Number(node.attrs.height) < 1 || Number(node.attrs.height) > 900)) throw new Error('Image dimensions are invalid.');
    if (node.marks && (!Array.isArray(node.marks) || node.marks.some(mark => !['bold', 'italic', 'strike', 'underline', 'textStyle', 'link', 'code'].includes(mark.type)))) throw new Error('Unsupported text format.');
    if (node.marks?.some(mark => mark.type === 'link' && !safeLink(mark.attrs?.href))) throw new Error('Links must use HTTPS, HTTP, or mailto.');
    if (node.type === 'table' && (!node.content?.length || node.content.length > 100 || node.content.some(row => row.type !== 'tableRow'))) throw new Error('Invalid table.');
    if (node.type === 'tableRow' && (!node.content?.length || node.content.length > 20 || node.content.some(cell => !['tableCell', 'tableHeader'].includes(cell.type)))) throw new Error('Invalid table row.');
    if (['tableCell', 'tableHeader'].includes(node.type) && ['colspan', 'rowspan'].some(key => node.attrs?.[key] != null && (!Number.isInteger(node.attrs[key]) || node.attrs[key] < 1 || node.attrs[key] > 20))) throw new Error('Invalid table cell span.');
    if (node.content) { if (!Array.isArray(node.content)) throw new Error('Invalid document content.'); node.content.forEach(child => visit(child, depth + 1)); }
  }
  for (const key of ['header', 'body', 'footer']) { if (content?.[key]?.type !== 'doc') throw new Error('Header, body and footer are required.'); visit(content[key]); }
  if (content.mode && !['custom', 'premade'].includes(content.mode)) throw new Error('Invalid document mode.');
  if (content.branding) {
    for (const key of ['company_name', 'company_address', 'signatory', 'signatory_role']) if (content.branding[key] != null && (typeof content.branding[key] !== 'string' || content.branding[key].length > 1000)) throw new Error('Invalid letterhead text.');
    for (const key of ['logo', 'signature']) { const asset = content.branding[key]; if (asset && (!safeImage(asset.src) || !Number.isFinite(asset.width) || asset.width < 20 || asset.width > 140 || !Number.isFinite(asset.height) || asset.height < 1 || asset.height > 280)) throw new Error('Logo and signature must be uploaded images, at most 140px wide.'); }
  }
  return content;
}
export const safeImage = value => typeof value === 'string' && value.length <= 240000 && /^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/]+={0,2}$/.test(value);
export const safeLink = value => typeof value === 'string' && /^(https?:\/\/|mailto:)[^\s<>"']+$/i.test(value);
export function textStyle(attrs = {}) {
  return Object.entries(attrs).flatMap(([key, value]) => {
    if (['color', 'backgroundColor'].includes(key) && /^(#[0-9a-f]{3,8}|[a-z]{1,20}|rgb\(\d{1,3}, ?\d{1,3}, ?\d{1,3}\))$/i.test(value)) return [[key === 'backgroundColor' ? 'background-color' : 'color', value]];
    if (key === 'fontFamily' && ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'].includes(value)) return [['font-family', value]];
    if (key === 'fontSize' && /^(8|9|10|11|12|14|16|18|20|24|28|32|36|48)px$/.test(value)) return [['font-size', value]];
    return [];
  }).map(([key, value]) => `${key}:${value}`).join(';');
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function documentHtml(content, title, draft = false) {
  function render(node) {
    if (node.type === 'field') return escape(node.attrs.value || `[${fieldLabel(node.attrs.key)}]`);
    if (node.type === 'image') return safeImage(node.attrs?.src) ? `<img src="${node.attrs.src}" alt="${escape(node.attrs.alt || '')}" width="${Math.min(640, Number(node.attrs.width) || 140)}" height="${Math.min(900, Number(node.attrs.height) || 80)}" style="max-width:100%;object-fit:contain">` : '';
    if (node.type === 'text') return (node.marks || []).reduce((value, mark) => { if (mark.type === 'textStyle') return `<span style="${escape(textStyle(mark.attrs))}">${value}</span>`; if (mark.type === 'link' && safeLink(mark.attrs?.href)) return `<a href="${escape(mark.attrs.href)}">${value}</a>`; const tag = { bold: 'strong', italic: 'em', strike: 's', underline: 'u', code: 'code' }[mark.type]; return tag ? `<${tag}>${value}</${tag}>` : value; }, escape(node.text));
    if (node.type === 'hardBreak') return '<br>';
    if (node.type === 'pageBreak') return '<div style="break-before:page;page-break-before:always"></div>';
    if (node.type === 'horizontalRule') return '<hr>';
    const tag = { doc: 'div', paragraph: 'p', heading: `h${Math.min(3, Math.max(1, Number(node.attrs?.level) || 1))}`, bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote', table: 'table', tableRow: 'tr', tableCell: 'td', tableHeader: 'th', codeBlock: 'pre' }[node.type] || 'div';
    const alignment = ['left', 'center', 'right', 'justify'].includes(node.attrs?.textAlign) ? ` style="text-align:${node.attrs.textAlign}"` : '';
    const span = ['td', 'th'].includes(tag) ? ` colspan="${Math.min(20, Number(node.attrs?.colspan) || 1)}" rowspan="${Math.min(20, Number(node.attrs?.rowspan) || 1)}"` : '';
    return `<${tag}${alignment}${span}>${(node.content || []).map(render).join('')}</${tag}>`;
  }
  const brand = content.branding || {};
  const asset = key => brand[key] ? render({ type: 'image', attrs: { ...brand[key], width: Math.min(140, brand[key].width), alt: key === 'logo' ? 'Company logo' : 'Authorized signature' } }) : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>@page{size:A4;margin:20mm}body{font:12pt/1.55 Arial,sans-serif;color:#172033;max-width:170mm;margin:20px auto;padding:0 12px;overflow-wrap:anywhere}header{border-bottom:1px solid #ddd;padding-bottom:12px}footer{border-top:1px solid #ddd;margin-top:30px;padding-top:12px;font-size:10pt}p{white-space:pre-wrap}h1,h2,h3{break-after:avoid}li,tr{break-inside:avoid}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f1f5f9}pre{white-space:pre-wrap}.draft{color:#777;font-size:10pt}</style></head><body>${draft ? '<p class="draft">DRAFT — pending HR review</p>' : ''}<header>${asset('logo')}${render(content.header)}${brand.company_address ? `<p>${escape(brand.company_address)}</p>` : ''}</header><main>${render(content.body)}</main><footer>${asset('signature')}${render(content.footer)}${brand.signatory_role ? `<p>${escape(brand.signatory_role)}</p>` : ''}</footer></body></html>`;
}
