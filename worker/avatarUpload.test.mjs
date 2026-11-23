import { createCanvas } from '@napi-rs/canvas';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './index.mjs';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec(readFileSync(new URL('../migrations/hrms/0001_core.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0002_employee_codes.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0003_company_branding.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0004_approval_workflows.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0005_hr_connect.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0006_dashboard_access.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0007_billing.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0018_billing_recurring.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0019_billing_renewal_guards.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0020_billing_workspace_policy.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0008_holiday_cache.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0009_talent_operations.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0010_asset_issues.sql', import.meta.url), 'utf8'));
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
  await call('/platform/companies', { token: env.OWNER_PROVISIONING_TOKEN, body: { company_name: 'Photo Company', username: 'photo-admin', password } });
  await call('/platform/companies', { token: env.OWNER_PROVISIONING_TOKEN, body: { company_name: 'Other Company', username: 'other-admin', password } });
  const admin = await activate('photo-admin'), other = await activate('other-admin');
  const employee = await call('/create-user', {token: admin.token, body: {password, first_name:'Aarav', last_name:'Sharma'}});
  const canvas = createCanvas(144,144); canvas.getContext('2d').fillRect(0,0,144,144);
  const image = canvas.toDataURL('image/webp');
  const photo = await call('/upload-avatar', {token:admin.token,body:{userid:employee.user_id,image}});
  assert.match(photo.key, /^photo-company-[^/]+\/profile\/aarav-sharma-[^/]+\/[^/]+\.webp$/);
  const path='/avatar?key='+encodeURIComponent(photo.key);
  await call(path,{token:other.token,status:404});
  await call(path,{status:401});
  const response=await worker.fetch(new Request('https://hrms.test/api/v1'+path,{headers:{Authorization:'Bearer '+admin.token}}),env);
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(image.split(',')[1],'base64'));
  const stored=sqlite.prepare('SELECT profile FROM employees WHERE user_id=?').get(employee.user_id);
  assert.equal(JSON.parse(stored.profile).profile_pic_url,photo.key);
  const legacy='profile/old-company/person.png';objects.set(legacy,new Uint8Array([1,2,3]));
  sqlite.prepare('UPDATE employees SET profile=? WHERE user_id=?').run(JSON.stringify({profile_pic_url:legacy}),employee.user_id);
  const old=await worker.fetch(new Request('https://hrms.test/api/v1/avatar?key='+encodeURIComponent(legacy),{headers:{Authorization:'Bearer '+admin.token}}),env);
  assert.equal(old.status,200);assert.equal(old.headers.get('Content-Type'),'image/png');
  console.log('Avatar upload checks passed: WebP storage, database key, company/person folders, authorization and legacy photos.');
} finally { sqlite.close(); }
