import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyActorPolicy, enforcePlanRequest, createPlanPolicyReader } from './planPolicy.mjs';

test('authentication and route checks share policy and seats only within one request', async () => {
  const counts = { policy: 0, subscription: 0, seats: 0 };
  let limit = 10;
  const db = { prepare(sql) { return { bind() { return {
    async first() {
      if (sql.includes('billing_workspace_policy')) { counts.policy++; return null; }
      if (sql.includes('company_subscriptions')) { counts.subscription++; return { plan_id: 'business', employee_limit: limit, dashboard_limit: 3 }; }
      throw Error('Unexpected query');
    },
    async all() { counts.seats++; return { results: [{ user_id: 'u', employee_id: 'e', employee_code: 'A-1', status: 'Active', dashboard_access: 1 }] }; }
  }; } }; } };
  const user = { company_id: 'a', user_id: 'u', role: 'employee', dashboard_access: 1 };
  const reader = createPlanPolicyReader(db);
  await applyActorPolicy(db, user, reader);
  await enforcePlanRequest(db, user, '/api/v1/get-all-users', 'GET', { userid: 'u' }, reader);
  await reader.seats('a', await reader.policy('a'));
  assert.deepEqual(counts, { policy: 1, subscription: 1, seats: 1 });
  limit = 0;
  await assert.rejects(applyActorPolicy(db, user, createPlanPolicyReader(db)), { status: 403 });
  assert.deepEqual(counts, { policy: 2, subscription: 2, seats: 2 });
});

test('one reader keeps companies isolated and deduplicates concurrent lookups', async () => {
  let calls = 0;
  const db = { prepare() { return { bind(company) { return { async first() { calls++; return { company }; } }; } }; } };
  const reader = createPlanPolicyReader(db);
  const [first, repeated, other] = await Promise.all([reader.policy('a'), reader.policy('a'), reader.policy('b')]);
  assert.equal(first, repeated);
  assert.notEqual(first, other);
  assert.equal(calls, 4); // State and subscription, once per company.
});
