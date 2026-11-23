import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './index.mjs';
import { emptyConfiguration, defaultResponsibilities } from '../shared/workflowModel.mjs';
import { processWorkflowTimers } from './workflows.mjs';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec(readFileSync(new URL('../migrations/hrms/0001_core.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0002_employee_codes.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0003_company_branding.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0004_approval_workflows.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0005_hr_connect.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0006_dashboard_access.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0007_billing.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0008_holiday_cache.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0009_talent_operations.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0010_asset_issues.sql', import.meta.url), 'utf8'));
for (const migration of ['0018_billing_recurring.sql', '0019_billing_renewal_guards.sql', '0020_billing_workspace_policy.sql']) {
  sqlite.exec(readFileSync(new URL('../migrations/hrms/' + migration, import.meta.url), 'utf8'));
}
function prepare(sql, params = []) {
  return {
    bind(...values) { return prepare(sql, values); },
    async first() { return sqlite.prepare(sql).get(...params) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...params) }; },
    async run() { return sqlite.prepare(sql).run(...params); }
  };
}
const objects = new Map();
let batchQueue = Promise.resolve();
const env = {
  DB: { prepare, batch(statements) {
    const operation = batchQueue.then(async () => {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    });
    batchQueue = operation.catch(() => {});
    return operation;
  } },
  OWNER_PROVISIONING_TOKEN: 'owner-secret-for-test-only',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  HRMS_DOCUMENTS: { async put(key, bytes) { objects.set(key, bytes); }, async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; }, async delete(key) { objects.delete(key); } }
};
async function call(path, { token, body, method = body ? 'POST' : 'GET', status = 200, origin } = {}) {
  const response = await worker.fetch(new Request('https://hrms.test/api/v1' + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
  const payload = await response.json(); assert.equal(response.status, status, JSON.stringify(payload)); return payload.data;
}
const password = 'Initial-password-2026';
const changed = 'New!26';
async function login(username, password) { return call('/login', { body: { username, password } }); }
async function activate(username) {
  const initial = await login(username, password);
  await call('/get-all-users', { token: initial.token, status: 403 });
  await call('/change-password', { token: initial.token, body: { current_password: password, new_password: 'Ab!12' }, status: 400 });
  await call('/change-password', { token: initial.token, body: { current_password: password, new_password: changed } });
  await call('/auth/verify', { token: initial.token, status: 401 });
  return login(username, changed);
}
try {
  await call('/platform/companies', { token: env.OWNER_PROVISIONING_TOKEN, body: { company_name: 'Calendar A', username: 'calendar-a', password } });
  await call('/platform/companies', { token: env.OWNER_PROVISIONING_TOKEN, body: { company_name: 'Calendar B', username: 'calendar-b', password } });
  const a = await activate('calendar-a'), b = await activate('calendar-b');
  const saved = await call('/company-calendar/important-dates', { token: a.token, body: { name: 'Meeting', date: '2000-01-01', time: '09:00', type: 'Meeting', reminder: true, owner_id: b.userid } });
  assert.equal(saved.owner_id, a.userid);
  assert.equal((await call('/company-calendar/reminders', { token: b.token })).length, 0);
  const due = await call('/company-calendar/reminders', { token: a.token });
  assert.equal(due.length, 1); assert.equal(due[0].unread, true);
  await call('/company-calendar/reminders/read', { token: b.token, body: { id: due[0].id } });
  assert.equal((await call('/company-calendar/reminders', { token: a.token }))[0].unread, true);
  await call('/company-calendar/reminders/read', { token: a.token, body: { id: due[0].id } });
  assert.equal((await call('/company-calendar/reminders', { token: a.token }))[0].unread, false);
  await call('/company-calendar/important-dates', { token: a.token, body: { name: 'Invalid', date: '2026-02-30', time: '09:00' }, status: 400 });
  await call('/company-calendar/important-dates', { token: a.token, body: { name: 'Invalid time', date: '2026-02-28', time: '29:00' }, status: 400 });
  await call('/company-calendar/important-dates/' + saved.id, { token: a.token, method: 'DELETE' });
  assert.equal((await call('/company-calendar/reminders', { token: a.token })).length, 0);
  console.log('Worker calendar reminder API tests passed: persistence, owner and company isolation, read state, deletion and date/time validation.');
} finally { sqlite.close(); }
