import { DepartmentResponsibilities } from './DepartmentResponsibilities';
import { DepartmentLeadershipCards } from './DepartmentLeadershipCards';
import { WorkflowInbox } from '../../components/hierarchy/WorkflowInbox';
import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import { DepartmentsSkeleton } from './DepartmentsSkeleton';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { DepartmentAiDraft } from '../../components/ui/DepartmentAiDraft';
import { OrganizationPersonNode } from '../../components/hierarchy/OrganizationPersonNode';
import { assignDepartmentRole, LEADERSHIP_ROLES } from '../../../shared/departmentRoles.mjs';
import { departmentMembers, availableTeamPeople } from '../../../shared/departmentMembership.mjs';
import { departmentLeadershipLinks, applyDepartmentLeadership } from '../../../shared/departmentHierarchy.mjs';
import { effectiveDepartmentLeadership, personOnLeave } from '../../../shared/departmentCoverage.mjs';
import { COMPANY_ROLES } from '../../../shared/companyLeadership.mjs';
import { CompanyLeadershipEditor } from './CompanyLeadershipEditor';
import { CompanyLeadershipLog } from './CompanyLeadershipLog';
import { departmentTheme, assignDepartmentColors, randomDepartmentColor } from '../../lib/departmentTheme';
import React, { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { Building2, Users, GitBranch, ArrowLeft, Save, Pencil, RefreshCw, ArrowUpRight, UserCheck, CalendarDays, Maximize2, Target, ClipboardList, Search, Plus, Mail, Phone, Trash2, X, Check } from 'lucide-react';
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, ConnectionMode, applyNodeChanges } from '@xyflow/react';
import dagre from 'dagre';
import { TenantHeader } from '../../components/ui/TenantHeader';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { WorkspaceFilters } from '../../components/ui/WorkspaceFilters';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { workflowApi } from '../../lib/workflowApi';
import { api } from '../../lib/api';
import { validateConfiguration, departmentTeam, removeTeamMemberLinks } from '../../../shared/workflowModel.mjs';
import { canUsePage } from '../../../shared/dashboardAccess.mjs';
import '@xyflow/react/dist/style.css';
import './DepartmentsPage.scss';

