import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPayrollDatabase } from './payrollDatabase.mjs';
import { payrollAuthorization } from './payrollRoutes.mjs';

test('missing cloud credentials fail closed instead of creating a local database', () => {
  assert.throws(() => createPayrollDatabase({ env: {} }), /Local database fallback is disabled/);
});
test('explicit test databases remain available', () => {
  const db = createPayrollDatabase({ filename: ':memory:', env: {} });
  assert.equal(db.mode, 'SQLite (local)');
  db.close();
});
test('old local administrator flag cannot bypass company authentication', async () => {
  assert.equal(await payrollAuthorization({ headers: { host: 'localhost:3000' }, socket: { remoteAddress: '127.0.0.1' } }, { PAYROLL_LOCAL_DEV: 'true' }), null);
});
