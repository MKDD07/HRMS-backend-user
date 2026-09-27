export const REQUEST_TYPES = ['leave', 'attendance', 'expense', 'other'];
export const defaultPolicy = kind => ({ id: kind, name: kind === 'attendance' ? 'Attendance corrections' : `${kind[0].toUpperCase()}${kind.slice(1)} requests`, kind, enabled: true, mode: 'any', department: '', location: '', minDays: 0, maxDays: 366, priority: 0, maxStep: 6, reminderHours: 24, escalationHours: 48, escalationUser: '' });
export const defaultResponsibilities = () => Object.fromEntries(REQUEST_TYPES.map(kind => [kind, { enabled: false, role: 'approver', step: 1, backup: '', unavailable: false, from: '', until: '' }]));
export const emptyConfiguration = () => ({ nodes: [], links: [], policies: REQUEST_TYPES.map(defaultPolicy) });
const dateValid = date => !date || (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date);
const active = person => person && person.account_status !== 'disabled' && !['Inactive', 'disabled'].includes(person.status);
export function validateConfiguration(config, people) {
  if (!config || !Array.isArray(config.nodes) || !Array.isArray(config.links) || !Array.isArray(config.policies)) return 'Invalid workflow configuration.';
  if (config.nodes.length > 5000 || config.links.length > 20000 || config.policies.length > 100) return 'Configuration exceeds the supported size.';
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
    adjacency.set(link.manager, [...(adjacency.get(link.manager) || []), link.employee]);
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
  if ([...ids].some(visit)) return 'Reporting relationships contain a loop.';
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
// Resolve once on submission. Later changes never silently reroute an existing request.
export function resolveRoute(config, people, input, now = new Date().toISOString()) {
  const byId = new Map(people.map(person => [person.id || person.userid, person]));
  const requester = byId.get(input.requester);
  if (!active(requester)) return { blocked: 'Requester is inactive or missing.', participants: [] };
  const location = requester.location || '';
  const candidates = config.policies.filter(policy => policy.enabled && policy.kind === input.kind && (!policy.department || policy.department === requester.department) && (!policy.location || policy.location === location) && (input.kind !== 'leave' || (input.days >= policy.minDays && input.days <= policy.maxDays))).sort((a,b) => b.priority - a.priority || Number(Boolean(b.department)) + Number(Boolean(b.location)) - Number(Boolean(a.department)) - Number(Boolean(a.location)) || a.id.localeCompare(b.id));
  const policy = candidates[0];
  if (!policy) return { blocked: 'No enabled policy matches this request. An administrator must configure its route.', participants: [] };
  const day = now.slice(0,10), participants = [], warnings = [];
  for (const link of config.links.filter(link => link.employee === input.requester)) {
    const setting = link.responsibilities?.[input.kind];
    if (!setting?.enabled || (setting.from && setting.from > day) || (setting.until && setting.until < day)) continue;
    if (setting.role === 'approver' && setting.step > (policy.maxStep || 6)) continue;
    let responsible = link.manager;
    if (setting.unavailable || !active(byId.get(responsible))) responsible = setting.backup;
    if (!responsible || !active(byId.get(responsible)) || responsible === input.requester) { warnings.push(`No available recipient for relationship ${link.id}.`); continue; }
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
