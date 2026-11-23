import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { directoryRows } from './directoryKvCache.mjs';

function setup() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/hrms/0001_core.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('../migrations/hrms/0022_directory_cache.sql', import.meta.url), 'utf8'));
  sql.exec("INSERT INTO companies(company_id,name) VALUES('a','A'),('b','B')");
  sql.exec("INSERT INTO users(user_id,company_id,username,password_hash,role) VALUES('u','a','alice','hash','employee')");
  sql.exec("INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name) VALUES('e','a','u','A-1','Alice')");
  const db = { prepare(query) { return { bind(...args) { return { first: async () => sql.prepare(query).get(...args) }; } }; } };
  const values = new Map();
  const kv = { get: async key => values.get(key) || null, put: async (key, value, options) => { assert.equal(options.expirationTtl, 120); values.set(key, JSON.parse(value)); } };
  let calls = 0;
  const fetchRows = async () => { calls++; return sql.prepare('SELECT first_name FROM employees').all(); };
  return { sql, db, kv, values, args: { db, kv, company: 'a', limit: 100, offset: 0, fetchRows }, calls: () => calls };
}

test('cache hits avoid the directory query; company and pagination keys are isolated', async () => {
  const s = setup();try {
    await directoryRows(s.args); await directoryRows(s.args); assert.equal(s.calls(), 1);
    await directoryRows({ ...s.args, company: 'b' });
    await directoryRows({ ...s.args, offset: 100 });
    await directoryRows({ ...s.args, limit: 20 });
    assert.equal(s.calls(), 4);
  } finally { s.sql.close(); }
});
test('employee and user changes invalidate cached rows through database triggers', async () => {
  const s = setup();try {
    await directoryRows(s.args);
    s.sql.exec("UPDATE employees SET first_name='Updated' WHERE employee_id='e'");
    assert.equal((await directoryRows(s.args))[0].first_name, 'Updated');
    s.sql.exec("UPDATE users SET email='alice@example.test' WHERE user_id='u'");
    await directoryRows(s.args); assert.equal(s.calls(), 3);
    s.sql.exec("DELETE FROM employees WHERE employee_id='e'");
    assert.deepEqual(await directoryRows(s.args), []);
  } finally { s.sql.close(); }
});
test('missing binding, failed reads/writes and unapplied migrations fall back to D1', async () => {
  const s = setup();try {
    await directoryRows({ ...s.args, kv: null });
    const broken = { get: async () => { throw Error('offline'); }, put: async () => { throw Error('offline'); } };
    await directoryRows({ ...s.args, kv: broken });
    s.sql.exec('DROP TABLE directory_cache_revisions');
    await directoryRows(s.args); assert.equal(s.calls(), 3);
  } finally { s.sql.close(); }
});
test('a write racing a database edit cannot populate the new revision key', async () => {
  const s = setup();try {
    await directoryRows({ ...s.args, fetchRows: async () => {
      const old = await s.args.fetchRows();
      s.sql.exec("UPDATE employees SET first_name='Fresh' WHERE employee_id='e'");
      return old;
    } });
    assert.equal((await directoryRows(s.args))[0].first_name, 'Fresh');
  } finally { s.sql.close(); }
});
