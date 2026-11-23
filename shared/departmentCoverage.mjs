const idOf = person => person.id || person.userid;
const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
export function personOnLeave(person, departments = [], day) {
  if (!validDay(day)) return false;
  return (person.approvedLeave || []).some(row => row.from <= day && day <= row.until) || departments.some(department => (department.leadershipCoverage || []).some(row => row.person === idOf(person) && row.from <= day && day <= row.until));
}
export function validateDepartmentCoverage(department, people) {
  const rows = department.leadershipCoverage || [];
  if (!Array.isArray(rows) || rows.length > 500) return 'Invalid leadership coverage.';
  const roles = department.memberRoles || {};
  for (const row of rows) {
    const member = id => people.some(person => idOf(person) === id && person.department === department.name && person.account_status !== 'disabled' && !['Inactive', 'disabled'].includes(person.status));
    if (!row || !['Manager', 'Team leader'].includes(row.role) || !member(row.person) || !member(row.cover) || row.person === row.cover) return 'Choose different active department members for leadership coverage.';
    if (['Manager', 'Team leader'].includes(roles[row.cover]) || department.head === row.cover) return 'Choose a team member who does not already hold a leadership role.';
    if (roles[row.person] !== row.role && !(row.role === 'Team leader' && department.head === row.person)) return 'Coverage must refer to the current Manager or Team leader.';
    if (!validDay(row.from) || !validDay(row.until) || row.from > row.until) return 'Choose a valid coverage start and end date.';
    if (rows.some(other => other !== row && other.from <= row.until && row.from <= other.until && (other.role === row.role || [other.person, other.cover].some(id => [row.person, row.cover].includes(id))))) return 'Overlapping leadership coverage is not allowed for the same role or person.';
  }
  return '';
}
export function leadershipReplacement(config, departmentName, person, day) {
  const department = (config.departments || []).find(row => row.name === departmentName);
  return department?.leadershipCoverage?.find(row => row.person === person && row.from <= day && day <= row.until)?.cover || person;
}
export function effectiveDepartmentLeadership(department, day) {
  if (!department) return department;
  const roles = { ...(department.memberRoles || {}) };
  let head = department.head;
  const acting = {};
  const unavailable = {};
  for (const row of department.leadershipCoverage || []) {
    if (row.from > day || row.until < day) continue;
    delete roles[row.person];
    roles[row.cover] = row.role;
    acting[row.cover] = row.role;
    unavailable[row.person] = row.role;
    if (row.role === 'Team leader') head = row.cover;
  }
  return { ...department, memberRoles: roles, head, actingRoles: acting, unavailableRoles: unavailable };
}
