import { validateDepartmentRoles } from './departmentRoles.mjs';
import { leadershipReplacement, personOnLeave } from './departmentCoverage.mjs';
import { validateCompanyLeadership } from './companyLeadership.mjs';
import { istDay } from './overviewModel.mjs';
export const REQUEST_TYPES = ['leave', 'attendance', 'expense', 'other'];
export const defaultPolicy = kind => ({ id: kind, name: kind === 'attendance' ? 'Attendance corrections' : `${kind[0].toUpperCase()}${kind.slice(1)} requests`, kind, enabled: true, mode: 'any', department: '', location: '', minDays: 0, maxDays: 366, priority: 0, maxStep: 6, reminderHours: 24, escalationHours: 48, escalationUser: '' });
export const defaultResponsibilities = () => Object.fromEntries(REQUEST_TYPES.map(kind => [kind, { enabled: false, role: 'approver', step: 1, backup: '', unavailable: false, from: '', until: '' }]));
export const emptyConfiguration = () => ({ nodes: [], links: [], policies: REQUEST_TYPES.map(defaultPolicy) });
const dateValid = date => !date || (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date);
const active = person => person && person.account_status !== 'disabled' && !['Inactive', 'disabled'].includes(person.status);
export function validateConfiguration(config, people) {
  if (!config || !Array.isArray(config.nodes) || !Array.isArray(config.links) || !Array.isArray(config.policies)) return 'Invalid workflow configuration.';
  const leadershipIssue = validateCompanyLeadership(config.companyLeadership, people); if (leadershipIssue) return leadershipIssue;
  if (config.nodes.length > 5000 || config.links.length > 20000 || config.policies.length > 100) return 'Configuration exceeds the supported size.';
  if (config.departments !== undefined) {
    if (!Array.isArray(config.departments) || config.departments.length > 500) return 'Invalid department settings.';
    const names = new Set();
    for (const department of config.departments) {
      if (!department || typeof department.name !== 'string' || !department.name.trim() || department.name.length > 200 || names.has(department.name)) return 'Invalid or duplicate department.';
      names.add(department.name);
      if (department.archived !== undefined && typeof department.archived !== 'boolean') return 'Invalid department archive state.';
      if (typeof department.responsibilities !== 'string' || department.responsibilities.length > 10000 || typeof department.targets !== 'string' || department.targets.length > 10000) return 'Department targets and responsibilities must be text under 10,000 characters.';
      if (typeof department.head !== 'string' || department.head.length > 200) return 'Choose a department head from its team.';
      const roleIssue = validateDepartmentRoles(department, people); if (roleIssue) return roleIssue;
      if (department.approvals !== undefined) {
        if (!department.approvals || typeof department.approvals !== 'object' || Array.isArray(department.approvals)) return 'Invalid department responsibilities.';
        for (const [kind, assignment] of Object.entries(department.approvals)) {
          if (!REQUEST_TYPES.includes(kind) || !assignment || typeof assignment.enabled !== 'boolean' || typeof assignment.unavailable !== 'boolean') return 'Invalid department responsibility.';
          const primary = assignment.primary || department.head;
          if (![assignment.primary, assignment.backup].every(id => typeof id === 'string') || (assignment.enabled && !active(people.find(person => (person.id || person.userid) === primary))) || (assignment.backup && (!active(people.find(person => (person.id || person.userid) === assignment.backup)) || assignment.backup === primary))) return 'Choose a primary person and one different active backup.';
        }
      }
    }
  }
  if (config.departmentChart !== undefined) {
    if (!Array.isArray(config.departmentChart) || config.departmentChart.length > 500) return 'Invalid department chart.';
    const names = new Set();
    for (const group of config.departmentChart) {
      if (!group || typeof group.name !== 'string' || !group.name.trim() || group.name.length > 200 || names.has(group.name) || typeof group.expanded !== 'boolean' || !Number.isFinite(group.position?.x) || !Number.isFinite(group.position?.y)) return 'Invalid or duplicate department chart group.';
      if (group.memberIds !== undefined && (!Array.isArray(group.memberIds) || group.memberIds.length > 5000 || new Set(group.memberIds).size !== group.memberIds.length || group.memberIds.some(id=>typeof id!=='string'||!people.some(person=>(person.id||person.userid)===id)))) return 'Department chart members must be unique employees in this company.';
      names.add(group.name);
    }
  }
  const byId = new Map(people.map(person => [person.id || person.userid, person]));
  const ids = new Set();
  for (const node of config.nodes) {
    if (!byId.has(node.id) || ids.has(node.id)) return 'Chart employees must exist in this company and appear only once.';
    if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) return 'Invalid chart position.';
    ids.add(node.id);
  }
  const pairs = new Set(), linkIds = new Set(), adjacency = new Map();
  for (const link of config.links) {
    if (!ids.has(link.manager) || !ids.has(link.employee) || link.manager === link.employee || !['direct','indirect'].includes(link.type)) return 'Invalid reporting relationship.';
    const pair = JSON.stringify([link.manager,link.employee]);
    if (pairs.has(pair) || !link.id || linkIds.has(link.id)) return 'Duplicate reporting relationship.';
    pairs.add(pair); linkIds.add(link.id);
    // Temporary/indirect collaboration may point back into the reporting tree.
    // Only direct reporting defines the acyclic management hierarchy.
    if (link.type === 'direct') adjacency.set(link.manager, [...(adjacency.get(link.manager) || []), link.employee]);
    for (const responsibility of Object.values(link.responsibilities || {})) {
      if (!responsibility || typeof responsibility.enabled !== 'boolean' || !['approver','reviewer','cc'].includes(responsibility.role)) return 'Invalid responsibility role.';
      if (!Number.isInteger(responsibility.step) || responsibility.step < 1 || responsibility.step > 6) return 'Approval steps must be between 1 and 6.';
      if (!dateValid(responsibility.from) || !dateValid(responsibility.until) || (responsibility.from && responsibility.until && responsibility.from > responsibility.until)) return 'Invalid responsibility effective dates.';
      if (responsibility.backup && (!active(byId.get(responsibility.backup)) || responsibility.backup === link.employee || responsibility.backup === link.manager)) return 'Choose an active backup other than the employee or responsible person.';
      if (responsibility.enabled && !active(byId.get(link.manager)) && !responsibility.backup) return 'An inactive responsible person needs an active backup.';
    }
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if ((adjacency.get(id) || []).some(visit)) return true;
    visiting.delete(id); visited.add(id); return false;
  }
  if ([...ids].some(visit)) return 'Direct reporting relationships contain a loop.';
  const policies = new Set();
  for (const policy of config.policies) {
    if (!policy.id || policies.has(policy.id) || !REQUEST_TYPES.includes(policy.kind) || !['any','all','sequential'].includes(policy.mode) || typeof policy.enabled !== 'boolean') return 'Invalid or duplicate policy.';
    policies.add(policy.id);
    if (policy.maxStep !== undefined && (!Number.isInteger(policy.maxStep) || policy.maxStep < 1 || policy.maxStep > 6)) return 'Policies can include steps 1 through 6.';
    if (!String(policy.name || '').trim()) return 'Policy name is required.';
    if (!Number.isFinite(policy.priority) || !Number.isFinite(policy.minDays) || !Number.isFinite(policy.maxDays) || policy.minDays < 0 || policy.maxDays < policy.minDays || policy.maxDays > 366) return 'Invalid policy duration or priority.';
    if (![policy.reminderHours,policy.escalationHours].every(value => Number.isInteger(value) && value >= 1 && value <= 8760) || policy.escalationHours < policy.reminderHours) return 'Escalation must follow the reminder (1–8760 hours).';
    if (policy.escalationUser && !active(byId.get(policy.escalationUser))) return 'Choose an active escalation approver.';
  }
  return '';
}
export function resolveResponsibilityHolder(config, department, byId, primary, setting, day, requester) {
  const eligible = id => id && id !== requester && active(byId.get(id)) && !personOnLeave(byId.get(id), config.departments, day);
  const acting = leadershipReplacement(config, department, primary, day);
  if (!setting.unavailable && eligible(acting)) return acting;
  return eligible(setting.backup) ? setting.backup : '';
}

