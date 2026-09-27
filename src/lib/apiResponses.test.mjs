import assert from 'node:assert/strict';
import { payslipApi } from './payslipApi.js';
import { hrmsApi } from './api.js';

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
globalThis.localStorage = { getItem: () => 'test-token' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
try {
  globalThis.fetch = async () => new Response('<html>SPA fallback</html>');
  await assert.rejects(payslipApi.configuration(), /Payroll service is unavailable/);
  await assert.rejects(payslipApi.saveTemplate({}), /Payroll service is unavailable/);
  for (const body of [{ message: 'Unavailable' }, { templates: [], groups: [], assignments: [null] }, null]) {
    globalThis.fetch = async () => json(body);
    await assert.rejects(payslipApi.configuration());
  }
  globalThis.fetch = async () => json({ success: false, message: 'Session expired' });
  await assert.rejects(payslipApi.configuration(), /Session expired/);
  const config = { templates: [], groups: [], assignments: [], storage: null };
  globalThis.fetch = async () => json(config);
  assert.deepEqual(await payslipApi.configuration(), config);
  await assert.rejects(payslipApi.records('employee'), /records are unavailable/);
  globalThis.fetch = async () => json([]);
  assert.deepEqual(await payslipApi.records('employee'), []);

  const requests = [];
  let failLeaves = false;
  let emptyDirectory = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/get-all-users')) return json({ success: true, data: emptyDirectory ? [] : [{ userid: 'A & B' }, { userid: 'C' }, { userid: 'C' }] });
    const userid = parsed.searchParams.get('userid');
    assert.ok(userid, 'Every leave request must include userid');
    requests.push(userid);
    if (failLeaves) return json({ success: false, message: 'Session expired' });
    return json({ success: true, data: userid === 'C' ? [] : [{ id: 1 }] });
  };
  assert.deepEqual(await hrmsApi.getLeaves(undefined, { liveOnly: true }), { success: true, data: [{ id: 1, userid: 'A & B', leave_id: 1, start_date: undefined, end_date: undefined }] });
  assert.deepEqual(requests.sort(), ['A & B', 'C']);
  failLeaves = true;
  await assert.rejects(hrmsApi.getLeaves(undefined, { liveOnly: true }), /Session expired/);
  emptyDirectory = true;
  assert.deepEqual(await hrmsApi.getLeaves(undefined, { liveOnly: true }), { success: true, data: [] });
  globalThis.fetch = async () => json({ success: false, message: 'Not saved' });
  await assert.rejects(hrmsApi.applyLeave({ userid: 'C' }, { liveOnly: true }), /Not saved/);
  await assert.rejects(hrmsApi.reviewLeave({ leave_id: 1 }, { liveOnly: true }), /Not saved/);
  await assert.rejects(hrmsApi.getLeaveBalances('C'), /not configured/);
  await assert.rejects(hrmsApi.getHolidays(), /not configured/);
  globalThis.fetch = async () => json({ success: true, data: [] });
  assert.deepEqual((await hrmsApi.getLeaves('C')).data, [], 'Empty live records must not become demo leaves');
  console.log('API response regressions passed.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}
