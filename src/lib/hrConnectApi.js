import { companyRequest } from './companyAuth';
const call = (path = '', options = {}) => companyRequest('/hr-connect' + path, { token: localStorage.getItem('pulse_hrms_token'), ...options });
export const hrConnectApi = {
  async list() {
    const records = [];
    for (let offset = 0; ; offset += 100) {
      const page = await call(`?offset=${offset}`);
      records.push(...page);
      if (page.length < 100) return records;
    }
  },
  create: body => call('', { method: 'POST', body: JSON.stringify(body) }),
  review: (id, body) => call('/' + encodeURIComponent(id), { method: 'POST', body: JSON.stringify(body) })
};
