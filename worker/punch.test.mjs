import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { punchHandle, resolvePunchPolicy, validatePunch } from './punch.mjs';

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE employees(company_id TEXT,user_id TEXT,employee_id TEXT,profile TEXT);
CREATE TABLE geofence_sites(company_id TEXT,group_id TEXT,payload TEXT);
CREATE TABLE attendance(attendance_id TEXT PRIMARY KEY,company_id TEXT,employee_id TEXT,date TEXT,check_in_time TEXT,check_out_time TEXT,UNIQUE(company_id,employee_id,date));
INSERT INTO employees VALUES('c','u','e','{}'),('other','u','foreign','{}');`);
sql.exec(readFileSync(new URL('../migrations/hrms/0016_attendance_punch_evidence.sql', import.meta.url), 'utf8'));
function prepare(text, args = []) { return {
  bind(...values) { return prepare(text, values); },
  async first() { return sql.prepare(text).get(...args) || null; },
  async all() { return { results: sql.prepare(text).all(...args) }; },
  async run() { return sql.prepare(text).run(...args); }
}; }
const db = { prepare, async batch(statements) { sql.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.run()); sql.exec('COMMIT'); return result; } catch (error) { sql.exec('ROLLBACK'); throw error; } } };
const objects = new Map();
const env = { HRMS_IMAGES: { async put(key, bytes) { objects.set(key, bytes); return {}; }, async head(key) { return objects.has(key) ? {} : null; } } };
const actor = { company_id: 'c', user_id: 'u' };
const call = (path, body = {}, now = new Date('2026-10-13T05:00:00Z'), method = 'POST') => punchHandle({ db, env, actor, path: '/api/v1/' + path, method, body, now });
const setRule = rule => sql.prepare("UPDATE employees SET profile=? WHERE company_id='c'").run(JSON.stringify({ attendance_rule: rule }));
assert.equal(resolvePunchPolicy(null).mode, 'without_camera');
assert.equal(resolvePunchPolicy({ mode: 'none', photo_required: true }).mode, 'with_camera');
assert.equal(resolvePunchPolicy({ mode: 'custom', status: 'Paused', photo_required: true }).mode, 'without_camera');
assert.throws(() => resolvePunchPolicy({ mode: 'group', group_id: 'missing' }));
const location = { mode: 'custom', latitude: 19, longitude: 72, radius_meters: 100, photo_required: false };
const policy = resolvePunchPolicy(location);
assert.equal(policy.mode, 'only_location_based');
assert.doesNotThrow(() => validatePunch(policy, { latitude: 19, longitude: 72 }));
assert.throws(() => validatePunch(policy, {}));
assert.throws(() => validatePunch(policy, { latitude: 20, longitude: 72 }));
assert.equal(resolvePunchPolicy({ mode: 'group', photo_required: false }, { ...location, photo_required: true, is_unrestricted: true }).mode, 'without_camera');
await assert.rejects(call('user-attendance', { action: 'punch_out' }), /No open/);
await assert.rejects(call('user-attendance', { action: 'punch_in', userid: 'foreign' }), /own attendance/);
await call('user-attendance', { action: 'punch_in' });
await assert.rejects(call('user-attendance', { action: 'punch_in' }), /already recorded/);
setRule({ mode: 'none', photo_required: true });
await assert.rejects(call('user-attendance', { action: 'punch_out' }), /selfie/);
await assert.rejects(call('user-attendance', { action: 'punch_out', photo_key: 12 }), /selfie/);
const photo = await call('attendance/upload-image', { image: 'data:image/jpeg;base64,/9j/AA==' });
await call('user-attendance', { action: 'punch_out', photo_key: photo.key });
await assert.rejects(call('user-attendance', { action: 'punch_out', photo_key: photo.key }), /new selfie/);
const status = await call('getTodaysAttendance', {}, undefined, 'GET');
assert.equal(status[0].in_time, '10:30:00');
assert.equal(status[0].out_time, '10:30:00');
assert.ok(status[0].move_out_url.includes(encodeURIComponent(photo.key)));
assert.equal(sql.prepare("SELECT count(*) n FROM attendance WHERE company_id='other'").get().n, 0);
// Existing overnight punch remains available and is closed on its original date.
sql.exec("DELETE FROM attendance_punch_evidence; DELETE FROM attendance;");
setRule(location);
await assert.rejects(call('user-attendance', { action: 'punch_in' }), /GPS/);
await call('user-attendance', { action: 'punch_in', latitude: 19, longitude: 72 }, new Date('2026-10-13T17:00:00Z'));
const overnight = await call('getTodaysAttendance', {}, new Date('2026-10-13T20:00:00Z'), 'GET');
assert.equal(overnight[0].att_date, '2026-10-13');
const out = await call('user-attendance', { action: 'punch_out', latitude: 19, longitude: 72 }, new Date('2026-10-13T20:00:00Z'));
assert.equal(out.date, '2026-10-13');
console.log('Punch mode, photo, geofence, ownership, status and overnight checks passed.');
