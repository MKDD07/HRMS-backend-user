import { companyRequest } from './companyAuth';
const call = (path, options = {}) => companyRequest('/workflows/' + path, { token: localStorage.getItem('pulse_hrms_token'), ...options });
const post = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });
export const workflowApi = {
  configuration: () => call('configuration'),
  directory: () => call('directory'),
  publish: (configuration, revision) => post('configuration', { configuration, revision }),
  saveCompanyLeadership: (roles, finalize, revision) => post('company-leadership', { roles, finalize, revision }),
  leadershipLog: () => call('leadership-log'),
  transferDepartment: (userid, department, revision) => post('department-transfer', { userid, department, revision }),
  departmentLifecycle: (name, action, revision) => post('department-lifecycle', { name, action, revision }),
  preview: body => post('preview', body),
  requestPreview: body => post('requests/preview', body),
  requestProfiles: id => call(`requests/${encodeURIComponent(id)}/profiles`),
  leaveTypes: () => call('leave-types'),
  requests: (view = 'mine', offset = 0, kind) => {
    const query = new URLSearchParams({ view, offset });
    if (kind) query.set('kind', kind);
    return call(`requests?${query}`);
  },
  submit: body => post('requests', body),
  deleteRequest: id => post(`requests/${encodeURIComponent(id)}/delete`, {}),
  decide: async (id, decision, remarks) => {
    const result = await post(`requests/${encodeURIComponent(id)}/decision`, { decision, remarks });
    if (result?.status === 'Approved' && result.kind === 'attendance') {
      window.dispatchEvent(new Event('pulse-attendance-corrected'));
    }
    return result;
  },
  reassign: (id, body) => post(`requests/${encodeURIComponent(id)}/reassign`, body),
  notifications: () => call('notifications'),
  read: id => post('notifications/read', { id }),
  audit: (offset = 0) => call(`audit?offset=${offset}`)
};
