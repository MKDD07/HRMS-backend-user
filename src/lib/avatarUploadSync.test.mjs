import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const storage = new Map([['pulse_hrms_token', 'test-session'], ['pulse_hrms_user', JSON.stringify({ userid: 'person' })]]);
globalThis.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
globalThis.window = new EventTarget();
window.location = { hostname: 'localhost' };
globalThis.Image = class { constructor() { this.naturalWidth = this.naturalHeight = 144; } async decode() {} };
const events = [];
for (const name of ['storage', 'pulse-users-updated', 'pulse-avatar-updated']) window.addEventListener(name, event => events.push(event));
const key = 'company-id/profile/person-id/photo.webp';
globalThis.fetch = async () => new Response(JSON.stringify({ success: true, data: { profile_pic_url: key } }), { headers: { 'Content-Type': 'application/json' } });
const path = resolve('.avatar-upload-sync-check.mjs');
try {
  const output = await build({ entryPoints: ['src/lib/api.js'], bundle: true, packages: 'external', platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  await writeFile(path, output.outputFiles[0].text);
  const { hrmsApi } = await import(pathToFileURL(path));
  const result = await hrmsApi.uploadAvatar('person', 'data:image/webp;base64,dGVzdA==');
  assert.equal(result.profile_pic_url, key);
  assert.equal(JSON.parse(storage.get('pulse_hrms_user')).profile_pic_url, key);
  assert.deepEqual(events.map(event => event.type), ['pulse-avatar-updated'], 'photo update must not reset image caches or reload the directory');
  assert.equal(events[0].detail.profile_pic_url, key);
  console.log('Avatar synchronization checks passed.');
} finally { await unlink(path).catch(() => {}); }
