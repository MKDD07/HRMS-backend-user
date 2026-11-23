import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { workflowHandle, workflowPeople } from './workflows.mjs';
import { emptyConfiguration } from '../shared/workflowModel.mjs';

const sql = new DatabaseSync(':memory:');
for (const file of readdirSync(new URL('../migrations/hrms/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) sql.exec(readFileSync(new URL('../migrations/hrms/' + file, import.meta.url), 'utf8'));
function prepare(query, values = []) { return { bind: (...v) => prepare(query, v), async first() { return sql.prepare(query).get(...values) || null; }, async all() { return { results: sql.prepare(query).all(...values) }; }, async run() { return sql.prepare(query).run(...values); } }; }
const db = { prepare, async batch(statements) { sql.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; } catch (error) { sql.exec('ROLLBACK'); throw error; } } };
sql.exec("INSERT INTO companies(company_id,name) VALUES('a','A'),('b','B')");
for (const [id, company, department] of [['p', 'a', 'General'], ['q', 'a', 'Sales'], ['foreign', 'b', 'General']]) {
  sql.prepare("INSERT INTO users(user_id,company_id,username,email,password_hash,role) VALUES(?,?,?,?,?,'employee')").run(id, company, id, id + '@example.com', 'test');
  sql.prepare('INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,department,profile) VALUES(?,?,?,?,?,?,?)').run(id, company, id, id, id, department, JSON.stringify({ salary: 900, dossier_revision: 2 }));
}
const actor = { role: 'company_admin', company_id: 'a', user_id: 'p' };
const call = (body, selectedActor = actor) => workflowHandle({ db, actor: selectedActor, path: '/api/v1/workflows/department-transfer', method: 'POST', body });
try {
  for (const [id, company, employee, status] of [['approved', 'a', 'p', 'Approved'], ['pending', 'a', 'q', 'Pending'], ['foreign-leave', 'b', 'foreign', 'Approved']]) {
    sql.prepare('INSERT INTO leave_requests(leave_id,company_id,employee_id,leave_type,start_date,end_date,reason,status) VALUES(?,?,?,?,?,?,?,?)').run(id, company, employee, 'Casual Leave', '2026-10-15', '2026-10-20', 'Private reason', status);
  }
  const directory = await workflowHandle({ db, actor, path: '/api/v1/workflows/directory', method: 'GET', body: {} });
  assert.deepEqual(directory.find(person => person.id === 'p').approvedLeave, [{ from: '2026-10-15', until: '2026-10-20' }]);
  assert.deepEqual(directory.find(person => person.id === 'q').approvedLeave, []);
  assert.equal(directory.some(person => person.id === 'foreign'), false);
  assert.equal(JSON.stringify(directory).includes('Private reason'), false);
  const initial = { ...emptyConfiguration(), departments: [{ name: 'General', head: 'p', memberRoles: { p: 'Team leader' }, targets: '', responsibilities: '' }, { name: 'Sales', head: '', targets: '', responsibilities: '' }], links: [{ id: 'old', manager: 'q', employee: 'p', type: 'direct', responsibilities: {} }] };
  sql.prepare('INSERT INTO workflow_configuration(company_id,payload,revision,updated_at) VALUES(?,?,1,?)').run('a', JSON.stringify(initial), 'today');
  await assert.rejects(call({ userid: 'foreign', department: 'Sales', revision: 1 }), /Employee not found/);
  await assert.rejects(call({ userid: 'p', department: 'Missing', revision: 1 }), /existing department/);
  await assert.rejects(call({ userid: 'p', department: 'Sales', revision: 1 }, { ...actor, role: 'employee' }), /administrator/);
  const result = await call({ userid: 'p', department: 'Sales', revision: 1 });
  assert.equal(result.revision, 2);
  assert.equal(result.configuration.departments[0].head, '');
  assert.equal(result.configuration.departments[0].memberRoles.p, undefined);
  assert.equal(result.configuration.links.length, 0);
  const employee = sql.prepare("SELECT * FROM employees WHERE user_id='p'").get();
  assert.equal(employee.department, 'Sales');
  assert.equal(JSON.parse(employee.profile).department, 'Sales');
  assert.equal(JSON.parse(employee.profile).salary, 900);
  assert.equal(JSON.parse(employee.profile).dossier_revision, 3);
  await assert.rejects(call({ userid: 'p', department: 'General', revision: 1 }), /organization changed/);
  // Simulate an employee edit between reading and committing the transfer.
  const concurrentDb = { ...db, async batch(statements) { sql.prepare("UPDATE employees SET profile=? WHERE user_id='p'").run('{"concurrent":true}'); return db.batch(statements); } };
  await assert.rejects(workflowHandle({ db: concurrentDb, actor, path: '/api/v1/workflows/department-transfer', method: 'POST', body: { userid: 'p', department: 'General', revision: 2 } }), /employee or organization changed/);
  assert.equal(sql.prepare("SELECT revision FROM workflow_configuration WHERE company_id='a'").get().revision, 2);
  assert.equal(sql.prepare("SELECT department FROM employees WHERE user_id='p'").get().department, 'Sales');
  const unassigned = await call({ userid: 'p', department: '', revision: 2 });
  assert.equal(unassigned.revision, 3);
  assert.equal((await workflowPeople(db, 'a')).find(person => person.id === 'p').department, '');
  sql.exec("DELETE FROM workflow_configuration WHERE company_id='a'");
  const firstConfiguration = await call({ userid: 'p', department: 'Sales', revision: 0 });
  assert.equal(firstConfiguration.revision, 1);
  assert.equal(sql.prepare("SELECT department FROM employees WHERE user_id='p'").get().department, 'Sales');
  const leadership = (roles, finalize, revision, selectedActor = actor) => workflowHandle({ db, actor: selectedActor, path: '/api/v1/workflows/company-leadership', method: 'POST', body: { roles, finalize, revision } });
  await assert.rejects(leadership({ CEO: 'foreign' }, false, 1), /active company employee/);
  await assert.rejects(leadership({ CEO: 'p' }, false, 1, { ...actor, role: 'employee' }), /administrator/);
  const drafted = await leadership({ Owner: 'p', CEO: 'q' }, false, 1);
  assert.equal(drafted.configuration.companyLeadership.finalized, undefined);
  assert.equal(drafted.revision, 2);
  const finalized = await leadership({ Owner: 'p', CEO: 'q' }, true, 2);
  assert.deepEqual(finalized.configuration.companyLeadership.finalized.roles, { Owner: 'p', CEO: 'q' });
  assert.equal(finalized.configuration.companyLeadership.finalized.by, 'p');
  const changedDraft = await leadership({ Owner: 'p', CEO: 'p' }, false, 3);
  assert.equal(changedDraft.configuration.companyLeadership.finalized.roles.CEO, 'q');
  assert.equal(changedDraft.configuration.companyLeadership.draft.CEO, 'p');
  await assert.rejects(leadership({ CEO: 'q' }, true, 3), /configuration changed/);
  const log = await workflowHandle({ db, actor, path: '/api/v1/workflows/leadership-log', method: 'GET', body: {} });
  assert.equal(log.length, 3);
  assert.equal(log.filter(row => row.action === 'company-leadership-finalized').length, 1);
  assert.equal(log.every(row => row.actor_id === 'p' && row.company_id === 'a'), true);
  const withDetails = { ...changedDraft.configuration, departments: [{ name: 'Sales', head: '', targets: 'Grow customer retention\nImprove onboarding', responsibilities: 'Manage customer relationships\nSupport renewals', themeIndex: 4 }] };
  await workflowHandle({ db, actor, path: '/api/v1/workflows/configuration', method: 'POST', body: { configuration: withDetails, revision: changedDraft.revision } });
  const reloaded = await workflowHandle({ db, actor, path: '/api/v1/workflows/configuration', method: 'GET', body: {} });
  assert.equal(reloaded.configuration.departments[0].targets, withDetails.departments[0].targets);
  assert.equal(reloaded.configuration.departments[0].responsibilities, withDetails.departments[0].responsibilities);
  console.log('Department transfer and company leadership checks passed.');
} finally { sql.close(); }