const nameOf = person => person.name || [person.first_name, person.last_name].filter(Boolean).join(' ') || person.userid;
const nodeTypes = { person: OrganizationPersonNode };
export function DepartmentsPage({ currentUser, onSelectEmployee, onShowToast }) {
  const [people, setPeople] = useState([]), [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [workflowDraft, setWorkflowDraft] = useState(null);
  const [departmentAction, setDepartmentAction] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState(''), [selected, setSelected] = useState(''), [tab, setTab] = useState('overview');
  const [draft, setDraft] = useState(null), [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false), [createError, setCreateError] = useState('');
  const [newDepartment, setNewDepartment] = useState({ name: '', targets: '', responsibilities: '' });
  const [removingPerson, setRemovingPerson] = useState(null);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [companyDraft, setCompanyDraft] = useState({});
  const [leadershipLog, setLeadershipLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState('');
  useEffect(() => { setCompanyDraft(saved?.configuration?.companyLeadership?.draft || saved?.configuration?.companyLeadership?.finalized?.roles || {}); }, [saved]);
  const [hierarchyDay, setHierarchyDay] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [hierarchyDateOpen, setHierarchyDateOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [coverageDraft, setCoverageDraft] = useState({ role: 'Manager', cover: '', from: '', until: '' });

  const flow = useRef(null);
  const [nodePositions, setNodePositions] = useState({});
  const [placedIds, setPlacedIds] = useState([]);
  const [flowNodes, setFlowNodes] = useState([]);
  const onNodesChange = useCallback(changes => setFlowNodes(nodes => applyNodeChanges(changes, nodes)), []);
  const canEdit = canUsePage(currentUser, 'departments');
  async function load() {
    setLoading(true); setError('');
    try {
      const [directory, configuration] = await Promise.all([workflowApi.directory(), workflowApi.configuration()]);
      setPeople(directory.map(person => ({ ...person, userid: person.userid || person.id, id: person.id || person.userid })));
      setSaved(configuration);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [currentUser?.company_id]);
  const departments = useMemo(() => assignDepartmentColors([...new Set(['General', ...people.map(person => person.department), ...(saved?.configuration?.departments || []).map(record => record.name)].filter(Boolean))].sort().map(name => { const record = (saved?.configuration?.departments || []).find(record => record.name === name) || {}; return { ...record, name, members: departmentMembers(name, people, record.temporaryMembers) }; })), [people, saved]);
  const filteredDepartments = departments.filter(record => Boolean(record.archived) === showArchived && record.name.toLowerCase().includes(search.trim().toLowerCase()));
  const unassignedCount = people.filter(person => !person.department).length;
  const department = departments.find(record => record.name === selected);
  const onLeave = person => personOnLeave(person, saved?.configuration?.departments || [], hierarchyDay);
  const companyRolesFor = person => COMPANY_ROLES.filter(role => saved?.configuration?.companyLeadership?.finalized?.roles?.[role] === person.id);
  const personTeamRole = person => {
    const team = (saved?.configuration?.departments || []).find(record => record.name === person.department);
    return team?.memberRoles?.[person.id] || (team?.head === person.id ? 'Team leader' : '');
  };
  function teamCardProps(person) {
    const roles = companyRolesFor(person);
    return { style: { ...departmentTheme(person.department || 'Unassigned', departments.find(record => record.name === person.department)?.themeIndex), ...(roles.length ? { '--company-role-accent': departmentTheme(roles[0])['--department-accent'], '--company-role-tint': departmentTheme(roles[0])['--department-tint'] } : {}) },
      'data-on-leave': onLeave(person) ? 'true' : undefined, 'data-department': person.department || 'Unassigned',
      'data-temporary-member': department.name !== 'General' && person.department !== department.name ? 'true' : undefined,
      'data-company-role': roles.length ? roles[0] : undefined, 'data-team-role': personTeamRole(person) };
  }
  function renderPersonBadges(person) {
    const roles = companyRolesFor(person);
    const teamRole = personTeamRole(person);
    const temporary = department.name !== 'General' && person.department !== department.name;
    return <span className="department-person-badges">{onLeave(person) && <span className="department-leave-badge">On leave</span>}{roles.map(role => <span className="department-company-role-badge" key={role} style={{ '--company-role-accent': departmentTheme(role)['--department-accent'], '--company-role-tint': departmentTheme(role)['--department-tint'] }}>{role}</span>)}{teamRole && !roles.includes(teamRole) && <span className="department-member-badge">{teamRole}</span>}{temporary && <span className="department-member-badge">Temporary member</span>}</span>;
  }
  const teamDirectoryPeople = useMemo(() => {
    if (!department) return [];
    return department.members;
  }, [department, people]);

  const hierarchyDepartment = useMemo(() => {
    if (!department || department.name === 'General') return department;
    return effectiveDepartmentLeadership(Object.entries(roleDrafts).reduce((record, [id, role]) => assignDepartmentRole(record, id, role), department), hierarchyDay);
  }, [department, roleDrafts, hierarchyDay]);
  const chart = useMemo(() => {
    if (!department) return { nodes: [], edges: [], members: [] };
    const depMemberIds = new Set(department.members.map(person => person.id));
    // Team hierarchy is scoped strictly to current department membership.
    const reportingLinks = (saved?.configuration?.links || []).filter(link =>
      depMemberIds.has(link.manager) && depMemberIds.has(link.employee)
    );
    const leadershipLinks = departmentLeadershipLinks(hierarchyDepartment, department.members);
    const links = leadershipLinks.length ? [...leadershipLinks, ...reportingLinks.filter(link => link.type === 'indirect' || !depMemberIds.has(link.manager) || !depMemberIds.has(link.employee))] : reportingLinks;
    const members = department.members;
    const memberIds = new Set(members.map(person => person.id));
    const graph = new dagre.graphlib.Graph().setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 90, marginx: 20, marginy: 20 }).setDefaultEdgeLabel(() => ({}));
    members.forEach(person => graph.setNode(person.id, { width: 280, height: 220 }));
    links.filter(link => link.type !== 'indirect').forEach(link => { if(memberIds.has(link.manager) && memberIds.has(link.employee)) graph.setEdge(link.manager, link.employee); });
    dagre.layout(graph);
    return {
      members,
      nodes: members.map(person => {
        const isIndirect = Boolean(person.department && person.department.trim() && person.department !== department.name);
        return {
          id: person.id,
          type: 'person',
          data: {
            person,
            departmentStyle: departmentTheme(person.department || 'Unassigned', departments.find(record => record.name === person.department)?.themeIndex),
            onLeave: onLeave(person),
            teamRole: hierarchyDepartment.unavailableRoles?.[person.id] ? hierarchyDepartment.unavailableRoles[person.id] + ' · On leave' : hierarchyDepartment.actingRoles?.[person.id] ? 'Acting ' + hierarchyDepartment.actingRoles[person.id] : hierarchyDepartment.memberRoles?.[person.id] || (hierarchyDepartment.head === person.id ? 'Team leader' : ''),
            temporary: isIndirect,
            sideConnections: true,
            remove: canEdit ? promptRemovePerson : undefined,
            removeLabel: 'Remove ' + nameOf(person) + ' from team'
          },
          position: { x: graph.node(person.id).x - 140, y: graph.node(person.id).y - 110 }
        };
      }),
      edges: links.filter(link => memberIds.has(link.manager) && memberIds.has(link.employee)).map(link => ({
        id: link.id,
        source: link.manager,
        target: link.employee,
        type: 'default',
        pathOptions: { curvature: 0.3 },
        sourceHandle: link.type === 'indirect' ? (link.sourceHandle === 'left' ? 'left' : 'right') : 'bottom',
        targetHandle: members.find(person => person.id === link.employee)?.department !== department.name ? 'left' : link.type === 'indirect' ? (link.targetHandle === 'right' ? 'right' : 'left') : 'top',
        markerEnd: { type: MarkerType.ArrowClosed },
        label: link.type === 'indirect' ? 'Indirect' : undefined,
        animated: link.type === 'indirect',
        className: link.type === 'indirect' ? 'department-indirect-edge' : undefined,
        style: {
          stroke: 'var(--color-text-muted)',
          strokeWidth: 1.7,
          strokeDasharray: link.type === 'indirect' ? '6 5' : undefined
        }
      }))
    };
  }, [department, hierarchyDepartment, saved, people, placedIds, canEdit, teamDirectoryPeople]);
  const leadershipLayoutKey = JSON.stringify([hierarchyDepartment?.name, hierarchyDepartment?.head, hierarchyDepartment?.memberRoles]);
  const previousLeadershipLayout = useRef(null);
  useEffect(() => {
    const leadershipChanged = previousLeadershipLayout.current !== leadershipLayoutKey;
    previousLeadershipLayout.current = leadershipLayoutKey;
    if (leadershipChanged) setNodePositions({});
    setFlowNodes(current => {
      const positions = new Map(current.map(node => [node.id, node.position]));
      return chart.nodes.map(node => ({ ...node, position: leadershipChanged ? node.position : positions.get(node.id) || nodePositions[node.id] || node.position }));
    });
  }, [chart, leadershipLayoutKey]);
  const teamPeople = useMemo(() => department ? department.members : [], [department]);
  const availablePeople = useMemo(() => availableTeamPeople(people, teamPeople), [people, teamPeople]);
  function open(name) { setWorkflowDraft(null); setFlowNodes([]); setPlacedIds([]); setNodePositions({}); setSelected(name); setTab(name === 'General' ? 'leadership' : 'overview'); setRoleDrafts({}); setEditing(false); setDraft(null); setError(''); setRemovingPerson(null); }
  function placePerson(id, position) {
    if (!department?.members.some(person => person.id === id)) return;
    setNodePositions(current => ({ ...current, [id]: position }));
    setFlowNodes(current => current.map(node => node.id === id ? { ...node, position } : node));
    if (!chart.members.some(person => person.id === id)) setPlacedIds(current => current.includes(id) ? current : [...current, id]);
  }
  function placeFromDirectory(person) {
    const canvas = document.querySelector('.department-chart');
    if (!flow.current || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const point = flow.current.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
    placePerson(person.id, { x: point.x - 125, y: point.y - 45 });
  }
  function promptRemovePerson(personOrId) {
    if (!canEdit || saving) return;
    const person = typeof personOrId === 'object' && personOrId !== null
      ? personOrId
      : people.find(p => p.id === personOrId);
    if (!person) return;
    setRemovingPerson(person);
  }
  async function confirmRemovePerson() {
    if (!removingPerson || !department || !saved || !canEdit || saving) return;
    const id = removingPerson.id;
    const isDirectMember = department.name === 'General' || removingPerson.department === department.name;
    const depMemberIds = new Set(department.members.map(p => p.id));
    setSaving(true); setError('');
    try {
      if (isDirectMember) {
        const result = await workflowApi.transferDepartment(id, '', saved.revision);
        setSaved(result);
        setPeople(prev => prev.map(p => p.id === id ? { ...p, department: '' } : p));
      } else {
        const configuration = { ...saved.configuration, departments: saved.configuration.departments.map(record => record.name === department.name ? { ...record, temporaryMembers: (record.temporaryMembers || []).filter(member => member !== id) } : record), links: removeTeamMemberLinks(saved.configuration.links || [], id, depMemberIds, false) };
        const problem = validateConfiguration(configuration, people);
        if (problem) throw new Error(problem);
        const result = await workflowApi.publish(configuration, saved.revision);
        setSaved({ ...result, configuration });
      }
      setPlacedIds(prev => prev.filter(item => item !== id));
      setNodePositions(prev => { const next = { ...prev }; delete next[id]; return next; });
      setFlowNodes(prev => prev.filter(node => node.id !== id));
      setRemovingPerson(null);
      onShowToast?.({ type: 'success', title: 'Person removed from team', message: `${nameOf(removingPerson)} has been removed from ${isDirectMember ? department.name : 'the team'}.` });
    } catch (err) {
      setError(err.message || 'Unable to remove person from team.');
    } finally {
      setSaving(false);
    }
  }
  async function transferPerson(person, target) {
    if (!target || target === person.department || saving || currentUser?.role !== 'company_admin') return;
    setSaving(true); setError('');
    try {
      const result = await workflowApi.transferDepartment(person.id || person.userid, target, saved.revision);
      setSaved(result);
      setPeople(rows => rows.map(row => row.id === person.id ? { ...row, department: target } : row));
      setPlacedIds(rows => rows.filter(id => id !== person.id));
      setFlowNodes(rows => rows.filter(node => node.id !== person.id));
      onShowToast?.({ type: 'success', title: 'Department updated', message: nameOf(person) + ' moved to ' + target + '.' });
    } catch (err) { setError(err.message || 'Department change could not be saved.'); }
    finally { setSaving(false); }
  }
  async function saveTeamRole(person, role) {
    if (!canEdit || saving || !department || department.name === 'General') return;
    const base = { name: department.name, head: '', targets: '', responsibilities: '', ...(saved.configuration.departments || []).find(row => row.name === department.name) };
    const updated = assignDepartmentRole(base, person.id, role);
    if (await saveRoleDepartment(updated)) setRoleDrafts(previous => { const next = { ...previous }; delete next[person.id]; return next; });
  }
  async function saveRoleDepartment(updated, membershipChange = false) {
    const records = saved.configuration.departments || [];
    const configuration = { ...saved.configuration, departments: records.some(row => row.name === updated.name) ? records.map(row => row.name === updated.name ? updated : row) : [...records, updated] };
    const problem = validateConfiguration(configuration, people);
    if (problem) { setError(problem); return false; }
    setSaving(true); setError('');
    try {
      const result = await workflowApi.publish(configuration, saved.revision);
      setSaved({ ...result, configuration });
      onShowToast?.({ type: 'success', title: membershipChange ? 'Team membership updated' : 'Team role saved', message: membershipChange ? 'Temporary membership saved. Permanent department unchanged.' : 'Department role assignments updated.' });
      return true;
    } catch (err) { setError(err.message || 'Role could not be saved.'); return false; }
    finally { setSaving(false); }
  }
  async function changeTemporaryMembership(person, add) {
    if (!canEdit || saving || !department || department.name === 'General') return;
    const base = { name: department.name, head: '', targets: '', responsibilities: '', ...(saved.configuration.departments || []).find(row => row.name === department.name) };
    const ids = new Set(base.temporaryMembers || []);
    if (add) ids.add(person.id); else ids.delete(person.id);
    await saveRoleDepartment({ ...base, temporaryMembers: [...ids] }, true);
  }
  async function saveCoverage(event) {
    event.preventDefault();
    const person = Object.keys(department.memberRoles || {}).find(id => department.memberRoles[id] === coverageDraft.role) || (coverageDraft.role === 'Team leader' ? department.head : '');
    const base = { head: '', targets: '', responsibilities: '', ...department };
    delete base.members;
    if (await saveRoleDepartment({ ...base, leadershipCoverage: [...(base.leadershipCoverage || []), { ...coverageDraft, person }] })) setCoverageOpen(false);
  }
  async function saveCompanyLeadership(finalize) {
    if (saving || currentUser?.role !== 'company_admin') return;
    setSaving(true); setError('');
    try {
      const result = await workflowApi.saveCompanyLeadership(companyDraft, finalize, saved.revision);
      setSaved(result);
      onShowToast?.({ type: 'success', title: finalize ? 'Company leadership finalized' : 'Leadership draft saved', message: finalize ? 'Company leadership assignments are now active.' : 'Finalized assignments remain active until you finalize this draft.' });
    } catch (err) { setError(err.message || 'Could not save leadership.'); }
    finally { setSaving(false); }
  }
  async function showLeadershipLog() {
    setLogLoading(true); setLogError('');
    try {
      const rows = await workflowApi.leadershipLog();
      setLeadershipLog(rows.filter(row => row.action.startsWith('company-leadership-')).map(row => ({ ...row, details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details })));
    } catch (err) { setLogError(err.message || 'Could not load change log.'); } finally { setLogLoading(false); }
  }
  async function removeCoverage(index) {
    const base = { head: '', targets: '', responsibilities: '', ...department };
    delete base.members;
    await saveRoleDepartment({ ...base, leadershipCoverage: (base.leadershipCoverage || []).filter((_, i) => i !== index) });
  }
  function renderTeamContacts(person) {
    const phone = person.phone_number || person.phone;
    return <div className="department-person-contact-actions">
      {person.email && <a className="btn btn--outline btn--icon-sm" href={'mailto:' + person.email} aria-label={'Email ' + nameOf(person)} title={person.email}><Mail size={14} aria-hidden="true" /></a>}
      {phone && <a className="btn btn--outline btn--icon-sm" href={'tel:' + phone.replace(/[^+\d]/g, '')} aria-label={'Call ' + nameOf(person)} title={phone}><Phone size={14} aria-hidden="true" /></a>}
    </div>;
  }
  function renderTeamActions(person) {
    if (department.name === 'General') return <><label className="department-person-transfer"><span className="sr-only">Department for {nameOf(person)}</span><select aria-label={'Department for ' + nameOf(person)} value={person.department || ''} disabled={saving || currentUser?.role !== 'company_admin'} onChange={event => transferPerson(person, event.target.value)}><option value="" disabled>Select department</option>{departments.map(record => <option key={record.name} value={record.name}>{record.name}</option>)}</select></label><Button size="sm" variant="outline" iconOnly icon={Trash2} disabled={saving || !person.department} aria-label={'Remove ' + nameOf(person) + ' from department'} title="Remove department assignment" onClick={() => promptRemovePerson(person)} /></>;
    if (person.department !== department.name) return <><span className="department-temporary-badge">Temporary member</span><Button size="sm" variant="outline" iconOnly icon={Trash2} disabled={saving} aria-label={'Remove temporary member ' + nameOf(person)} title="Remove temporary membership" onClick={() => changeTemporaryMembership(person, false)} /></>;
    const active = department.memberRoles?.[person.id] || (department.head === person.id ? 'Team leader' : '');
    const draftRole = roleDrafts[person.id] ?? active;
    const changed = draftRole !== active;
    return <><label className="department-person-transfer"><span className="sr-only">Team role for {nameOf(person)}</span><select aria-label={'Team role for ' + nameOf(person)} value={draftRole} disabled={saving} onChange={event => setRoleDrafts(previous => ({ ...previous, [person.id]: event.target.value }))}><option value="">Team member</option>{[...LEADERSHIP_ROLES, ...(department.customRoles || [])].map(role => <option key={role}>{role}</option>)}</select></label><Button size="sm" variant={active && !changed ? 'fadeout' : 'outline'} iconOnly icon={active && !changed ? X : Check} disabled={saving || (!active && !draftRole)} aria-label={active && !changed ? 'Disable role for ' + nameOf(person) : 'Finalize role for ' + nameOf(person)} title={active && !changed ? 'Disable role' : 'Finalize role'} onClick={() => saveTeamRole(person, active && !changed ? '' : draftRole)} /></>;
  }
  function directoryDragProps(person) {
    return { draggable: true, title: 'Drag onto the hierarchy to position this person', onDragStart: event => {
      event.dataTransfer.setData('application/hrms-employee', person.id);
      event.dataTransfer.effectAllowed = 'move';
    } };
  }
  async function connectPeople(connection) {
    if (!canEdit || saving || !saved || !department) return;
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || source === target) return;
    const teamMemberIds = new Set(teamDirectoryPeople.map(person => person.id));
    if (!teamMemberIds.has(source) && !teamMemberIds.has(target)) { setError('Connect someone to this department.'); return; }
    const existing = saved.configuration.links || [];
    if (existing.some(link => link.manager === source && link.employee === target)) { setError('These people are already connected.'); return; }
    const sourcePerson = people.find(p => p.id === source);
    const targetPerson = people.find(p => p.id === target);
    const isExternal =
      (sourcePerson?.department && sourcePerson.department.trim() && sourcePerson.department !== department.name) ||
      (targetPerson?.department && targetPerson.department.trim() && targetPerson.department !== department.name);
    const type = isExternal || ['left', 'right'].includes(sourceHandle) || ['left', 'right'].includes(targetHandle) ? 'indirect' : 'direct';
    const nodes = [...(saved.configuration.nodes || [])];
    for (const id of [source, target]) {
      if (!nodes.some(node => node.id === id)) {
        const node = chart.nodes.find(record => record.id === id);
        nodes.push({ id, position: nodePositions[id] || node?.position || { x: 0, y: 0 } });
      }
    }
    const configuration = { ...saved.configuration, nodes, links: [...existing, { id: crypto.randomUUID(), manager: source, employee: target, type, sourceHandle: type === 'indirect' ? (sourceHandle === 'left' ? 'left' : 'right') : 'bottom', targetHandle: type === 'indirect' ? (targetHandle === 'right' ? 'right' : 'left') : 'top' }] };
    const problem = validateConfiguration(configuration, people);
    if (problem) { setError(problem); return; }
    setSaving(true); setError('');
    try {
      const result = await workflowApi.publish(configuration, saved.revision);
      setSaved({ ...result, configuration });
      if (type === 'direct') {
        for (const id of [source, target]) {
          const person = people.find(p => p.id === id);
          if (person && (!person.department || !person.department.trim())) {
            try {
              await api.updateUser(id, { department: department.name });
              setPeople(prev => prev.map(p => p.id === id ? { ...p, department: department.name } : p));
            } catch (err) {
              console.warn('api.updateUser department assign notice:', err);
            }
          }
        }
      }
      onShowToast?.({ type: 'success', title: 'Reporting connection saved', message: type === 'indirect' ? 'Indirect connection added using side attachment points.' : 'Direct reporting connection added.' });
    } catch (failure) { setError(failure.message || 'Unable to save the connection.'); } finally { setSaving(false); }
  }
  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const base = { ...(saved.configuration.departments || []).find(record => record.name === selected), ...draft, name: selected };
      const memberRoles = Object.fromEntries(Object.entries(base.memberRoles || {}).filter(([, role]) => role !== 'Team leader'));
      if (draft.head) memberRoles[draft.head] = 'Team leader';
      const updated = { ...base, memberRoles };
      const configuration = { ...saved.configuration, departments: [...(saved.configuration.departments || []).filter(record => record.name !== selected), updated] };
      const result = await workflowApi.publish(configuration, saved.revision);
      setSaved({ ...result, configuration }); setEditing(false);
      onShowToast?.({ type: 'success', title: 'Department updated', message: 'Department head, targets and responsibilities saved.' });
    } catch(e) { setError(e.message); } finally { setSaving(false); }
  }
  async function createDepartment(event) {
    event.preventDefault();
    if (saving || !canEdit || !saved) return;
    const name = newDepartment.name.trim();
    if (!name) { setCreateError('Enter a department name.'); return; }
    if (departments.some(record => record.name.toLowerCase() === name.toLowerCase())) { setCreateError('A department with this name already exists.'); return; }
    setSaving(true); setCreateError('');
    try {
      const configuration = { ...saved.configuration, departments: [...departments.map(({ members, ...record }) => ({ head: '', targets: '', responsibilities: '', ...record })), { ...newDepartment, name, head: '', themeIndex: randomDepartmentColor(departments) }] };
      const result = await workflowApi.publish(configuration, saved.revision);
      setSaved({ ...result, configuration }); setCreating(false); setSearch(''); open(name);
      onShowToast?.({ type: 'success', title: 'Department created', message: name + ' is ready. Assign employees through Employee Directory.' });
    } catch (e) { setCreateError(e.message || 'Unable to create department. Please try again.'); } finally { setSaving(false); }
  }
  async function publishDepartmentConfiguration(configuration) {
    if (!canEdit || saving || !saved) return false;
    const issue = validateConfiguration(configuration,people);
    if (issue) { setError(issue); return false; }
    setSaving(true);setError('');
    try {
      const result=await workflowApi.publish(configuration,saved.revision);
      setSaved({...result,configuration});setWorkflowDraft(null);
      onShowToast?.({type:'success',title:'Department settings saved',message:'Responsibilities, policies and leadership are up to date.'});
      return true;
    } catch(error) {setError(error.message);return false;} finally {setSaving(false);}
  }
  const saveLeaders = record => publishDepartmentConfiguration(applyDepartmentLeadership(saved.configuration,record,people));
  async function confirmDepartmentAction() {
    if (!departmentAction || saving) return;
    setSaving(true);setError('');
    try {
      const result=await workflowApi.departmentLifecycle(departmentAction.name,departmentAction.action,saved.revision);
      setSaved(result);setSelected('');setWorkflowDraft(null);setDepartmentAction(null);
      onShowToast?.({type:'success',title:'Department updated',message:'Department '+departmentAction.action+' completed.'});
    } catch(error) {setError(error.message);} finally {setSaving(false);}
  }
  return <div className="departments-page">
    <TenantHeader refreshAccessory={!department && <><WorkspaceFilters search={search} onSearch={setSearch} searchLabel="Search departments" disabled={loading} /><ViewTabs value={showArchived?'archived':'active'} onChange={id=>setShowArchived(id==='archived')} label="Department archive filter" tabs={[{id:'active',label:'Active'},{id:'archived',label:'Archived'}]}/></>} settings={{ heading: 'Departments', paragraph: 'Explore department teams, targets, responsibilities and reporting relationships.', subheading: 'HRMS / Workforce & Org / Departments', buttons: [{ id: 'create', label: 'Create department', visible: canEdit && !department }] }} actions={{ create: { icon: Plus, disabled: loading || !saved || saving, onClick: () => { setNewDepartment({ name: '', targets: '', responsibilities: '' }); setCreateError(''); setCreating(true); } } }}/>
    {error && <p className="departments-error" role="alert">{error}</p>}
    <SectionSkeleton loading={loading}>{loading ? <DepartmentsSkeleton /> : !saved ? <Button icon={RefreshCw} onClick={load}>Retry</Button> : department ? <>
      <div className="department-workspace" style={departmentTheme(department.name, department.themeIndex)}>
      <section className="card overview-card department-hero" aria-label={department.name + ' department'}>
        <div className="department-hero__toolbar"><Button variant="outline" size="sm" iconOnly icon={ArrowLeft} aria-label="Back to all departments" title="All departments" disabled={saving || !!workflowDraft} onClick={() => { setSelected(''); setEditing(false); }} /><ViewTabs variant="slider" value={tab} onChange={value => { setTab(value); if (value === 'log') showLeadershipLog(); }} disabled={editing || saving || !!workflowDraft} label="Department views" tabs={[{ id: department.name === 'General' ? 'leadership' : 'overview', label: department.name === 'General' ? 'Leadership' : 'Overview', icon: Building2 }, { id: 'team', label: 'Team', icon: Users, count: teamPeople.length }, { id: 'hierarchy', label: 'Hierarchy', icon: GitBranch }, {id:'responsibilities',label:'Responsibilities & policies',icon:ClipboardList}, {id:'requests',label:'Requests & approvals',icon:ClipboardList}, ...(department.name === 'General' && currentUser?.role === 'company_admin' ? [{ id: 'log', label: 'Change log', icon: ClipboardList }] : [])]}/>{canEdit && department.name !== 'General' && !editing && <Button className="department-hero__edit" size="sm" variant="outline" iconOnly icon={Pencil} aria-label="Edit department" title="Edit department" disabled={saving || !!workflowDraft} onClick={() => { setTab('overview'); setDraft({ head: department.head || '', targets: department.targets || '', responsibilities: department.responsibilities || '' }); setEditing(true); }} />}</div>
        <div className="department-hero__main"><span className="department-hero__icon"><Building2 size={30} aria-hidden="true"/></span><div className="department-hero__copy"><span>DEPARTMENT WORKSPACE</span><h2>{department.name}</h2><p>Your people, priorities and reporting relationships in one place.</p></div><div className="department-hero__metrics"><div><strong>{teamPeople.length}</strong><span>Team members</span></div><div><strong>{chart.edges.length}</strong><span>Reporting links</span></div></div></div>
        <div className="department-hero__lead"><div className="department-hero__head"><UserCheck size={15} aria-hidden="true"/><span>Department head</span><strong>{nameOf(department.members.find(person => person.id === department.head) || {}) || 'Not assigned'}</strong></div><div className="department-hero__team" aria-label={teamPeople.length + ' total team members'}><div className="department-hero__photos">{teamPeople.slice(0, 5).map(person => <span key={person.id} title={nameOf(person)}><Avatar size="sm" name={nameOf(person)} src={person.profile_pic_url}/></span>)}</div><span className="department-hero__team-count"><strong>{teamPeople.length}</strong> total {teamPeople.length === 1 ? 'member' : 'members'}</span></div></div>
      </section>
      {tab === 'log' && department.name === 'General' && currentUser?.role === 'company_admin' && <CompanyLeadershipLog rows={leadershipLog} people={people} loading={logLoading} error={logError} onRefresh={showLeadershipLog}/>} 
      {tab === 'leadership' && department.name === 'General' && <><CompanyLeadershipEditor people={people} draft={companyDraft} finalized={saved.configuration.companyLeadership?.finalized} onChange={setCompanyDraft} onSave={saveCompanyLeadership} saving={saving} canEdit={currentUser?.role === 'company_admin'} /><DepartmentLeadershipCards departments={departments} onSave={saveLeaders} disabled={!canEdit || saving}/></>} 
      {tab === 'responsibilities' && <>
        <DepartmentResponsibilities key={department.name} configuration={workflowDraft || saved.configuration} department={department.name} people={people} onChange={setWorkflowDraft} disabled={!canEdit || saving}/>
        {workflowDraft && <div className="departments-actions"><Button variant="outline" disabled={saving} onClick={()=>setWorkflowDraft(null)}>Cancel changes</Button><Button icon={Save} loading={saving} onClick={()=>publishDepartmentConfiguration(workflowDraft)}>Save responsibilities & policies</Button></div>}
      </>}
      {tab === 'requests' && <TenantPanel title="Company requests & approvals" subtitle="Your requests, assigned approvals and company audit history."><WorkflowInbox currentUser={currentUser} people={people}/></TenantPanel>}
      {canEdit && tab === 'overview' && department.name !== 'General' && <div className="departments-actions"><Button variant="outline" disabled={saving || !!workflowDraft} onClick={()=>setDepartmentAction({name:department.name,action:department.archived?'restore':'archive'})}>{department.archived?'Restore department':'Archive department'}</Button><Button variant="outline" icon={Trash2} disabled={saving || !!workflowDraft} onClick={()=>setDepartmentAction({name:department.name,action:'delete'})}>Delete department</Button></div>}
      {tab === 'overview' && <TenantPanel title="Department overview" subtitle={`${teamPeople.length} team members`} >
        {editing ? <form className="department-form" onSubmit={save}><fieldset disabled={saving}><DepartmentAiDraft name={selected} targets={draft.targets} responsibilities={draft.responsibilities} disabled={saving} onApply={result => setDraft(current => ({ ...current, ...result }))}/><label>Department head<select value={draft.head} onChange={e => setDraft({ ...draft, head: e.target.value })}><option value="">Not assigned</option>{department.members.filter(person => person.department === department.name).map(person => <option key={person.id} value={person.id}>{nameOf(person)}</option>)}</select></label><label>Targets<textarea maxLength={10000} rows={6} placeholder="Describe measurable goals, owners and due dates." value={draft.targets} onChange={e => setDraft({ ...draft, targets: e.target.value })}/></label><label>Responsibilities<textarea maxLength={10000} rows={6} placeholder="Describe what this department owns and delivers." value={draft.responsibilities} onChange={e => setDraft({ ...draft, responsibilities: e.target.value })}/></label><div className="departments-actions"><Button variant="outline" type="button" onClick={() => setEditing(false)}>Cancel</Button><Button variant="colored" type="submit" icon={Save} loading={saving}>Save department</Button></div></fieldset></form> : <div className="department-overview"><section><UserCheck size={20} aria-hidden="true"/><h3>Department head</h3><p>{nameOf(department.members.find(person => person.id === department.head) || {}) || 'Not assigned'}</p></section><section><Target size={20} aria-hidden="true"/><h3>Targets</h3><p>{department.targets || 'No targets set yet.'}</p></section><section><ClipboardList size={20} aria-hidden="true"/><h3>Responsibilities</h3><p>{department.responsibilities || 'No responsibilities set yet.'}</p></section></div>}
      </TenantPanel>}
      {tab === 'team' && <div className={"workspace-grid department-team-layout" + (department.name === "General" ? " department-team-layout--general" : "")}><div className="department-team-main"><EmployeeDirectory controlsInHeader searchOnly headerTitle="Team directory" headerSubtitle="Meet the people behind this department." employees={teamPeople} variant="grid" className="department-team-directory department-team-panel" getCardProps={teamCardProps} renderMeta={person => <span className="department-person-details">{renderPersonBadges(person)}{person.employee_code && <span className="department-person-id">ID: {person.employee_code}</span>}</span>} renderActions={person => <>{renderTeamContacts(person)}{canEdit && renderTeamActions(person)}</>} onSelect={onSelectEmployee && canUsePage(currentUser, 'employees') ? person => onSelectEmployee(person.userid) : undefined}/></div>{department.name !== "General" && <aside className="department-team-available" aria-label="Available people"><EmployeeDirectory employees={availablePeople} variant="list" getCardProps={person => ({ 'data-on-leave': onLeave(person) ? 'true' : undefined })} renderMeta={person => onLeave(person) ? <span className="department-leave-badge">On leave</span> : null} pageSize={6} onSelect={onSelectEmployee && canUsePage(currentUser, 'employees') ? person => onSelectEmployee(person.userid) : undefined} renderActions={canEdit ? person => <Button size="sm" variant="outline" iconOnly icon={Plus} disabled={saving} aria-label={'Add ' + nameOf(person) + ' temporarily to team'} title="Add temporarily to team" onClick={() => changeTemporaryMembership(person, true)} /> : undefined} /></aside>}</div>}
      {tab === 'hierarchy' && <div className="department-hierarchy-layout">
        <TenantPanel className="overview-card department-hierarchy-panel" icon={GitBranch} controls={<div className="department-coverage-controls"><Button size="sm" variant="outline" iconOnly icon={CalendarDays} active={hierarchyDateOpen} aria-label="View hierarchy by date" title="View past or scheduled cover" aria-expanded={hierarchyDateOpen} aria-controls="department-hierarchy-date" onClick={() => { setHierarchyDateOpen(open => !open); if (hierarchyDateOpen) setHierarchyDay(new Date().toLocaleDateString("en-CA")); }}/>{hierarchyDateOpen && <label className="sr-only" htmlFor="department-hierarchy-date">Hierarchy date</label>}{hierarchyDateOpen && <input id="department-hierarchy-date" type="date" required value={hierarchyDay} onChange={event => { if (event.target.value) setHierarchyDay(event.target.value); }} />}{canEdit && department.name !== 'General' && <Button size="sm" variant="outline" icon={Plus} onClick={() => { setCoverageDraft({ role: 'Manager', cover: '', from: hierarchyDay, until: hierarchyDay }); setCoverageOpen(true); }}>Schedule leave cover</Button>}</div>} title="Team hierarchy" subtitle={`${department.members.length} department members · Manager, team leader and team`}>

          <div className="department-coverage-list">{(department.leadershipCoverage || []).map((row, index) => <div key={index}><span>{row.role}: {nameOf(people.find(person => person.id === row.person) || {})} → {nameOf(people.find(person => person.id === row.cover) || {})}<small>{row.from} – {row.until}</small></span>{canEdit && <Button size="sm" variant="outline" iconOnly icon={Trash2} disabled={saving} aria-label={'Remove coverage for ' + row.role} onClick={() => removeCoverage(index)} />}</div>)}</div>
          {!chart.edges.length && <p className="departments-message">No reporting links yet. Connect members to define their reporting structure.</p>}
          <div className="department-chart organization-flow-chart" onDragOver={event => { if (event.dataTransfer.types.includes('application/hrms-employee')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('application/hrms-employee'); if (flow.current && id) { const point = flow.current.screenToFlowPosition({ x: event.clientX, y: event.clientY }); placePerson(id, { x: point.x - 125, y: point.y - 45 }); } }}><ReactFlow proOptions={{ hideAttribution: true }} key={leadershipLayoutKey} onInit={instance => { flow.current = instance; }} nodes={flowNodes} onNodesChange={onNodesChange} onNodeDragStop={(_, node) => placePerson(node.id, node.position)} edges={chart.edges} nodeTypes={nodeTypes} nodesDraggable={true} connectionMode={ConnectionMode.Loose} connectOnClick={true} connectionRadius={28} nodesConnectable={canEdit && !saving} onConnect={connectPeople} fitView fitViewOptions={{ padding: 0.15, minZoom: 0.65, maxZoom: 1 }} minZoom={0.25} maxZoom={1.5}><Background color="var(--color-border)" gap={22}/><Controls showInteractive={false}/></ReactFlow></div><div className="department-hierarchy-caption"><span><i/>Direct reporting</span><span><i className="is-indirect"/>Indirect reporting</span><small>Drag to pan ? Scroll to zoom</small></div>
        </TenantPanel>
        <aside className="department-hierarchy-directory" aria-label="Hierarchy employee directory">

            <EmployeeDirectory employees={teamDirectoryPeople} searchOnly headerTitle="Department members" headerSubtitle="Drag a member onto the canvas, or select one to place them." variant="list" pageSize={5} getCardProps={directoryDragProps} renderMeta={person => <span className="department-member-badge">{hierarchyDepartment.memberRoles?.[person.id] || (hierarchyDepartment.head === person.id ? 'Team leader' : 'Team member')}</span>} onSelect={placeFromDirectory} />
        </aside>
      </div>}


      </div>
    </> : <>
      <MetricOverview aria-label="Workforce summary">
        {[{ label: 'Departments', value: departments.length, icon: Building2, note: 'Teams across your organisation' }, { label: 'Team members', value: people.length - unassignedCount, icon: Users, note: 'Assigned to a department' }, { label: 'Department heads', value: departments.filter(record => record.members.some(person => person.id === record.head)).length, icon: UserCheck, note: 'Teams with a designated lead' }].map(({ label, value, icon: Icon, note }) => <MetricCard key={label} label={label} icon={Icon} value={value} caption={note} />)}
      </MetricOverview>
      <section className="department-directory" aria-label="Department directory">
        <div className="department-cards">{filteredDepartments.map(record => {
          const cardMembers = record.members;
          const head = record.members.find(person => person.id === record.head);
          if (record.name === 'General') return <article className="card overview-card department-card department-card--company" key={record.name} style={departmentTheme(record.name, record.themeIndex)}>
            <div className="department-card__heading"><span className="department-card__icon"><Building2 size={22}/></span><span className="department-card__count">{cardMembers.length} employees</span></div>
            <h3><button type="button" onClick={() => open(record.name)}>General</button><small>Company leadership</small></h3>
            <p className="company-leadership-intro">Company leaders and all your people in one place.</p>
            <div className="company-leadership-summary">{COMPANY_ROLES.map(role => {
              const person = people.find(person => person.id === saved.configuration.companyLeadership?.finalized?.roles?.[role]);
              return <div key={role}>{person ? <Avatar size="sm" name={nameOf(person)} src={person.profile_pic_url}/> : <span className="department-card__lead-placeholder"><UserCheck size={16}/></span>}<span><small>{role}</small><strong>{person ? nameOf(person) : 'Not assigned'}</strong></span></div>;
            })}</div>
            <div className="department-card__footer"><span className="company-metric-cardus">{saved.configuration.companyLeadership?.finalized ? 'Leadership finalized' : 'Set up company leadership'}</span><button type="button" onClick={() => open('General')}>Open<ArrowUpRight size={16}/></button></div>
          </article>;
          return <article className="card overview-card department-card" key={record.name} style={departmentTheme(record.name, record.themeIndex)}>
            <div className="department-card__heading"><span className="department-card__icon"><Building2 size={22} aria-hidden="true"/></span><span className="department-card__count"><Users size={13} aria-hidden="true"/>{cardMembers.length} {cardMembers.length === 1 ? 'member' : 'members'}</span></div>
            <h3><button type="button" onClick={() => open(record.name)}>{record.name}</button>{record.archived && <small>Archived</small>}</h3>
            <div className="department-card__lead">{head ? <Avatar size="sm" name={nameOf(head)} src={head.profile_pic_url}/> : <span className="department-card__lead-placeholder"><UserCheck size={17} aria-hidden="true"/></span>}<div><small>Department head</small><strong>{head ? nameOf(head) : 'Not assigned'}</strong></div></div>
            <div className="department-card__details"><div><Target size={15} aria-hidden="true"/><p><span>Targets</span><span>{record.targets || 'No targets added yet'}</span></p></div><div><ClipboardList size={15} aria-hidden="true"/><p><span>Responsibilities</span><span>{record.responsibilities || 'No responsibilities added yet'}</span></p></div></div>
            <div className="department-card__footer"><div className="department-card__avatars" aria-label="Team preview">{cardMembers.slice(0, 5).map(person => <Avatar key={person.id} size="xs" name={nameOf(person)} src={person.profile_pic_url}/>)}{cardMembers.length > 5 && <span>+{cardMembers.length - 5}</span>}</div><button type="button" onClick={() => open(record.name)} aria-label={'View ' + record.name + ' department'}>View team<ArrowUpRight size={16} aria-hidden="true"/></button></div>
          </article>;
        })}</div>
        {!filteredDepartments.length && <div className="department-empty"><Search size={28} aria-hidden="true"/><h3>{departments.length ? 'No departments found' : 'Build your first team'}</h3><p>{departments.length ? 'Try searching for a different department name.' : canEdit ? 'Create a department, then assign employees in Employee Directory.' : 'Assign departments in Employee Directory to see your teams here.'}</p>{search && <Button variant="outline" size="sm" onClick={() => setSearch('')}>Clear search</Button>}</div>}
        {unassignedCount > 0 && <div className="department-unassigned"><Users size={16} aria-hidden="true"/><p><strong>{unassignedCount} {unassignedCount === 1 ? 'employee needs' : 'employees need'} a department.</strong> Assign a team in Employee Directory.</p></div>}
      </section>
    </>}</SectionSkeleton>
    <Modal isOpen={!!departmentAction} onClose={()=>{if(!saving)setDepartmentAction(null);}} busy={saving} title={departmentAction ? departmentAction.action.charAt(0).toUpperCase()+departmentAction.action.slice(1)+' department' : ''} footer={<><Button variant="outline" disabled={saving} onClick={()=>setDepartmentAction(null)}>Cancel</Button><Button variant={departmentAction?.action==='delete'?'danger':'colored'} loading={saving} disabled={departmentAction?.action==='delete' && !!departments.find(row=>row.name===departmentAction.name)?.members.length} onClick={confirmDepartmentAction}>{departmentAction?.action==='delete'?'Delete department':departmentAction?.action==='restore'?'Restore department':'Archive department'}</Button></>}>
      {departmentAction && <div className="department-responsibilities__body"><p>{departmentAction.action==='delete'?'Delete '+departmentAction.name+' and its department-specific settings? This requires an empty department. Move all permanent and temporary members first. Employee records are never deleted.':departmentAction.action==='archive'?'Archive '+departmentAction.name+'? It will move to the Archived list. Members, settings and approval routing are preserved.':'Restore '+departmentAction.name+' to the active department list?'}</p>{error && <p role="alert">{error}</p>}</div>}
    </Modal>
    <Modal isOpen={creating} onClose={() => setCreating(false)} busy={saving} title="Create department" subtitle="Give your new team a name and define its purpose." className="department-create-modal" footer={<><Button variant="outline" disabled={saving} onClick={() => setCreating(false)}>Cancel</Button><Button variant="colored" icon={Plus} type="submit" form="create-department-form" loading={saving}>Create department</Button></>}>
      <form id="create-department-form" className="department-create-form" onSubmit={createDepartment}>
        {createError && <p role="alert" className="department-create-error">{createError}</p>}
        <fieldset disabled={saving}><label>Department name <span>Required</span><input autoFocus required maxLength={200} value={newDepartment.name} placeholder="e.g. Engineering" onChange={event => setNewDepartment({ ...newDepartment, name: event.target.value })}/></label><label>Targets <span>Optional</span><textarea rows={3} maxLength={10000} placeholder="What should this team achieve?" value={newDepartment.targets} onChange={event => setNewDepartment({ ...newDepartment, targets: event.target.value })}/></label><label>Responsibilities <span>Optional</span><textarea rows={3} maxLength={10000} placeholder="What does this team own?" value={newDepartment.responsibilities} onChange={event => setNewDepartment({ ...newDepartment, responsibilities: event.target.value })}/></label></fieldset>
        <DepartmentAiDraft key={newDepartment.name} name={newDepartment.name} targets={newDepartment.targets} responsibilities={newDepartment.responsibilities} disabled={saving} onApply={result => setNewDepartment(current => ({ ...current, ...result }))}/><p className="department-create-hint">Assign employees in Employee Directory after creation. You can then select a department head from the team.</p>
      </form>
    </Modal>
    <Modal isOpen={coverageOpen} onClose={() => setCoverageOpen(false)} busy={saving} title="Schedule leadership leave cover" subtitle="Choose an acting leader and the dates they will cover." className="department-coverage-modal" footer={<><Button variant="outline" disabled={saving} onClick={() => setCoverageOpen(false)}>Cancel</Button><Button type="submit" form="department-coverage-form" icon={Check} loading={saving}>Schedule cover</Button></>}>
      <form id="department-coverage-form" className="department-coverage-form" onSubmit={saveCoverage}>
        <div className="department-coverage-context"><span><UserCheck size={20} aria-hidden="true"/></span><div><strong>{department?.name}</strong><p>Temporary leadership assignment</p></div></div>
        {error && <p role="alert" className="department-coverage-error">{error}</p>}
        <fieldset disabled={saving}>
          <label>Role on leave<select autoFocus required value={coverageDraft.role} onChange={event => setCoverageDraft({ ...coverageDraft, role: event.target.value, cover: '' })}>{LEADERSHIP_ROLES.map(role => <option key={role}>{role}</option>)}</select></label>
          <label>Acting leader<select required value={coverageDraft.cover} onChange={event => setCoverageDraft({ ...coverageDraft, cover: event.target.value })}><option value="">Select a department member</option>{department?.members.filter(person => person.department === department.name && person.id !== department.head && !LEADERSHIP_ROLES.includes(department.memberRoles?.[person.id])).map(person => <option key={person.id} value={person.id}>{nameOf(person)}</option>)}</select><small>Choose an eligible member of this department.</small></label>
          <div className="department-coverage-dates"><label>Start date<input required type="date" value={coverageDraft.from} onChange={event => setCoverageDraft({ ...coverageDraft, from: event.target.value, until: coverageDraft.until && coverageDraft.until < event.target.value ? event.target.value : coverageDraft.until })}/></label><label>End date<input required type="date" min={coverageDraft.from} value={coverageDraft.until} onChange={event => setCoverageDraft({ ...coverageDraft, until: event.target.value })}/></label></div>
        </fieldset>
        <p className="department-coverage-note"><RefreshCw size={15} aria-hidden="true"/><span>Cover includes both dates. The permanent leader resumes automatically after the end date.</span></p>
      </form>
    </Modal><Modal isOpen={!!removingPerson} onClose={() => { if (!saving) setRemovingPerson(null); }} busy={saving} title="Remove person from team" subtitle={removingPerson ? `Confirm removing ${nameOf(removingPerson)} from ${department?.name || 'team'}.` : ''} className="department-remove-modal" footer={<><Button variant="outline" disabled={saving} onClick={() => setRemovingPerson(null)}>Cancel</Button><Button variant="danger" icon={Trash2} loading={saving} onClick={confirmRemovePerson}>Remove from team</Button></>}>
      {removingPerson && <div className="department-remove-confirm">
        <p>{removingPerson.department === department?.name ? `Are you sure you want to remove ${nameOf(removingPerson)} from ${department.name}? Their department assignment and reporting relationships in this department will be removed.` : `Are you sure you want to remove ${nameOf(removingPerson)} from this team? Their indirect reporting connections to ${department.name} will be removed.`}</p>
      </div>}
    </Modal>
  </div>;
}
