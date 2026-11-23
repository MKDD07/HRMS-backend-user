import test from 'node:test';
import assert from 'node:assert/strict';
import { assignDepartmentRole, validateDepartmentRoles } from './departmentRoles.mjs';
const people = ['a', 'b', 'c'].map(id => ({ id, department: 'Sales' }));
test('leadership roles are unique; custom roles remain assigned to multiple people', () => {
  let department = { name: 'Sales', head: '', customRoles: ['Mentor'], memberRoles: {} };
  department = assignDepartmentRole(department, 'a', 'Team leader');
  department = assignDepartmentRole(department, 'b', 'Manager');
  department = assignDepartmentRole(department, 'c', 'Team leader');
  assert.equal(department.head, 'c'); assert.equal(department.memberRoles.a, undefined); assert.equal(department.memberRoles.b, 'Manager');
  department = assignDepartmentRole(department, 'a', 'Mentor');
  department = assignDepartmentRole(department, 'b', 'Mentor');
  assert.equal(department.memberRoles.a, 'Mentor'); assert.equal(department.memberRoles.b, 'Mentor');
  assert.equal(validateDepartmentRoles(department, people), '');
  department = assignDepartmentRole(department, 'c', '');
  assert.equal(department.head, ''); assert.equal(department.memberRoles.c, undefined);
});
test('roles reject cross-department employees, unknown roles, and duplicate leaders', () => {
  assert.match(validateDepartmentRoles({ name: 'Other', memberRoles: { a: 'Manager' } }, people), /members/);
  assert.match(validateDepartmentRoles({ name: 'Sales', memberRoles: { a: 'Owner' } }, people), /configured/);
  assert.match(validateDepartmentRoles({ name: 'Sales', memberRoles: { a: 'Manager', b: 'Manager' } }, people), /one person/);
});
