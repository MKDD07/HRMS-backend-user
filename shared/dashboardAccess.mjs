import { TALENT_COLLECTIONS } from './talentModel.mjs';
export const DASHBOARD_PAGES = [
  ['dashboard', 'Dashboard'], ['employees', 'Employee directory'], ['hierarchy', 'Organization & approvals'],
  ['attendance', 'Attendance & logs'], ['geofence-rules', 'Geofence & photo rules'], ['shifts', 'Shifts'],
  ['leave', 'Leaves'], ['company-calendar', 'Company calendar'], ['payroll', 'Payroll'],
  ['salary-structure', 'Salary structures'], ['recruitment', 'Recruitment'], ['performance', 'Goals & performance'],
  ['onboarding', 'Onboarding'], ['offboarding', 'Offboarding'], ['learning', 'Learning & Development'], ['assets', 'Assets'], ['documents', 'Document vault'], ['helpdesk', 'HR Connect'], ['reports', 'Reports'], ['settings', 'Settings']
];
export const canUsePage = (user, page) => user?.role === 'company_admin' || Boolean(user?.dashboard_access && user?.dashboard_pages?.includes(page === 'employee-detail' ? 'employees' : page));
export const canUseDashboard = user => user?.role === 'company_admin' || Boolean(user?.dashboard_access);
export function parsePages(value) { try { const pages = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(pages) ? pages.filter(p => DASHBOARD_PAGES.some(([id]) => id === p)) : []; } catch { return []; } }

// A delegated account receives elevated company access only for these explicitly mapped routes.
export function routePages(path, method) {
  const read = method === 'GET';
  if (path.startsWith('/api/v1/talent/')) {
    const collection = path.split('/')[4];
    const config = Object.hasOwn(TALENT_COLLECTIONS, collection) ? TALENT_COLLECTIONS[collection] : null;
    return config ? [config.page, ...(read ? ['reports'] : [])] : [];
  }
  if (path === '/api/v1/get-all-users' && read) return DASHBOARD_PAGES.map(([id]) => id).filter(id => !['settings', 'shifts'].includes(id));
  if (path === '/api/v1/get-user' && read) return ['employees'];
  if (['/api/v1/create-user', '/api/v1/register', '/api/v1/update-user'].includes(path)) return ['employees'];
  if (path === '/api/v1/avatar' || path === '/api/v1/upload-avatar') return read ? DASHBOARD_PAGES.map(([id]) => id) : ['employees'];
  if (path === '/api/v1/get-attendance' && read) return ['dashboard', 'attendance', 'employees', 'reports'];
  if (path === '/api/v1/get-leave' && read) return ['dashboard', 'attendance', 'leave', 'employees', 'reports'];
  if (['/api/v1/apply-leave', '/api/v1/review-leave'].includes(path)) return ['leave'];
  if (path === '/api/v1/attendance') return ['attendance'];
  if (path.includes('/salary')) return ['payroll', 'salary-structure'];
  if (path === '/api/v1/get-salary' || path === '/api/v1/add-salary') return ['payroll', 'salary-structure'];
  if (path.startsWith('/api/v1/documents')) return ['documents'];
  if (path.startsWith('/api/v1/hr-connect')) return ['helpdesk'];
  if (path.startsWith('/api/v1/company-calendar/')) return ['company-calendar'];
  if (path.startsWith('/api/v1/workflows/notifications')) return DASHBOARD_PAGES.map(([id]) => id);
  if (path.startsWith('/api/v1/workflows/')) return ['hierarchy'];
  return [];
}
