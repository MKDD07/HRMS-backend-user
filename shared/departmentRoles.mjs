import { validateDepartmentCoverage } from './departmentCoverage.mjs';
export const LEADERSHIP_ROLES = ['Team leader', 'Manager'];
export function assignDepartmentRole(department, userid, role) {
  const roles = { ...(department.memberRoles || {}) };
  delete roles[userid];
  if (LEADERSHIP_ROLES.includes(role)) {
    for (const [id, assigned] of Object.entries(roles)) if (assigned === role) delete roles[id];
  }
  if (role) roles[userid] = role;
  const head = role === 'Team leader' ? userid : department.head === userid ? '' : department.head || '';
  return { ...department, memberRoles: roles, head, leadershipCoverage: (department.leadershipCoverage || []).filter(row => (roles[row.person] === row.role || (row.role === 'Team leader' && head === row.person))) };
}
export function validateDepartmentRoles(department, people) {
  if (department.themeIndex !== undefined && (!Number.isInteger(department.themeIndex) || department.themeIndex < 0 || department.themeIndex >= 20)) return 'Invalid department color.';
  const coverageIssue = validateDepartmentCoverage(department, people);
  if (coverageIssue) return coverageIssue;
  const temporary = department.temporaryMembers || [];
  if (!Array.isArray(temporary) || temporary.length > 5000 || new Set(temporary).size !== temporary.length || temporary.some(id => typeof id !== 'string' || !people.some(person => (person.id || person.userid) === id))) return 'Temporary team members must exist in this company and appear only once.';
  const custom = department.customRoles || [];
  if (!Array.isArray(custom) || custom.length > 50 || custom.some(role => typeof role !== 'string' || !role.trim() || role.length > 60 || LEADERSHIP_ROLES.includes(role)) || new Set(custom).size !== custom.length) return 'Invalid custom department roles.';
  const roles = department.memberRoles || {};
  if (typeof roles !== 'object' || Array.isArray(roles) || roles === null) return 'Invalid department role assignments.';
  const leaders = new Set();
  for (const [id, role] of Object.entries(roles)) {
    if (!people.some(person => (person.id || person.userid) === id && person.department === department.name)) return 'Department roles must belong to members of that department.';
    if (![...LEADERSHIP_ROLES, ...custom].includes(role)) return 'Choose a configured department role.';
    if (LEADERSHIP_ROLES.includes(role)) { if (leaders.has(role)) return 'Only one person can hold each leadership role.'; leaders.add(role); }
  }
  return '';
}
