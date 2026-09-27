import { companyRequest } from './companyAuth';
const call = (path, options = {}) => companyRequest('/workflows/' + path, { token: localStorage.getItem('pulse_hrms_token'), ...options });
const post = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });
export const workflowApi = {
  configuration: () => call('configuration'),
  directory: () => call('directory'),
  publish: (configuration, revision) => post('configuration', { configuration, revision }),
  preview: body => post('preview', body),
  requests: (view = 'mine', offset = 0) => call(`requests?view=${encodeURIComponent(view)}&offset=${offset}`),
  submit: body => post('requests', body),
  decide: (id, decision, remarks) => post(`requests/${encodeURIComponent(id)}/decision`, { decision, remarks }),
  reassign: (id, body) => post(`requests/${encodeURIComponent(id)}/reassign`, body),
  notifications: () => call('notifications'),
  read: id => post('notifications/read', { id }),
  audit: (offset = 0) => call(`audit?offset=${offset}`)
};
