import { clearImageCache } from './imageCache';
import { companyRequest } from './companyAuth';
const call = (path, options = {}) => companyRequest(path, { token: localStorage.getItem('pulse_hrms_token'), ...options });
export const talentApi = {
  sendOffer: record => call(`/talent/offers/${encodeURIComponent(record.id)}/send`,{method:'POST',body:JSON.stringify({revision:record.revision})}),
  hireOffer: (record,details) => call(`/talent/offers/${encodeURIComponent(record.id)}/hire`,{method:'POST',body:JSON.stringify({...details,revision:record.revision})}),
  activateJoiner: (record,temporary_password) => call(`/talent/onboarding/${encodeURIComponent(record.id)}/activate`,{method:'POST',body:JSON.stringify({revision:record.revision,temporary_password})}),
  audit: (collection,id) => call(`/talent/${collection}/${encodeURIComponent(id)}/audit`),
  generateDocuments: page => call(`/talent/${page}_documents/generate`, { method: 'POST', body: '{}' }),
  sendDocument: (page, record) => call(`/talent/${page}_documents/${encodeURIComponent(record.id)}/send`, { method: 'POST', body: JSON.stringify({ revision: record.revision }) }),
  async list(collection) {
    const result = [];
    for (let offset = 0; ; offset += 100) {
      const rows = await call(`/talent/${collection}?offset=${offset}`);
      result.push(...rows);
      if (rows.length < 100) return result;
    }
  },
  deletionPreview: id => call('/talent/asset_lists/' + encodeURIComponent(id) + '/delete'),
  deleteList: async (id, confirmation) => { const result = await call('/talent/asset_lists/' + encodeURIComponent(id) + '/delete', { method: 'POST', body: JSON.stringify(confirmation) }); clearImageCache(); return result; },
  people: () => call('/get-all-users'),
  save: (collection, record) => call(`/talent/${collection}${record.id ? '/' + encodeURIComponent(record.id) : ''}`, { method: 'POST', body: JSON.stringify(record) })
};
export function downloadTalentCsv(filename, headers, rows) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const csv = [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
