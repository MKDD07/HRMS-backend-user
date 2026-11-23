import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { dashboardAdmin } from './dashboardAdmin.mjs';

const sqlite = new DatabaseSync(':memory:');
for (const file of readdirSync(new URL('../migrations/hrms/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
  sqlite.exec(readFileSync(new URL('../migrations/hrms/' + file, import.meta.url), 'utf8'));
}
function prepare(sql, values = []) {
  return { bind: (...params) => prepare(sql, params), first: async () => sqlite.prepare(sql).get(...values) || null, all: async () => ({ results: sqlite.prepare(sql).all(...values) }) };
}
try {
  sqlite.exec("INSERT INTO companies(company_id,name) VALUES('a','A'),('b','B')");
  for (const company of ['a', 'b']) {
    sqlite.prepare('INSERT INTO users(user_id,company_id,username,password_hash,role) VALUES(?,?,?,?,?)').run('user-' + company, company, 'person-' + company, 'test', 'employee');
    sqlite.prepare('INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,last_name,department,designation,profile,dashboard_pages) VALUES(?,?,?,?,?,?,?,?,?,?)').run('record-' + company, company, 'user-' + company, 'EMP-' + company, 'Test', 'Person', 'Engineering', 'Developer', JSON.stringify({ profile_pic_url: 'profile/' + company + '/photo.webp' }), '["employees"]');
  }
  const users = await dashboardAdmin({ db: { prepare }, actor: { role: 'company_admin', company_id: 'a' }, path: '/api/v1/dashboard-users', method: 'GET' });
  assert.equal(users.length, 1, 'Only employees from the current company are returned');
  assert.equal(users[0].employee_id, 'record-a');
  assert.equal(users[0].userid, 'user-a', 'Directory uses the account ID, not the employee record ID');
  assert.equal(users[0].department, 'Engineering');
  assert.equal(users[0].designation, 'Developer');
  assert.equal(users[0].profile_pic_url, 'profile/a/photo.webp');
  assert.deepEqual(users[0].dashboard_pages, ['employees']);
  console.log('Dashboard user directory data checks passed.');
} finally { sqlite.close(); }
