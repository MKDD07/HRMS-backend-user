import { markdownBlocks } from './lifecycleDocuments.mjs';
export function fromDraft(text) {
  const named = text.replace(/\[([^\]]*(?:required|missing)[^\]]*)\]/gi,(_,label)=>'{{'+label.replace(/\b(required|missing)\b/gi,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_')+'}}');
  return {type:"doc",content:markdownBlocks(named)};
}
export function withMissingFields(node) { return node.type==='field' ? {type:'text',text:node.attrs.value || '['+node.attrs.key.replaceAll('_',' ')+' required]'} : {...node,...(node.content?{content:node.content.map(withMissingFields)}:{})}; }
export function artworkNodes(node) { return node.type==='image' ? [node] : (node.content||[]).flatMap(artworkNodes); }
