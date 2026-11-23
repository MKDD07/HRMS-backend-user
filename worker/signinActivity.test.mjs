import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { recordSigninActivity, signinActivityHandle } from './signinActivity.mjs';
import worker from './index.mjs';
import { createD1RestDatabase } from '../server/d1RestDatabase.mjs';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const file of readdirSync(new URL('../migrations/hrms/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../migrations/hrms/' + file, import.meta.url), 'utf8'));
function prepare(sql, params = []) {
  return { bind(...values) { return prepare(sql, values); }, async first() { return sqlite.prepare(sql).get(...params) || null; }, async run() { return sqlite.prepare(sql).run(...params); }, async all() { return { results: sqlite.prepare(sql).all(...params) }; } };
}
const db = { prepare };
try {
  sqlite.exec("INSERT INTO companies(company_id,name) VALUES('a','A'),('b','B')");
  for (const [id, company] of [['alice','a'],['bob','b']]) sqlite.prepare("INSERT INTO users(user_id,company_id,username,email,password_hash,role) VALUES(?,?,?,?,?,'company_admin')").run(id, company, id, id + '@test.invalid', 'test');
  const actor = { company_id: 'a', user_id: 'alice', role: 'company_admin' };
  const time = Date.parse('2026-11-15T10:00:00Z');
  await recordSigninActivity(db, actor, 'login', Date.parse('2026-11-14T18:29:59Z'));
  await recordSigninActivity(db, actor, 'login', Date.parse('2026-11-14T18:30:00Z'));
  await recordSigninActivity(db, actor, 'logout', time);
  await recordSigninActivity(db, { company_id: 'b', user_id: 'bob' }, 'login', time);
  const result = await signinActivityHandle({ db, actor, time });
  assert.equal(result.day, '2026-11-15');
  assert.deepEqual(result.items.map(item => item.event), ['logout','login']);
  assert.ok(result.items.every(item => item.user_id === 'alice'));
  assert.equal(result.items[0].name, 'alice');
  await assert.rejects(signinActivityHandle({ db, actor: { ...actor, role: 'employee' }, time }), error => error.status === 403);
  await assert.rejects(recordSigninActivity(db, actor, 'expired', time));
  for (let i = 0; i < 55; i++) await recordSigninActivity(db, actor, 'login', time + i);
  assert.equal((await signinActivityHandle({ db, actor, time })).items.length, 50);
  sqlite.exec('DROP TABLE signin_activity');
  await recordSigninActivity(db, actor, 'login', time);
  assert.equal((await signinActivityHandle({ db, actor, time })).items.length, 1);
  const token = 'a'.repeat(64);
  const tokenHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(value => value.toString(16).padStart(2, '0')).join('');
  sqlite.prepare('UPDATE users SET must_change_password=0 WHERE user_id=?').run('alice');
  sqlite.prepare('INSERT INTO sessions(token_hash,company_id,user_id,expires_at) VALUES(?,?,?,?)').run(tokenHash, 'a', 'alice', Date.now() + 60000);
  const request = (path, method = 'GET') => worker.fetch(new Request('https://hrms.test/api/v1' + path, { method, headers: { Authorization: 'Bearer ' + token } }), { DB: db });
  assert.equal((await request('/signin-activity')).status, 200);
  assert.equal((await request('/logout', 'POST')).status, 200);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM signin_activity WHERE event='logout' AND company_id='a' AND user_id='alice'").get().count, 1);
  assert.equal((await request('/signin-activity')).status, 401);
  const restQueries = [];
  const restDb = createD1RestDatabase({ account: 'test', token: 'test', databaseId: 'test', fetcher: async (_url, options) => {
    restQueries.push(JSON.parse(options.body).sql);
    if (restQueries.length === 1) return Response.json({ success: false, errors: [{ message: 'no such table: signin_activity: SQLITE_ERROR' }] }, { status: 400 });
    return Response.json({ success: true, result: [{ success: true, results: [] }] });
  } });
  assert.deepEqual((await signinActivityHandle({ db: restDb, actor, time })).items, []);
  assert.equal(restQueries.length, 4);
  assert.match(restQueries[1], /CREATE TABLE IF NOT EXISTS/);
  console.log('Sign-in activity passed: real events, IST day boundaries, tenant and role isolation, bounded feed, schema bootstrap through binding and REST gateway.');
} finally { sqlite.close(); }
