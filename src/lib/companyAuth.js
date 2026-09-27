import { clearImageCache } from './imageCache';
import { setBrandLogo } from './brandStore.js';
export const COMPANY_API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_COMPANY_API_URL) || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '/api/company-auth' : 'https://hrms-api.mkmkataria07.workers.dev/api/v1');
export async function companyRequest(path, { token, ...options } = {}) {
  const response = await fetch(COMPANY_API + path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success !== true) {
    if (response.status === 404 && body.message === 'Route not available in the company API.') {
      const endpoint = path.split('?')[0];
      throw new Error(`The connected company API does not support ${endpoint}. Restart the local application server, or deploy the updated company Worker if using a hosted API.`);
    }
    throw new Error(body.message || 'Company sign-in service is unavailable.');
  }
  return body.data;
}
export const companyAuth = {
  async syncBrand(companyId) {
    const brand = await companyRequest('/branding/' + encodeURIComponent(companyId));
    setBrandLogo(COMPANY_API + '/branding/' + (brand.has_logo ? encodeURIComponent(companyId) : 'default') + '/logo');
    return brand;
  },
  login: (username, password, recaptcha_token) => companyRequest('/login', { method: 'POST', body: JSON.stringify({ username, password, recaptcha_token }) }),
  changePassword: (token, current_password, new_password) => companyRequest('/change-password', { token, method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  verify: token => companyRequest('/auth/verify', { token }),
  logout: token => companyRequest('/logout', { token, method: 'POST' }),
  save(user) { localStorage.setItem('pulse_hrms_token', user.token); localStorage.setItem('pulse_hrms_user', JSON.stringify({ ...user, first_name: user.first_name || user.name || user.username })); },
  clear() { clearImageCache(); localStorage.removeItem('pulse_hrms_token'); localStorage.removeItem('pulse_hrms_user'); setBrandLogo(null); }
};
