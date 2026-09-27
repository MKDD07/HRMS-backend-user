import { COMPANY_API } from './companyAuth';

async function request(path, options = {}) {
  const token = localStorage.getItem('pulse_hrms_token');
  if (!token) throw new Error('Sign in to access the document vault.');
  const response = await fetch(COMPANY_API + path, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Document service unavailable (${response.status}).`);
  }
  return response;
}
async function json(path, options) {
  const body = await (await request(path, options)).json();
  if (!body.success) throw new Error(body.message || 'Document operation failed.');
  return body.data;
}
async function list(filters) {
  const documents = [];
  for (let offset = 0; ; offset += 100) {
    const query = new URLSearchParams({ ...filters, offset: String(offset) });
    const page = await json(`/documents?${query}`);
    if (!Array.isArray(page)) throw new Error('Invalid document response.');
    documents.push(...page);
    if (page.length < 100) return { success: true, data: documents };
  }
}
export const documentVaultApi = {
  policies: () => list({ scope: 'policies' }),
  employee: userid => list(userid ? { userid } : { scope: 'personnel' }),
  async upload(values, file, userid) {
    if (!(file instanceof File) || !file.size) throw new Error('Choose a file to upload.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Files must be 10 MB or smaller.');
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) if (value != null) form.set(key, String(value));
    if (userid) form.set('userid', userid);
    form.set('file', file);
    return json('/documents', { method: 'POST', body: form });
  },
  verify: (id, verified) => json(`/documents/${encodeURIComponent(id)}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verified }) }),
  archive: id => json(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  async file(doc, signal) {
    const response = await request(`/documents/${encodeURIComponent(doc.id || doc.document_id)}/download`, { signal });
    return response.blob();
  }
};
