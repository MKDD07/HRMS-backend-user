import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { allowedOrigin } from './index.mjs';

const config = readFileSync(new URL('../wrangler.company.toml', import.meta.url), 'utf8');
const origins = config.match(/^ALLOWED_ORIGINS = "([^"]+)"/m)[1];
const frontend = 'https://hrms-backend-user.mkmkataria07.workers.dev';
for (const allowed of [origins, '*']) {
  const env = { ALLOWED_ORIGINS: allowed, DB: {} };
  for (const method of ['OPTIONS', 'GET']) {
    const response = await worker.fetch(new Request('https://hrms-api.test/api/v1/health', {
      method, headers: { Origin: frontend, 'Access-Control-Request-Headers': 'authorization,content-type' }
    }), env);
    assert.equal(response.status, method === 'OPTIONS' ? 204 : 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), frontend);
    assert.match(response.headers.get('Access-Control-Allow-Headers'), /Authorization/);
  }
  const unauthorized = await worker.fetch(new Request('https://hrms-api.test/api/v1/get-all-users', {
    headers: { Origin: frontend }
  }), env);
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get('Access-Control-Allow-Origin'), frontend);
}
const denied = await worker.fetch(new Request('https://hrms-api.test/api/v1/health', {
  headers: { Origin: 'https://untrusted.example' }
}), { ALLOWED_ORIGINS: origins });
assert.equal(denied.status, 403);
assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
const localEnv = { ALLOWED_ORIGINS: origins, ALLOW_LOCALHOST_ORIGINS: 'true', DB: {} };
for (const origin of ['http://localhost:49510', 'http://localhost:60842', 'http://127.0.0.1:49510', 'http://[::1]:49510']) {
  assert.equal(allowedOrigin(origin, localEnv), true);
  const preflight = await worker.fetch(new Request('https://hrms-api.test/api/v1/login', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } }), localEnv);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(preflight.headers.get('Vary'), 'Origin');
  const deniedSession = await worker.fetch(new Request('https://hrms-api.test/api/v1/auth/verify', { headers: { Origin: origin } }), localEnv);
  assert.equal(deniedSession.status, 401);
  assert.equal(deniedSession.headers.get('Access-Control-Allow-Origin'), origin);
}
assert.equal(allowedOrigin('http://localhost:49510', { ALLOWED_ORIGINS: origins }), false);
for (const origin of ['null', 'http://localhost.evil.example:49510', 'http://127.0.0.1.evil.example', 'http://localhost:49510/path', 'http://user@localhost:49510', 'ftp://localhost']) {
  assert.equal(allowedOrigin(origin, localEnv), false, origin);
}
assert.equal(allowedOrigin(null, localEnv), true);
console.log('Worker CORS checks passed, including Flutter dynamic localhost ports.');
