async function request(path, options = {}) {
  const token = localStorage.getItem('pulse_hrms_token');
  const response = await fetch('/api/payroll-studio' + path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const body = await response.json().catch(() => {
    throw new Error('Payroll service is unavailable. Restart the application server with npm run dev.');
  });
  if (!response.ok || body?.success === false) throw new Error(body?.message || 'Payroll request failed.');
  if (!body || typeof body !== 'object') throw new Error('Payroll service returned an invalid response.');
  return body;
}
export const payslipApi = {
  async configuration() {
    const data = await request('/configuration');
    if (!['templates', 'groups', 'assignments'].every(key => Array.isArray(data[key]) && data[key].every(item => item && typeof item === 'object'))) {
      throw new Error('Payroll configuration is unavailable. Restart the application server and retry.');
    }
    return data;
  },
  saveTemplate: value => request('/templates', { method: 'POST', body: JSON.stringify(value) }),
  saveGroup: value => request('/groups', { method: 'POST', body: JSON.stringify(value) }),
  assign: value => request('/assignments', { method: 'POST', body: JSON.stringify(value) }),
  saveSalary: value => request('/salaries', { method: 'POST', body: JSON.stringify(value) }),
  async records(userid) {
    const data = await request('/records/' + encodeURIComponent(userid));
    if (!Array.isArray(data) || data.some(item => !item || typeof item !== 'object')) throw new Error('Payslip records are unavailable. Please retry.');
    return data;
  },
  generate: id => request('/records/' + encodeURIComponent(id) + '/generate', { method: 'POST', body: '{}' }),
  downloadLink: id => request('/records/' + encodeURIComponent(id) + '/download'),
  async download(id) {
    const { url } = await payslipApi.downloadLink(id);
    const link = document.createElement('a'); link.href = url; link.rel = 'noopener'; link.click();
    return url;
  }
};
export async function issueEmployeePayslip(employee, salary, month, year, download = false) {
  const result = await payslipApi.saveSalary({ employee, salary, month, year, generate: true });
  window.dispatchEvent(new Event('payslip-records-changed'));
  if (result.status !== 'ready') throw new Error(result.error || 'Salary saved. Payslip generation is pending.');
  if (download) await payslipApi.download(result.id);
  return result;
}
