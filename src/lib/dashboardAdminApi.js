import { companyRequest } from './companyAuth';
const call = (path, options = {}) => companyRequest(path, { token: localStorage.getItem('pulse_hrms_token'), ...options });
const post = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });
export const dashboardAdminApi = {
  users: () => call('/dashboard-users'),
  saveUser: body => post('/dashboard-users', body),
  configuration: section => call('/dashboard-configuration/' + section),
  saveConfiguration: (section, value, revision) => post('/dashboard-configuration/' + section, { value, revision })
};
