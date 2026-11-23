export const COMPANY_ROLES = ['Owner', 'CEO', 'CTO', 'Manager', 'HR'];
export function validateCompanyLeadership(value, people) {
  if (value === undefined) return '';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Invalid company leadership.';
  for (const roles of [value.draft || {}, value.finalized?.roles || {}]) {
    if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return 'Invalid leadership assignments.';
    for (const [role, id] of Object.entries(roles)) {
      if (!COMPANY_ROLES.includes(role) || typeof id !== 'string' || (id && !people.some(person => (person.id || person.userid) === id && person.account_status !== 'disabled' && !['Inactive', 'disabled'].includes(person.status)))) return 'Choose an active company employee for each leadership role.';
    }
  }
  return '';
}
