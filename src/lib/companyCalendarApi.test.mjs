import assert from 'node:assert/strict';
import { companyCalendarApi } from './companyCalendarApi.js';
const originalFetch = globalThis.fetch, originalStorage = globalThis.localStorage;
globalThis.localStorage = { getItem: () => 'calendar-test-token' };
try {
  const calls = [];
  const configuration = { holidays: [], leaveTypes: [], groups: [], assignments: [] };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ success: true, data: configuration });
  };
  assert.deepEqual(await companyCalendarApi.configuration(), configuration);
  assert.match(calls[0].url, /\/api\/v1\/company-calendar\/configuration$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer calendar-test-token');
  await companyCalendarApi.saveHoliday({ name: 'Holiday', date: '2026-12-25' });
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(JSON.parse(calls[1].options.body).name, 'Holiday');
  await companyCalendarApi.deleteHoliday('holiday-id');
  assert.equal(calls[2].options.method, 'DELETE');
  assert.match(calls[2].url, /\/company-calendar\/holidays\/holiday-id$/);
  globalThis.fetch = async () => Response.json({ success: false, message: 'Session expired' }, { status: 401 });
  await assert.rejects(companyCalendarApi.configuration(), /Session expired/);
  console.log('Calendar client checks passed: Cloudflare URL, authentication, response data, mutations and server errors.');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalStorage;
}
