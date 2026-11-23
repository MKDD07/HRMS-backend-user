import { COMPANY_API, companyRequest } from './companyAuth';
const token = () => localStorage.getItem('pulse_hrms_token');
const call = (path, options = {}) => companyRequest(path, { token: token(), ...options });
export const operationsApi = {
  async list(collection) {
    const result = [];
    for (let offset = 0; ; offset += 100) {
      const batch = await call(`/operations/${collection}?offset=${offset}`);
      result.push(...batch); if (batch.length < 100) return result;
    }
  },
  save: (collection, record) => call(`/operations/${collection}${record.id ? '/' + encodeURIComponent(record.id) : ''}`, { method: 'POST', body: JSON.stringify(record) }),
  action: (collection, record, action, values) => call(`/operations/${collection}/${encodeURIComponent(record.id)}/${action}`, { method: 'POST', body: JSON.stringify({ ...values, revision: record.revision }) }),
  people: () => call('/get-all-users'),
  receipts: id => call(`/operations/expenses/${encodeURIComponent(id)}/receipts`),
  uploadReceipt: (id, file) => call(`/operations/expenses/${encodeURIComponent(id)}/receipts?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file }),
  async downloadReceipt(expenseId, receipt) {
    const response = await fetch(`${COMPANY_API}/operations/expenses/${encodeURIComponent(expenseId)}/receipts/${encodeURIComponent(receipt.id)}`, { headers: { Authorization: `Bearer ${token()}` } });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Receipt download failed.');
    const url = URL.createObjectURL(await response.blob()), link = document.createElement('a'); link.href = url; link.download = receipt.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  analytics: (from, to) => call(`/hr-analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  views: () => call('/hr-analytics/views'),
  saveView: (title, from, to) => call('/hr-analytics/views', { method: 'POST', body: JSON.stringify({ title, from, to }) })
};
