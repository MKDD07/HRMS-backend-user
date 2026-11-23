import { COMPANY_API } from './companyAuth.js';

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
  approve: id => json(`/documents/${encodeURIComponent(id)}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
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
  verify: (id, verified) => {
    documentVaultApi.logAudit({ document_id: id, action: verified ? 'VERIFIED' : 'MARKED_REVIEW', target: 'Review Status', detail: `Document verification status changed to ${verified ? 'Verified' : 'Needs review'}` });
    return json(`/documents/${encodeURIComponent(id)}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verified }) });
  },
  async update(id, values) {
    return json(`/documents/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
  },
  async toggleStatus(id, active, title) {
    documentVaultApi.logAudit({ document_id: id, action: active ? 'ENABLED' : 'DISABLED', target: title || 'Document', detail: `Document status switched to ${active ? 'Active / Enabled' : 'Disabled / Inactive'}` });
    try {
      return await json(`/documents/${encodeURIComponent(id)}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: active, active }) });
    } catch {
      return { success: true, data: { id, is_active: active } };
    }
  },
  async logs() {
    try {
      const res = await json('/documents/audit-logs');
      if (Array.isArray(res)) return { success: true, data: res };
    } catch {}
    const local = JSON.parse(localStorage.getItem('pulse_document_audit_logs') || '[]');
    return { success: true, data: local };
  },
  logAudit({ document_id, action, target, detail }) {
    const user = JSON.parse(localStorage.getItem('pulse_hrms_user') || '{}');
    const entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      document_id,
      action: action || 'MODIFIED',
      target: target || 'Document',
      detail: detail || 'Document properties updated.',
      user_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || user.email || 'Admin',
      user_id: user.user_id || user.userid || 'admin',
      ip_address: '127.0.0.1 (Authenticated)',
      timestamp: new Date().toISOString()
    };
    try {
      const existing = JSON.parse(localStorage.getItem('pulse_document_audit_logs') || '[]');
      existing.unshift(entry);
      localStorage.setItem('pulse_document_audit_logs', JSON.stringify(existing.slice(0, 100)));
      // Attempt backend post in background
      request('/documents/audit-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }).catch(() => {});
    } catch {}
    return entry;
  },
  archive: id => {
    documentVaultApi.logAudit({ document_id: id, action: 'ARCHIVED', target: 'Document', detail: 'Document moved to archive / removed from active repository' });
    return json(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async file(doc, signal) {
    const response = await request(`/documents/${encodeURIComponent(doc.id || doc.document_id)}/download`, { signal });
    return response.blob();
  }
};
