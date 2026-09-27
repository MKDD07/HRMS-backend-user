import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captchaConfiguration, verifyCaptcha } from './recaptcha.mjs';
import worker from './index.mjs';
const env = { RECAPTCHA_ENABLED: 'true', RECAPTCHA_SITE_KEY: 'public-site-key', RECAPTCHA_SECRET_KEY: 'test-server-secret', RECAPTCHA_ALLOWED_HOSTNAMES: 'nexthr.com,www.nexthr.com' };
test('blank site key disables the widget and server challenge', async () => {
  const disabled = { ...env, RECAPTCHA_SITE_KEY: '' };
  assert.deepEqual(captchaConfiguration(disabled), { enabled: false, siteKey: '', mode: 'invisible' });
  await verifyCaptcha(disabled, undefined, () => { throw new Error('Google must not be contacted when disabled'); });
});
test('configuration exposes only public fields', () => {
  assert.deepEqual(captchaConfiguration(env), { enabled: true, siteKey: 'public-site-key', mode: 'invisible' });
});
test('rejects missing tokens without contacting Google', async () => {
  await assert.rejects(verifyCaptcha(env, '', () => { throw new Error('must not call'); }), { status: 400 });
});
test('configured verification fails closed without secret or allowed domains', async () => {
  await assert.rejects(verifyCaptcha({ ...env, RECAPTCHA_SECRET_KEY: '' }, 'token'), { status: 503 });
  await assert.rejects(verifyCaptcha({ ...env, RECAPTCHA_ALLOWED_HOSTNAMES: '' }, 'token'), { status: 503 });
});
test('sends the token and secret only to Google and accepts an allowed hostname', async () => {
  await verifyCaptcha(env, 'single-use-token', async (url, options) => {
    assert.equal(url, 'https://www.google.com/recaptcha/api/siteverify');
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('secret'), env.RECAPTCHA_SECRET_KEY);
    assert.equal(options.body.get('response'), 'single-use-token');
    return Response.json({ success: true, hostname: 'nexthr.com' });
  });
});
test('rejects expired, replayed and wrong-domain tokens', async () => {
  for (const result of [{ success: false, 'error-codes': ['timeout-or-duplicate'] }, { success: true, hostname: 'evil.example' }, { success: true }]) {
    await assert.rejects(verifyCaptcha(env, 'token', async () => Response.json(result)), { status: 403 });
  }
});
test('network and malformed responses do not bypass verification', async () => {
  await assert.rejects(verifyCaptcha(env, 'token', async () => { throw new Error('network'); }), { status: 503 });
  await assert.rejects(verifyCaptcha(env, 'token', async () => new Response('unavailable', { status: 503 })), { status: 503 });
});
test('login route rejects a missing CAPTCHA before looking up credentials', async () => {
  let calls = 0;
  const DB = { prepare(sql) { assert.match(sql, /INSERT INTO login_attempts/); calls++; return { bind() { return { first: async () => ({ attempts: 1 }) }; } }; } };
  const response = await worker.fetch(new Request('https://nexthr.com/api/v1/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'not-used' }) }), { ...env, DB });
  assert.equal(response.status, 400);
  assert.equal(calls, 1);
});

test('stale site and secret keys cannot enable CAPTCHA without explicit opt-in', async () => {
 const disabled = { ...env, RECAPTCHA_ENABLED: undefined };
 assert.equal(captchaConfiguration(disabled).enabled, false);
 await verifyCaptcha(disabled, undefined, () => { throw new Error('Must not contact Google'); });
});
