import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { payrollComponents } from './payrollComponents.mjs';
test('cloud payroll components persist, enforce company scope and validate before writes', async () => {
  const sql = new DatabaseSync(':memory:');
  try {
    for (const file of ['0001_core.sql','0023_payroll_components.sql']) sql.exec(readFileSync(new URL('../migrations/hrms/' + file, import.meta.url), 'utf8'));
    sql.exec("INSERT INTO companies(company_id,name) VALUES('a','A'),('b','B'); INSERT INTO users(user_id,company_id,username,password_hash,role) VALUES('alice','a','alice','hash','employee'),('bob','b','bob','hash','employee'); INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name) VALUES('ea','a','alice','A-1','Alice'),('eb','b','bob','B-1','Bob')");
    function prepare(query, args = []) { return { sql: query, args, bind(...values) { return prepare(query, values); }, async first() { return sql.prepare(query).get(...args); }, async all() { return { results: sql.prepare(query).all(...args) }; }, async run() { return sql.prepare(query).run(...args); } }; }
    const db = { prepare, async batch(statements) { sql.exec('BEGIN'); try { const result = statements.map(s => sql.prepare(s.sql).run(...s.args)); sql.exec('COMMIT'); return result; } catch(e) { sql.exec('ROLLBACK'); throw e; } } };
    const actor = { company_id: 'a', role: 'company_admin' };
    const call = (body, who = actor) => payrollComponents({ db, actor: who, method: body ? 'POST' : 'GET', body });
    const row = { name: 'Travel', amount: 500, type: 'earning', scope: { mode: 'ongoing', year: '2026', month: 'November' } };
    const [saved] = await call({ action: 'add', employee_ids: ['alice'], row });
    assert.equal((await call())[0].name, 'Travel');
    assert.deepEqual(await call(null, { ...actor, company_id: 'b' }), []);
    await assert.rejects(call({ action: 'add', employee_ids: ['alice','bob'], row }), { status: 404 });
    assert.equal((await call()).length, 1);
    await assert.rejects(call(null, { ...actor, role: 'employee' }), { status: 403 });
    await assert.rejects(call({ action: 'add', employee_ids: ['alice'], row: { ...row, scope: { mode: 'invalid' } } }), /valid component/);
    await call({ action: 'update', userid: 'alice', id: saved.id, patch: { name: 'Travel allowance', amount: 750 } });
    const updated = (await call())[0]; assert.equal(updated.amount, 750); assert.deepEqual(updated.scope, row.scope);
    await assert.rejects(call({ action: 'delete', userid: 'bob', id: saved.id }), { status: 404 });
    await call({ action: 'delete', userid: 'alice', id: saved.id }); assert.deepEqual(await call(), []);
  } finally { sql.close(); }
});
