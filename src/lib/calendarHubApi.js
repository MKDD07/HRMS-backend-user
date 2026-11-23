import { companyRequest } from './companyAuth';
const request = (path, options = {}) => companyRequest('/company-calendar' + path, { token: localStorage.getItem('pulse_hrms_token'), ...options });
export const calendarHubApi = {
  configuration: () => request('/configuration'),
  reminders: () => request('/reminders'),
  readReminders: id => request('/reminders/read', { method: 'POST', body: JSON.stringify(id ? { id } : {}) }),
  saveImportantDate: value => request('/important-dates', { method: 'POST', body: JSON.stringify(value) }),
  deleteImportantDate: id => request('/important-dates/' + encodeURIComponent(id), { method: 'DELETE' })
};
