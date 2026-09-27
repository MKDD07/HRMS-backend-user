import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { createPayrollDatabase } from './payrollDatabase.mjs';
import { createCompanyCalendarRouter } from './companyCalendarRoutes.mjs';
import { migrateCalendar } from './migrateCalendar.mjs';

const legacy = new DatabaseSync(':memory:');
try {
  legacy.exec("CREATE TABLE calendar_holidays(id TEXT PRIMARY KEY,payload TEXT); INSERT INTO calendar_holidays VALUES('old','{\"name\":\"Holiday\",\"holiday_date\":\"2026-01-01\"}'); CREATE TABLE calendar_assignments(id TEXT PRIMARY KEY,payload TEXT); INSERT INTO calendar_assignments VALUES('e1','{\"userid\":\"wrong\"}');");
  assert.throws(() => migrateCalendar(legacy, 'a'), /Invalid legacy/);
  assert.equal(legacy.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='company_calendar'").get().n, 0, 'Migration failure rolls back schema and data');
  legacy.prepare('UPDATE calendar_assignments SET payload=?').run(JSON.stringify({ userid: 'e1', mode: 'custom' }));
  migrateCalendar(legacy, 'a'); migrateCalendar(legacy, 'a');
  assert.throws(() => migrateCalendar(legacy, 'b'), /another company/);
  assert.equal(JSON.parse(legacy.prepare('SELECT holidays FROM company_calendar').get().holidays)[0].id, 'old');
  assert.equal(legacy.prepare('SELECT count(*) AS n FROM calendar_holidays').get().n, 1);
  assert.equal(legacy.prepare('SELECT count(*) AS n FROM company_calendar_assignments').get().n, 1);
} finally { legacy.close(); }

const cleanup = new DatabaseSync(':memory:');
try {
  cleanup.exec("CREATE TABLE calendar_holidays(id TEXT PRIMARY KEY,payload TEXT); INSERT INTO calendar_holidays VALUES('h','{\"name\":\"Keep me\"}');");
  migrateCalendar(cleanup, 'a', { removeLegacy: true });
  migrateCalendar(cleanup, 'a', { removeLegacy: true });
  assert.equal(cleanup.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='calendar_holidays'").get().n, 0);
  assert.equal(JSON.parse(cleanup.prepare('SELECT holidays FROM company_calendar').get().holidays)[0].name, 'Keep me');
} finally { cleanup.close(); }

const database = createPayrollDatabase({ filename: ':memory:' });
const app = express();
app.use(createCompanyCalendarRouter({ database, authorize: async req => {
  const token = req.headers.authorization;
  if (!token) return null;
  return { userid: 'u1', company_id: token === 'missing-company' ? undefined : ['reader', 'company-admin'].includes(token) ? 'a' : token, role: token === 'company-admin' ? 'company_admin' : 'employee', admin: !['reader', 'company-admin'].includes(token) };
} }));
const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
async function call(path, company = 'a', body, method = body ? 'POST' : 'GET', status = 200) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { ...(company ? { Authorization: company } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result)); return result;
}
try {
  await call('/configuration', '', undefined, 'GET', 401);
  await call('/configuration', 'missing-company', undefined, 'GET', 403);
  const holiday = { id: 'h1', name: 'Holiday', date: '2026-01-01', company_id: 'b' };
  await call('/holidays', 'reader', holiday, 'POST', 403);
  await call('/holidays', 'company-admin', holiday);
  assert.equal((await call('/configuration', 'b')).holidays.length, 0, 'Body company ID cannot change ownership');
  await call('/holidays', 'b', { ...holiday, name: 'B holiday' });
  await call('/holidays/h1', 'a', undefined, 'DELETE');
  assert.equal((await call('/configuration', 'b')).holidays[0].name, 'B holiday');
  await Promise.all(Array.from({ length: 5 }, (_, i) => call('/holidays', 'a', { ...holiday, id: `parallel-${i}` })));
  assert.equal((await call('/configuration')).holidays.length, 5, 'Concurrent additions are preserved');
  await call('/important-dates', 'a', { name: 'Anniversary', date: '2026-10-10' });
  await call('/assignments', 'a', { userid: 'employee-1', mode: 'custom' });
  assert.equal((await call('/configuration', 'b')).assignments.length, 0);
  assert.equal((await call('/configuration')).importantDates.length, 1);
  const rows = await database.query('SELECT company_id, holidays FROM company_calendar');
  assert.equal(rows.length, 2, 'Exactly one settings row per company');
  await assert.rejects(database.query("UPDATE company_calendar SET holidays='{}' WHERE company_id='a'"));
  console.log('Calendar tests passed: JSON storage, migration rollback/idempotence, permissions, company isolation, concurrent edits.');
} finally { await new Promise(resolve => server.close(resolve)); database.close(); }
