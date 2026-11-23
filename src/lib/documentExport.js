import { Document, Packer, Paragraph, TextRun, Header, Footer, HeadingLevel, Table, TableRow, TableCell, ImageRun, ExternalHyperlink, WidthType } from 'docx';
import { documentHtml, fieldLabel, safeImage, safeLink, validateContent } from '../../shared/lifecycleDocuments.mjs';

export function printDocument(content, title, draft) {
  validateContent(JSON.stringify(content));
  const popup = window.open('', '_blank', 'width=900,height=900');
  if (!popup) throw new Error('Allow pop-ups for this site to open the print dialog.');
  popup.opener = null;
  popup.document.open(); popup.document.write(documentHtml(content, title, draft)); popup.document.close();
  return new Promise((resolve, reject) => popup.requestAnimationFrame(async () => {
    try { await Promise.all(Array.from(popup.document.images || []).map(image => image.decode().catch(() => {}))); popup.focus(); popup.print(); resolve(); }
    catch (error) { reject(error); }
  }));
}

export function wordDocument(content, draft = false) {
  validateContent(JSON.stringify(content));
  const numbering = [];
  const image = attrs => new ImageRun({ type: attrs.src.startsWith('data:image/png') ? 'png' : 'jpg', data: Uint8Array.from(atob(attrs.src.split(',')[1]), char => char.charCodeAt(0)), transformation: { width: Number(attrs.width) || 140, height: Number(attrs.height) || 80 } });
  function runs(node) {
    if (node.type === 'image') return safeImage(node.attrs?.src) ? [image(node.attrs)] : [];
    if (node.type === 'hardBreak') return [new TextRun({ break: 1 })];
    if (node.type === 'text' || node.type === 'field') {
      const style = node.marks?.find(mark => mark.type === 'textStyle')?.attrs || {};
      const run = new TextRun({ text: node.type === 'field' ? node.attrs.value || `[${fieldLabel(node.attrs.key)}]` : node.text, bold: node.marks?.some(m => m.type === 'bold'), italics: node.marks?.some(m => m.type === 'italic'), strike: node.marks?.some(m => m.type === 'strike'), underline: node.marks?.some(m => m.type === 'underline') ? {} : undefined, font: style.fontFamily || undefined, size: style.fontSize ? Math.round(parseFloat(style.fontSize) * 1.5) : undefined, color: /^#[0-9a-f]{6}$/i.test(style.color) ? style.color.slice(1) : undefined, shading: /^#[0-9a-f]{6}$/i.test(style.backgroundColor) ? { fill: style.backgroundColor.slice(1) } : undefined });
      const link = node.marks?.find(mark => mark.type === 'link');
      return [link && safeLink(link.attrs?.href) ? new ExternalHyperlink({ children: [run], link: link.attrs.href }) : run];
    }
    return (node.content || []).flatMap(runs);
  }
  function blocks(node, list = null, depth = 0) {
    if (node.type === 'pageBreak') return [new Paragraph({ pageBreakBefore: true })];
    if (node.type === 'table') return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: node.content.map(row => new TableRow({ children: row.content.map(cell => { const children = cell.content.flatMap(child => blocks(child)); return new TableCell({ children: children.length ? children : [new Paragraph('')], columnSpan: cell.attrs?.colspan || 1, rowSpan: cell.attrs?.rowspan || 1, shading: cell.type === 'tableHeader' ? { fill: 'F1F5F9' } : undefined }); }) })) })];
    if (['bulletList','orderedList'].includes(node.type)) {
      const reference = 'list-' + numbering.length;
      if (node.type === 'orderedList') numbering.push({ reference, levels: Array.from({ length: 9 }, (_, level) => ({ level, format: 'decimal', text: `%${level + 1}.`, start: Number(node.attrs?.start) || 1, alignment: 'left' })) });
      return node.content.flatMap(child => blocks(child, { type: node.type, reference }, list ? Math.min(depth + 1, 8) : depth));
    }
    if (node.type === 'listItem') return (node.content || []).flatMap((child, index) => blocks(child, index === 0 || ['bulletList','orderedList'].includes(child.type) ? list : null, depth));
    if (node.type === 'doc' || node.type === 'blockquote') return (node.content || []).flatMap(child => blocks(child, list, depth));
    if (node.type === 'horizontalRule') return [new Paragraph({ border: { bottom: { color: 'CBD5E1', size: 6, style: 'single' } } })];
    return [new Paragraph({ children: runs(node), alignment: node.attrs?.textAlign === 'justify' ? 'both' : node.attrs?.textAlign || undefined, heading: node.type === 'heading' ? [HeadingLevel.HEADING_1,HeadingLevel.HEADING_2,HeadingLevel.HEADING_3][Math.min(2, Math.max(0,(node.attrs?.level || 1)-1))] : undefined, ...(list?.type === 'bulletList' ? { bullet: { level: depth } } : list ? { numbering: { reference: list.reference, level: depth } } : {}), spacing: { after: 160 } })];
  }
  const brand = content.branding || {};
  const asset = key => brand[key] ? [new Paragraph({ children: [image({ ...brand[key], width: Math.min(140, brand[key].width) })] })] : [];
  const headers = [...asset('logo'), ...blocks(content.header), ...(brand.company_address ? [new Paragraph(brand.company_address)] : [])];
  const footers = [...asset('signature'), ...blocks(content.footer), ...(brand.signatory_role ? [new Paragraph(brand.signatory_role)] : [])];
  const children = [...(draft ? [new Paragraph('DRAFT — pending HR review')] : []), ...blocks(content.body)];
  return new Document({ numbering: { config: numbering }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, headers: { default: new Header({ children: headers }) }, footers: { default: new Footer({ children: footers }) }, children }] });
}
export async function downloadWord(content, title, draft) {
  const url = URL.createObjectURL(await Packer.toBlob(wordDocument(content, draft)));
  const link = document.createElement('a'); link.href = url; link.download = (title.replace(/[^a-z0-9 _-]/gi, '').slice(0,100) || 'Document') + '.docx'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
