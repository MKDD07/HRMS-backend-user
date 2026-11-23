export const MAX_DEPTH = 6;
export const emptyMatrix = () => ({ nodes: [], links: [] });

/** Preserve department policy/roles while placing every current member on the chart. */
export function placeDepartment(matrix, record, position, expanded) {
  const groups = matrix.departmentChart || [];
  const existing = groups.find(group => group.name === record.name);
  const occupied = [...matrix.nodes.map(node => node.position?.x || 0), ...groups.map(group => group.position.x)];
  const point = position || existing?.position || { x: occupied.length ? Math.max(...occupied) + 660 : 0, y: 0 };
  const head = record.head || (record.members.length === 1 ? record.members[0].id : '');
  const ordered = [...record.members].sort((a, b) => Number(b.id === head) - Number(a.id === head));
  const positions = new Map(ordered.map((person, index) => [person.id, { x: point.x + (index === 0 ? 25 : ((index - 1) % 3) * 300 - 275), y: point.y + (index === 0 ? 310 : 520 + Math.floor((index - 1) / 3) * 210) }]));
  const nodes = matrix.nodes.map(node => expanded && positions.has(node.id) ? { ...node, position: positions.get(node.id) } : node);
  for (const person of ordered) if (!nodes.some(node => node.id === person.id)) nodes.push({ id: person.id, position: positions.get(person.id) });
  const { members, ...settings } = record;
  return { ...matrix, nodes, departments: [...(matrix.departments || []).filter(item => item.name !== record.name), { ...settings, head }], departmentChart: [...groups.filter(item => item.name !== record.name), { ...existing, name: record.name, position: point, expanded: expanded ?? existing?.expanded ?? false }] };
}
export function validateLink(links, link, excluding) {
  if (!link.manager || !link.employee) return 'Choose a manager and an employee.';
  if (link.manager === link.employee) return 'An employee cannot report to themselves.';
  if (!['direct', 'indirect'].includes(link.type)) return 'Choose direct or indirect reporting.';
  const rest = links.filter(item => item.id !== excluding);
  if (rest.some(item => item.manager === link.manager && item.employee === link.employee)) return 'This reporting relationship already exists.';
  if (link.type === 'indirect') return '';
  const visited = new Set();
  const pending = [link.employee];
  while (pending.length) {
    const id = pending.pop();
    if (id === link.manager) return 'This connection would create a reporting loop.';
    if (visited.has(id)) continue;
    visited.add(id);
    rest.filter(item => item.type === 'direct' && item.manager === id).forEach(item => pending.push(item.employee));
  }
  return '';
}
export function visiblePeople(nodes, links, focus, depth = MAX_DEPTH) {
  if (!focus) return new Set(nodes.map(node => node.id));
  const visible = new Set([focus]);
  for (const direction of ['manager', 'employee']) {
    let frontier = [focus];
    const seen = new Set(frontier);
    for (let level = 0; level < Math.min(MAX_DEPTH, depth); level++) {
      const next = [];
      for (const id of frontier) for (const link of links) {
        const candidate = direction === 'manager' ? (link.employee === id && link.manager) : (link.manager === id && link.employee);
        if (candidate && !seen.has(candidate)) { seen.add(candidate); visible.add(candidate); next.push(candidate); }
      }
      frontier = next;
    }
  }
  return visible;
}
export function reconcileMatrix(matrix, employees) {
  const ids = new Set(employees.map(item => item.id));
  const nodes = (Array.isArray(matrix?.nodes) ? matrix.nodes : []).filter(node => ids.has(node.id));
  const placed = new Set(nodes.map(node => node.id));
  const links = [];
  for (const link of Array.isArray(matrix?.links) ? matrix.links : []) {
    if (placed.has(link.manager) && placed.has(link.employee) && !validateLink(links, link)) links.push(link);
  }
  return { nodes, links };
}
