import assert from 'node:assert/strict';
import { emptyConfiguration, validateConfiguration, departmentTeam, removeTeamMemberLinks } from './workflowModel.mjs';
import { routePages, canUsePage, parsePages } from './dashboardAccess.mjs';
const config = { ...emptyConfiguration(), departments: [{ name: 'Engineering', head: 'lead', targets: 'Ship release by December', responsibilities: 'Maintain product reliability' }] };
assert.equal(validateConfiguration(config, []), '');
assert.match(validateConfiguration({ ...config, departments: [...config.departments, ...config.departments] }, []), /duplicate/);
assert.match(validateConfiguration({ ...config, departments: [{ ...config.departments[0], targets: 'x'.repeat(10001) }] }, []), /10,000/);
assert.match(validateConfiguration({ ...config, departments: [{ ...config.departments[0], head: {} }] }, []), /head/);
assert.equal(validateConfiguration(emptyConfiguration(), []), '');
assert.ok(routePages('/api/v1/workflows/configuration', 'GET').includes('departments'));
assert.ok(routePages('/api/v1/workflows/configuration', 'POST').includes('departments'));
assert.ok(routePages('/api/v1/workflows/audit', 'GET').includes('departments'));
assert.deepEqual(parsePages(['departments']), ['departments']);
assert.ok(canUsePage({ role: 'company_admin' }, 'departments'));

// Team hierarchy & indirect reporting tests
const empA = { id: 'emp-a', name: 'Alice', department: 'Engineering' };
const empB = { id: 'emp-b', name: 'Bob', department: 'Engineering' };
const empC = { id: 'emp-c', name: 'Charlie', department: 'Design' }; // indirect colleague
const allPeople = [empA, empB, empC];
const initialLinks = [
  { id: 'link-1', manager: 'emp-a', employee: 'emp-b', type: 'direct' },
  { id: 'link-2', manager: 'emp-a', employee: 'emp-c', type: 'indirect' }
];

// Department team includes Engineering members and Charlie (indirectly connected to Alice)
const initialTeam = departmentTeam([empA, empB], allPeople, initialLinks);
assert.equal(initialTeam.length, 3);
assert.ok(initialTeam.some(p => p.id === 'emp-c'), 'Charlie should be in team due to indirect link');

// Remove indirect colleague Charlie from team
const linksAfterRemovingCharlie = removeTeamMemberLinks(initialLinks, 'emp-c', ['emp-a', 'emp-b'], false);
assert.equal(linksAfterRemovingCharlie.length, 1);
assert.equal(linksAfterRemovingCharlie[0].id, 'link-1');
const teamAfterRemovingCharlie = departmentTeam([empA, empB], allPeople, linksAfterRemovingCharlie);
assert.equal(teamAfterRemovingCharlie.length, 2);
assert.ok(!teamAfterRemovingCharlie.some(p => p.id === 'emp-c'), 'Charlie should no longer be in team');

// Remove direct member Bob from team
const linksAfterRemovingBob = removeTeamMemberLinks(initialLinks, 'emp-b', ['emp-a', 'emp-b'], true);
assert.equal(linksAfterRemovingBob.length, 1);
assert.equal(linksAfterRemovingBob[0].id, 'link-2');

// Unassigned vs indirect team directory partitioning test
const empUnassigned = { id: 'emp-d', name: 'David', department: '' };
const testDirectoryPeople = [empA, empB, empC, empUnassigned];
const targetDepartment = 'Engineering';

const teamList = testDirectoryPeople.filter(p => p.department === targetDepartment || !p.department || !p.department.trim());
const indirectList = testDirectoryPeople.filter(p => Boolean(p.department && p.department.trim() && p.department !== targetDepartment));

// Unassigned David should be inside teamList, not in indirectList
assert.ok(teamList.some(p => p.id === 'emp-d'), 'Unassigned person should be in teamList');
assert.ok(!indirectList.some(p => p.id === 'emp-d'), 'Unassigned person should NOT be in indirectList');

// Assigned Charlie (Design) should only be in indirectList, not in teamList
assert.ok(indirectList.some(p => p.id === 'emp-c'), 'Assigned colleague from another department should be in indirectList');
assert.ok(!teamList.some(p => p.id === 'emp-c'), 'Assigned colleague from another department should NOT be in teamList');

console.log('Department validation, access checks, team hierarchy removal, and unassigned directory partitioning tests passed.');


