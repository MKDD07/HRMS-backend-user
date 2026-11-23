import { effectiveDepartmentLeadership } from '../shared/departmentCoverage.mjs';
import { assignDepartmentColors, departmentTheme } from '../src/lib/departmentTheme.js';
const hex = hsl => {
  const [h,s,l] = hsl.match(/[\d.]+/g).map(Number);
  const light=l/100, a=s/100*Math.min(light,1-light);
  return '#'+[0,8,4].map(n=>{ const k=(n+h/30)%12; return Math.round(255*(light-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0'); }).join('');
};
const parse = value => value ? JSON.parse(value) : {};

export async function teamHandle({ db, actor, now = new Date() }) {
  const people = (await db.prepare(`SELECT e.user_id AS id,e.first_name,e.last_name,e.department,e.designation,
    COALESCE(NULLIF(json_extract(e.profile,'$.work_email'),''),u.email,'') AS email,
    COALESCE(NULLIF(json_extract(e.profile,'$.work_phone'),''),NULLIF(json_extract(e.profile,'$.phone_number'),''),json_extract(e.profile,'$.phone'),'') AS phone,
    COALESCE(json_extract(e.profile,'$.profile_pic_url'),'') AS profile_pic_url,
    json_extract(e.profile,'$.reports_to_userid') AS reports_to
    FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id
    WHERE e.company_id=? AND u.status='active' AND LOWER(COALESCE(e.status,'')) NOT IN ('inactive','disabled','terminated')
    ORDER BY e.first_name,e.last_name,e.user_id`).bind(actor.company_id).all()).results;
  const row = await db.prepare('SELECT payload FROM workflow_configuration WHERE company_id=?').bind(actor.company_id).first();
  const configuration = parse(row?.payload);
  const themes = assignDepartmentColors([...new Set(['General',...people.map(p=>p.department),...(configuration.departments||[]).map(d=>d.name)].filter(Boolean))].sort().map(name=>({...((configuration.departments||[]).find(d=>d.name===name)||{}),name})));
  const colorsFor = name => { const theme=departmentTheme(name||'Unassigned',themes.find(d=>d.name===name)?.themeIndex); return Object.fromEntries(['accent','tint','glow'].map(key=>[key,hex(theme['--department-'+key])])); };
  const ids = new Set(people.map(p => p.id));
  const links = (configuration.links || []).filter(l => l.type === 'direct' && l.manager !== l.employee && ids.has(l.manager) && ids.has(l.employee));
  const day = new Date(now.getTime() + 330 * 60000).toISOString().slice(0,10);
  const named = new Map((configuration.departments || []).map(d => [d.name, d]));
  for (const person of people) if (person.department && !named.has(person.department)) named.set(person.department, { name: person.department });
  const badges = new Map(people.map(p => [p.id, new Set()]));
  const addBadge = (id, label) => { if (ids.has(id) && label) badges.get(id).add(label); };
  // Only finalized company portfolios are visible to employees.
  for (const [role, id] of Object.entries(configuration.companyLeadership?.finalized?.roles || {})) addBadge(id, role);
  const departments = [...named.values()].map(original => {
    const department = effectiveDepartmentLeadership(original, day);
    const memberIds = new Set(people.filter(p => p.department === department.name).map(p => p.id));
    for (const id of department.temporaryMembers || []) if (ids.has(id)) memberIds.add(id);
    const roles = { ...(department.memberRoles || {}) };
    if (department.head && !roles[department.head]) roles[department.head] = 'Team leader';
    const groupBadges = {};
    for (const [id, role] of Object.entries(roles)) {
      if (!ids.has(id)) continue;
      memberIds.add(id);
      const label = department.actingRoles?.[id] ? `Acting ${role.toLowerCase()}` : role;
      groupBadges[id] = [label];
      addBadge(id, label);
    }
    return { name: department.name, member_ids: [...memberIds], badges: groupBadges };
  }).sort((a,b) => a.name.localeCompare(b.name));
  const members = people.map(({ first_name, last_name, reports_to, ...person }) => {
    const assigned = links.filter(l => l.employee === person.id).map(l => l.manager);
    const managerIds = [...new Set(assigned.length ? assigned : ids.has(reports_to) && reports_to !== person.id ? [reports_to] : [])];
    return { ...person, colors: colorsFor(person.department), name: [first_name, last_name].filter(Boolean).join(' ') || 'Team member', manager_ids: managerIds, badges: [...badges.get(person.id)] };
  });
  const managers = new Set(members.flatMap(p => p.manager_ids));
  for (const member of members) if (managers.has(member.id) && !member.badges.length) member.badges.push('Manager');
  return { current_user_id: actor.user_id, members, departments };
}