// Resolve once on submission. Later changes never silently reroute an existing request.
export function resolveRoute(config, people, input, now = new Date().toISOString()) {
  const byId = new Map(people.map(person => [person.id || person.userid, person]));
  const requester = byId.get(input.requester);
  if (!active(requester)) return { blocked: 'Requester is inactive or missing.', participants: [] };
  const location = requester.location || '';
  const candidates = config.policies.filter(policy => policy.enabled && policy.kind === input.kind && (!policy.department || policy.department === requester.department) && (!policy.location || policy.location === location) && (input.kind !== 'leave' || (input.days >= policy.minDays && input.days <= policy.maxDays))).sort((a,b) => b.priority - a.priority || Number(Boolean(b.department)) + Number(Boolean(b.location)) - Number(Boolean(a.department)) - Number(Boolean(a.location)) || a.id.localeCompare(b.id));
  const policy = candidates[0];
  if (!policy) return { blocked: 'No enabled policy matches this request. An administrator must configure its route.', participants: [] };
  const day = istDay(now), participants = [], warnings = [];
  const department = (config.departments || []).find(row => row.name === requester.department);
  const assignment = department?.approvals?.[input.kind];
  const links = assignment?.enabled ? [{ id: 'department:' + department.name, manager: assignment.primary || department.head, responsibilities: { [input.kind]: { ...assignment, role: 'approver', step: 1 } } }] : config.links.filter(link => link.employee === input.requester);
  for (const link of links) {
    const setting = link.responsibilities?.[input.kind];
    if (!setting?.enabled || (setting.from && setting.from > day) || (setting.until && setting.until < day)) continue;
    if (setting.role === 'approver' && setting.step > (policy.maxStep || 6)) continue;
    const responsible = resolveResponsibilityHolder(config, requester.department, byId, link.manager, setting, day, input.requester);
    if (!responsible) { warnings.push(`No available recipient for relationship ${link.id}.`); continue; }
    const existing = participants.find(person => person.userId === responsible);
    const candidate = { userId: responsible, originalUserId: link.manager, name: byId.get(responsible)?.name || responsible, role: setting.role, step: policy.mode === 'sequential' ? setting.step : 1, decision: 'Pending', backup: setting.backup || '', delegated: responsible !== link.manager };
    if (!existing) participants.push(candidate);
    else if (['cc','reviewer','approver'].indexOf(candidate.role) > ['cc','reviewer','approver'].indexOf(existing.role)) Object.assign(existing,candidate);
  }
  const approvers = participants.filter(person => person.role === 'approver');
  const route = { policy: { ...policy }, participants, warnings, resolvedAt: now, reminderSentAt: null, escalatedAt: null };
  if (!approvers.length || warnings.length) route.blocked = warnings.length ? 'A configured recipient is unavailable and has no valid backup.' : 'No enabled approver is assigned. This request will not be automatically approved.';
  return route;
}
// Pending requests keep their saved responsibility and can only move to its saved backup.
export function transferUnavailableApprovers(route, people, config, requester, now) {
  const day = istDay(now), byId = new Map(people.map(person => [person.id || person.userid, person]));
  const next = structuredClone(route);
  let changed = false;
  for (const participant of next.participants) {
    if (participant.role !== 'approver' || participant.decision !== 'Pending') continue;
    const current = byId.get(participant.userId), backup = byId.get(participant.backup);
    const department = (config.departments || []).find(team => team.name === byId.get(requester)?.department);
    const setting = department?.approvals?.[route.policy.kind];
    const forced = setting?.enabled && (setting.primary || department.head) === participant.userId && setting.unavailable || config.links.some(link => link.employee === requester && link.manager === participant.userId && link.responsibilities?.[route.policy.kind]?.unavailable);
    if (active(current) && !personOnLeave(current, config.departments, day) && !forced) continue;
    if (!active(backup) || backup.id === requester || backup.id === participant.userId || personOnLeave(backup, config.departments, day) || next.participants.some(other => other !== participant && other.userId === backup.id)) continue;
    participant.originalUserId ||= participant.userId;
    participant.userId = backup.id; participant.name = backup.name || backup.id;
    participant.delegated = true; participant.transferredAt = now; participant.backup = '';
    changed = true;
  }
  if (!changed) return null;
  next.resolvedAt = now; next.reminderSentAt = null; next.escalatedAt = null;
  return next;
}
export function activeApprovers(route) {
  if (route.blocked) return [];
  const pending = route.participants.filter(person => person.role === 'approver' && person.decision === 'Pending');
  if (route.policy.mode !== 'sequential') return pending;
  const step = Math.min(...pending.map(person => person.step));
  return pending.filter(person => person.step === step);
}
export function decide(route, userId, decision, now) {
  if (!['Approved','Rejected'].includes(decision)) throw new Error('Invalid decision.');
  if (!activeApprovers(route).some(person => person.userId === userId)) throw new Error('You are not an active approver for this request.');
  const next = structuredClone(route);
  const participant = next.participants.find(person => person.userId === userId && person.role === 'approver');
  participant.decision = decision; participant.decidedAt = now;
  const approvers = next.participants.filter(person => person.role === 'approver' && person.decision !== 'Escalated');
  const status = decision === 'Rejected' ? 'Rejected' : next.policy.mode === 'any' || approvers.every(person => person.decision === 'Approved') ? 'Approved' : 'Pending';
  return { route: next, status };
}

export function departmentTeam(members, people, links = []) {
  const departmentIds = new Set(members.map(person => person.id || person.userid));
  const teamIds = new Set(departmentIds);
  links.forEach(link => {
    if (link.type === 'indirect' && (departmentIds.has(link.manager) || departmentIds.has(link.employee))) {
      teamIds.add(link.manager);
      teamIds.add(link.employee);
    }
  });
  return people.filter(person => teamIds.has(person.id || person.userid));
}

export function removeTeamMemberLinks(links = [], personId, departmentMemberIds, isDirectMember = false) {
  const depIds = departmentMemberIds instanceof Set ? departmentMemberIds : new Set(departmentMemberIds);
  return links.filter(link => {
    if (isDirectMember) {
      return link.manager !== personId && link.employee !== personId;
    }
    return !(
      (link.manager === personId && depIds.has(link.employee)) ||
      (link.employee === personId && depIds.has(link.manager))
    );
  });
}
