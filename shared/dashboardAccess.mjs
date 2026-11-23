import { TALENT_COLLECTIONS } from './talentModel.mjs';
import { OPERATIONS } from './operationsModel.mjs';
export const DASHBOARD_PAGES = [
  ['expenses', 'Expenses & Reimbursements'], ['hr-analytics', 'HR Analytics'], ['appraisals', 'Appraisal Reviews'], ['benefits', 'Benefits & Insurance'], ['surveys', 'Employee Surveys'], ['timesheets', 'Projects & Timesheets'],
  ['dashboard', 'Dashboard'], ['employees', 'Employee directory'], ['departments', 'Departments'],
  ['attendance', 'Attendance & logs'], ['geofence-rules', 'Geofence & photo rules'], ['shifts', 'Shifts'],
  ['leave', 'Leaves'], ['company-calendar', 'Company calendar'], ['payroll', 'Payroll'],
  ['salary-structure', 'Salary structures'], ['recruitment', 'Recruitment'], ['performance', 'Goals & performance'],
  ['onboarding', 'Onboarding'], ['offboarding', 'Offboarding'], ['learning', 'Learning & Development'], ['assets', 'Assets'], ['documents', 'Document vault'], ['mail', 'Mail'], ['helpdesk', 'HR Connect'], ['reports', 'Reports'], ['settings', 'Settings']
];
const PAGE_ALIASES = new Map([
  ['employee-detail', 'employees'],
  ['hr-calendar', 'company-calendar'],
  ['regularization', 'departments'],
]);
export const canUsePage = (user, page) => {
  const permissionPage = PAGE_ALIASES.get(page) || page;
  return (!user?.plan_pages || user.plan_pages.includes(permissionPage)) && (
    user?.role === 'company_admin' ||
    Boolean(user?.role === 'employee' && ['appraisals', 'mail'].includes(page)) ||
    Boolean(user?.dashboard_access && user?.dashboard_pages?.includes(permissionPage))
  );
};
export const canUseDashboard = user => user?.role === 'company_admin' || Boolean(user?.dashboard_access);
export const canSignInWorkspace = user => canUseDashboard(user) || user?.role === 'employee';
export function parsePages(value) { try { const pages = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(pages) ? pages.filter(p => DASHBOARD_PAGES.some(([id]) => id === p)) : []; } catch { return []; } }

// A delegated account receives elevated company access only for these explicitly mapped routes.
export function routePages(path, method) {
  const read = method === 'GET';
  if(path==='/api/v1/mail' || path.startsWith('/api/v1/mail/'))return ['mail'];
  if(path==='/api/v1/appraisals' || path.startsWith('/api/v1/appraisals/'))return ['appraisals'];
  if (path === '/api/v1/hr-analytics' || path.startsWith('/api/v1/hr-analytics/')) return ['hr-analytics'];
  if (path.startsWith('/api/v1/operations/')) {
    const collection = path.split('/')[4];
    return Object.hasOwn(OPERATIONS, collection) ? [OPERATIONS[collection].page] : [];
  }
  if (path.startsWith('/api/v1/talent/')) {
    const collection = path.split('/')[4];
    if (collection === 'letter_settings') return ['onboarding', 'offboarding'];
    const config = Object.hasOwn(TALENT_COLLECTIONS, collection) ? TALENT_COLLECTIONS[collection] : null;
    return config ? [config.page, ...(read && !config.documentContent ? ['reports'] : [])] : [];
  }
  if (path === '/api/v1/get-all-users' && read) return DASHBOARD_PAGES.map(([id]) => id).filter(id => !['settings', 'shifts'].includes(id));
  if (path === '/api/v1/get-user' && read) return DASHBOARD_PAGES.map(([id]) => id);

  if (path === '/api/v1/ai/vault-draft' && !read) return ['documents'];
  const aiPage = path.match(/^\/api\/v1\/ai\/(onboarding|offboarding|salary-structure)$/)?.[1];
  if (aiPage && !read) return [aiPage];
  if (path === '/api/v1/ai/department-draft' && !read) return ['departments'];
  if (path === '/api/v1/employee-dossier') return ['employees'];
  if (path === '/api/v1/geofence-sites') return read ? ['geofence-rules','employees'] : ['geofence-rules'];
  if (path === '/api/v1/geofence-rules') return ['geofence-rules'];
  if (['/api/v1/create-user', '/api/v1/register', '/api/v1/update-user'].includes(path)) return ['employees'];
  if (path === '/api/v1/avatar' || path === '/api/v1/upload-avatar') return read ? DASHBOARD_PAGES.map(([id]) => id) : ['employees'];
  if (path === '/api/v1/get-attendance' && read) return ['dashboard', 'attendance', 'employees', 'reports'];
  if (path === '/api/v1/attendance/schedule' && read) return ['attendance'];
  if (path === '/api/v1/get-leave' && read) return ['dashboard', 'attendance', 'leave', 'employees', 'reports'];
  if (['/api/v1/apply-leave', '/api/v1/review-leave'].includes(path)) return ['leave'];
  if (path === '/api/v1/attendance') return ['attendance'];
  if (path.includes('/salary')) return ['payroll', 'salary-structure'];
  if (path === '/api/v1/get-salary' || path === '/api/v1/add-salary') return ['payroll', 'salary-structure'];
  if (path.startsWith('/api/v1/documents')) return ['documents'];
  if (path.startsWith('/api/v1/hr-connect')) return ['helpdesk'];
  if (path.startsWith('/api/v1/company-calendar/')) return ['company-calendar'];
  if (path.startsWith('/api/v1/workflows/notifications') || path === '/api/v1/get-user-notification' || path.startsWith('/api/v1/chat/')) return DASHBOARD_PAGES.map(([id]) => id);
  if (read && ['/api/v1/workflows/configuration', '/api/v1/workflows/directory'].includes(path)) return ['departments'];
  if (path.startsWith('/api/v1/workflows/')) return ['departments'];
  return [];
}
