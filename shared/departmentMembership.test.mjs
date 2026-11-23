import test from 'node:test';
import assert from 'node:assert/strict';
import { departmentMembers, availableTeamPeople } from './departmentMembership.mjs';

test('temporary membership excludes available people without changing their department', () => {
  const people = [{ id: 'a', department: 'Engineering' }, { id: 'b', department: 'Sales' }, { id: 'c', department: 'Sales' }];
  const members = departmentMembers('Engineering', people, ['b']);
  assert.deepEqual(members.map(person => person.id), ['a', 'b']);
  assert.equal(members[1].department, 'Sales');
  assert.deepEqual(availableTeamPeople(people, members).map(person => person.id), ['c']);
  assert.deepEqual(availableTeamPeople(people, departmentMembers('Engineering', people)).map(person => person.id), ['b', 'c']);
  assert.deepEqual(departmentMembers('General', people), people);
});
