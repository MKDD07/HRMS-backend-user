import { companyRequest } from './companyAuth';

const request = (path, options = {}) => companyRequest('/company-calendar' + path, {
  token: localStorage.getItem('pulse_hrms_token'),
  ...options
});
export const companyCalendarApi = {
  reminders: () => request('/reminders'),
  readReminders: id => request('/reminders/read', { method: 'POST', body: JSON.stringify(id ? { id } : {}) }),
  fetchHolidays: value => request('/holiday-cache', { method: 'POST', body: JSON.stringify(value) }),
  configuration: () => request('/configuration'),
  saveLeaveType: value => request('/leave-types', { method: 'POST', body: JSON.stringify(value) }),
  deleteLeaveType: id => request('/leave-types/' + encodeURIComponent(id), { method: 'DELETE' }),
  saveHoliday: value => request('/holidays', { method: 'POST', body: JSON.stringify(value) }),
  deleteHoliday: id => request('/holidays/' + encodeURIComponent(id), { method: 'DELETE' }),
  saveImportantDate: value => request('/important-dates', { method: 'POST', body: JSON.stringify(value) }),
  deleteImportantDate: id => request('/important-dates/' + encodeURIComponent(id), { method: 'DELETE' }),
  saveGroup: value => request('/groups', { method: 'POST', body: JSON.stringify(value) }),
  deleteGroup: id => request('/groups/' + encodeURIComponent(id), { method: 'DELETE' }),
  saveAssignment: value => request('/assignments', { method: 'POST', body: JSON.stringify(value) })
};
