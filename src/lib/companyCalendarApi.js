async function request(path, options = {}) {
  const token = localStorage.getItem('pulse_hrms_token');
  const response = await fetch('/api/company-calendar' + path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const body = await response.json().catch(() => { throw new Error('Company Calendar service is unavailable. Restart the application server.'); });
  if (!response.ok) throw new Error(body.message || 'Company Calendar request failed.');
  return body;
}
export const companyCalendarApi = {
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
