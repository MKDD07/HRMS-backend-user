/** Leadership display links derive from finalized roles, separate from approval rules. */
export function departmentLeadershipLinks(department, members) {
  if (!department || department.name === 'General') return [];
  const ids = new Set(members.map(person => person.id || person.userid));
  const roles = department.memberRoles || {};
  const manager = Object.keys(roles).find(id => roles[id] === 'Manager' && ids.has(id));
  const leader = Object.keys(roles).find(id => roles[id] === 'Team leader' && ids.has(id)) || (ids.has(department.head) ? department.head : null);
  if (!manager && !leader) return [];
  const links = [];
  const connect = (from, to) => { if (from && to && from !== to) links.push({ id: `team-role:${department.name}:${from}:${to}`, manager: from, employee: to, type: 'direct', roleHierarchy: true }); };
  if (manager && leader) connect(manager, leader);
  for (const id of ids) if (id !== manager && id !== leader) connect(leader || manager, id);
  return links;
}

/** Saving department leaders also publishes the same direct reporting used by reviews. */
export function applyDepartmentLeadership(configuration, department, people) {
  const members = people.filter(person => person.department === department.name);
  const ids = new Set(members.map(person => person.id || person.userid));
  const derived = departmentLeadershipLinks(department, members);
  const retained = configuration.links.filter(link => !(link.type === 'direct' && ids.has(link.manager) && ids.has(link.employee)) && !(link.roleHierarchy && link.id.startsWith(`team-role:${department.name}:`)));
  const links = derived.map(link => ({ ...configuration.links.find(previous => previous.manager === link.manager && previous.employee === link.employee && previous.type === 'direct'), ...link }));
  const nodes = [...configuration.nodes];
  if (links.length) for (const person of members) {
    const id = person.id || person.userid;
    if (!nodes.some(node => node.id === id)) nodes.push({ id, position: { x: (nodes.length % 3) * 300, y: Math.floor(nodes.length / 3) * 220 } });
  }
  return { ...configuration, nodes, links: [...retained, ...links], departments: [...(configuration.departments || []).filter(record => record.name !== department.name), department] };
}
