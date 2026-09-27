import { liveCapacity } from './billing.mjs';
import { DASHBOARD_PAGES, parsePages } from '../shared/dashboardAccess.mjs';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const stmt = (db, sql, params = []) => db.prepare(sql).bind(...params);
export async function dashboardAdmin({ db, actor, path, method, body, hashPassword }) {
  if (actor.role !== 'company_admin') fail('Only the Super Admin can manage dashboard users.', 403);
  if (path === '/api/v1/dashboard-users' && method === 'GET') {
    const rows = await stmt(db, `SELECT e.employee_id,e.user_id,e.employee_code,e.first_name,e.last_name,e.dashboard_access,e.dashboard_pages,u.username,u.must_change_password,u.status FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND u.role='employee' ORDER BY e.first_name`, [actor.company_id]).all();
    return rows.results.map(row => ({ ...row, dashboard_pages: parsePages(row.dashboard_pages) }));
  }
  if (path !== '/api/v1/dashboard-users' || method !== 'POST') fail('Route not found.', 404);
  const user = await stmt(db, "SELECT u.user_id,u.status FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND e.employee_id=? AND u.role='employee'", [actor.company_id, body.employee_id]).first();
  if (!user) fail('Employee not found.', 404);
  if (body.dashboard_access && user.status !== 'active') fail('Only active employees can receive dashboard access.');
  if (typeof body.dashboard_access !== 'boolean') fail('Choose whether dashboard access is enabled.');
  const pages = parsePages(body.dashboard_pages);
  if (!Array.isArray(body.dashboard_pages) || pages.length !== body.dashboard_pages.length || new Set(pages).size !== pages.length || (body.dashboard_access && !pages.length)) fail('Select at least one valid page for dashboard access.');
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9._-]{2,99}$/.test(username)) fail('User ID must have 3–100 letters, numbers, dots, underscores or hyphens.');
  const capacity = await liveCapacity(db, actor.company_id);
  const existing = await stmt(db, 'SELECT dashboard_access FROM employees WHERE company_id=? AND employee_id=?', [actor.company_id, body.employee_id]).first();
  if (body.dashboard_access && !existing.dashboard_access && capacity.expired) fail('Renew your company plan before granting new dashboard access.', 409);
  if (body.dashboard_access && !existing.dashboard_access && !body.password) fail('Set a temporary password when granting access.');
  const passwordHash = body.password ? await hashPassword(body.password) : null;
  const statements = [stmt(db, 'UPDATE employees SET dashboard_access=?,dashboard_pages=? WHERE company_id=? AND employee_id=?', [body.dashboard_access ? 1 : 0, JSON.stringify(pages), actor.company_id, body.employee_id]), stmt(db, `UPDATE users SET username=? ${passwordHash ? ',password_hash=?,must_change_password=1' : ''} WHERE company_id=? AND user_id=?`, [username, ...(passwordHash ? [passwordHash] : []), actor.company_id, user.user_id]), stmt(db, 'DELETE FROM sessions WHERE company_id=? AND user_id=?', [actor.company_id, user.user_id])];
  try { await db.batch(statements); } catch (error) { if (/Maximum three|plan limit reached/.test(error.message)) fail(`Your company allows ${capacity.dashboard_limit} additional dashboard users. Review Plan & Subscription.`, 409); throw error; }
  return { saved: true };
}

export async function dashboardConfiguration({ db, actor, section, method, body }) {
  if (!['shifts', 'settings'].includes(section)) fail('Configuration not found.', 404);
  const row = await stmt(db, 'SELECT * FROM dashboard_configuration WHERE company_id=? AND section=?', [actor.company_id, section]).first();
  if (method === 'GET') return { revision: row?.revision || 0, value: row ? JSON.parse(row.payload) : section === 'shifts' ? [] : { hrEmail: '', supportPhone: '', announcementFooter: '' } };
  if (method !== 'POST') fail('Route not found.', 404);
  if (actor.role !== 'company_admin' && !(actor.dashboard_access && parsePages(actor.dashboard_pages).includes(section))) fail('Page access denied.', 403);
  const value = body.value;
  if (section === 'shifts') {
    if (!Array.isArray(value) || value.length > 100) fail('Provide up to 100 shifts.');
    if (new Set(value.map(s => s.id)).size !== value.length || value.filter(s => s.isDefault).length > 1) fail('Use unique shift IDs and only one default shift.');
    for (const s of value) {
      if (!s || typeof s.id !== 'string' || !s.id || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 100) fail('Each shift needs a name and ID.');
      if (![s.startTime, s.endTime].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || s.startTime === s.endTime) fail('Enter valid and different shift times.');
      if (!Array.isArray(s.workingDays) || !s.workingDays.length || s.workingDays.some(d => !['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(d))) fail('Select valid working days.');
      if (![s.breakDurationMins, s.gracePeriodMins].every(n => Number.isInteger(n) && n >= 0 && n <= 240)) fail('Break and grace minutes must be between 0 and 240.');
      if (!['Active', 'Inactive'].includes(s.status) || typeof s.isDefault !== 'boolean' || (s.isDefault && s.status !== 'Active')) fail('The default shift must be active.');
      const minutes = t => Number(t.slice(0,2))*60 + Number(t.slice(3));
      if (s.breakDurationMins >= (minutes(s.endTime)-minutes(s.startTime)+1440)%1440) fail('Break must be shorter than the shift.');
    }
  } else {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['hrEmail','supportPhone','announcementFooter'].includes(k)) || Object.values(value).some(v => typeof v !== 'string' || v.length > 500)) fail('Invalid company contact settings.');
    if (value.hrEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.hrEmail)) fail('Enter a valid HR email.');
  }
  if (!Number.isInteger(body.revision)) fail('Configuration revision is required.');
  const saved = await stmt(db, 'INSERT INTO dashboard_configuration(company_id,section,payload,revision) SELECT ?,?,?,1 WHERE ?=0 ON CONFLICT(company_id,section) DO UPDATE SET payload=excluded.payload,revision=dashboard_configuration.revision+1 WHERE dashboard_configuration.revision=? RETURNING revision', [actor.company_id, section, JSON.stringify(value), body.revision, body.revision]).first();
  // Existing rows need UPDATE because an INSERT ... SELECT with no row does not enter UPSERT.
  if (saved) return { revision: saved.revision, value };
  const updated = await stmt(db, 'UPDATE dashboard_configuration SET payload=?,revision=revision+1 WHERE company_id=? AND section=? AND revision=? RETURNING revision', [JSON.stringify(value), actor.company_id, section, body.revision]).first();
  if (!updated) fail('Settings changed. Reload before saving.', 409);
  return { revision: updated.revision, value };
}
