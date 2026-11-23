import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveDepartmentLeadership, validateDepartmentCoverage, personOnLeave } from './departmentCoverage.mjs';
import { emptyConfiguration, defaultResponsibilities, resolveRoute } from './workflowModel.mjs';
const people = ['manager', 'cover', 'employee'].map(id => ({ id, department: 'Engineering', status: 'Active' }));
const department = { name: 'Engineering', head: '', memberRoles: { manager: 'Manager' }, leadershipCoverage: [{ role: 'Manager', person: 'manager', cover: 'cover', from: '2026-10-15', until: '2026-10-20' }] };
test('leave indicator includes approved leave and scheduled cover dates without marking the replacement absent', () => {
  const person = { id: 'employee', approvedLeave: [{ from: '2026-10-15', until: '2026-10-20' }] };
  assert.equal(personOnLeave(person, [], '2026-10-15'), true);
  assert.equal(personOnLeave(person, [], '2026-10-20'), true);
  assert.equal(personOnLeave(person, [], '2026-10-21'), false);
  assert.equal(personOnLeave({ id: 'manager' }, [department], '2026-10-16'), true);
  assert.equal(personOnLeave({ id: 'cover' }, [department], '2026-10-16'), false);
  assert.equal(personOnLeave(person, [], ''), false);
});
test('acting leader applies inclusively and permanent role restores afterwards', () => {
  assert.equal(validateDepartmentCoverage(department, people), '');
  for (const day of ['2026-10-15', '2026-10-20']) assert.equal(effectiveDepartmentLeadership(department, day).memberRoles.cover, 'Manager');
  for (const day of ['2026-10-14', '2026-10-21']) assert.equal(effectiveDepartmentLeadership(department, day).memberRoles.manager, 'Manager');
  assert.equal(department.memberRoles.manager, 'Manager');
});
test('invalid members, dates and overlapping coverage are rejected', () => {
  const row = department.leadershipCoverage[0];
  for (const change of [{ cover: 'unknown' }, { cover: 'manager' }, { until: '2026-10-14' }, { from: '2026-02-30' }]) assert.ok(validateDepartmentCoverage({ ...department, leadershipCoverage: [{ ...row, ...change }] }, people));
  assert.ok(validateDepartmentCoverage({ ...department, leadershipCoverage: [row, { ...row }] }, people));
});
test('new approval routes use dated cover; existing routes remain unchanged and self approval is blocked', () => {
  const responsibilities = defaultResponsibilities();
  responsibilities.leave.enabled = true;
  const config = { ...emptyConfiguration(), departments: [department], links: [{ id: 'report', employee: 'employee', manager: 'manager', responsibilities }] };
  const before = resolveRoute(config, people, { requester: 'employee', kind: 'leave', days: 1 }, '2026-10-14');
  const during = resolveRoute(config, people, { requester: 'employee', kind: 'leave', days: 1 }, '2026-10-15');
  assert.equal(before.participants[0].userId, 'manager');
  assert.equal(during.participants[0].userId, 'cover');
  assert.equal(during.participants[0].originalUserId, 'manager');
  assert.equal(during.participants[0].delegated, true);
  assert.equal(before.participants[0].userId, 'manager');
  config.links[0].employee = 'cover';
  assert.ok(resolveRoute(config, people, { requester: 'cover', kind: 'leave', days: 1 }, '2026-10-15').blocked);
});
