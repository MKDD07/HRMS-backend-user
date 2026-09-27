import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, applyNodeChanges } from '@xyflow/react';
import dagre from 'dagre';
import { Search, Plus, Save, GitBranch, Table2, Network, GripVertical, X, ArrowDown, RefreshCw, Focus, Users, Trash2 } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { emptyMatrix, validateLink, visiblePeople, reconcileMatrix } from '../../lib/reportingMatrix';
import '@xyflow/react/dist/style.css';
import './HierarchyMatrixPage.css';
import { WorkflowSettings } from '../../components/hierarchy/WorkflowSettings';
import { WorkflowInbox } from '../../components/hierarchy/WorkflowInbox';
import { workflowApi } from '../../lib/workflowApi';
import { emptyConfiguration, validateConfiguration } from '../../../shared/workflowModel.mjs';

function EmployeeNode({ data, selected }) {
  return <div className={`hm-node ${selected ? 'is-selected' : ''} ${data.focused ? 'is-focused' : ''}`}>
    <Handle type="target" position={Position.Top} aria-label={`Manager connection for ${data.person.name}`} />
    <div className="hm-node__top"><span>{data.person.department || 'Department not set'}</span><button className="nodrag" aria-label={`Remove ${data.person.name} from chart`} onClick={() => data.remove(data.person.id)}><X size={13} /></button></div>
    <div className="hm-node__person"><Avatar name={data.person.name} src={data.person.profile_pic_url} size="sm" /><div><strong>{data.person.name}</strong><small>{data.person.designation || 'Job title not set'}</small></div></div>
    <div className="hm-node__bottom"><span>{data.person.id}</span><button className="nodrag" onClick={() => data.setFocus(data.person.id)}>Focus <Focus size={12} /></button></div>
    <Handle type="source" position={Position.Bottom} aria-label={`Report connection for ${data.person.name}`} />
  </div>;
}
const nodeTypes = { employee: EmployeeNode };
const normalize = employee => {
  const uid = String(employee.userid || employee.user_id || employee.employee_code || employee.employee_id || employee.id || '');
  const cached = typeof window !== 'undefined' ? (localStorage.getItem(`pulse_avatar_${uid}`) || '') : '';
  const profilePic = cached || employee.profile_pic_url || employee.profile?.profile_pic_url || employee.avatar_url || '';
  const fullName = [employee.first_name, employee.last_name].filter(Boolean).join(' ') || employee.name || employee.username || uid;
  return {
    ...employee,
    id: uid,
    userid: uid,
    name: fullName,
    first_name: employee.first_name || employee.username || fullName,
    last_name: employee.last_name || '',
    department: employee.department || 'General',
    designation: employee.designation || (employee.role === 'company_admin' || employee.type === 'Super Admin' ? 'Company Admin' : 'Team Member'),
    profile_pic_url: profilePic
  };
};

export function HierarchyMatrixPage({ api, currentUser, onSelectEmployee, onShowToast }) {
  const [people, setPeople] = useState([]);
  const [matrix, setMatrix] = useState(emptyConfiguration);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [savedAt, setSavedAt] = useState(null);
  const [view, setView] = useState('chart');
  const [search, setSearch] = useState('');
  const [focus, setFocus] = useState('');
  const [depth, setDepth] = useState(6);
  const [type, setType] = useState('direct');
  const [draft, setDraft] = useState({ manager: '', employee: '', type: 'direct' });
  const [editId, setEditId] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const flow = useRef(null);
  const scope = String(currentUser?.company_id || 'default');
  const byId = useMemo(() => Object.fromEntries(people.map(person => [person.id, person])), [people]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let directory = [];
      let saved = { configuration: emptyConfiguration(), revision: 0, savedAt: null };

      try {
        const [dirRes, confRes] = await Promise.all([
          workflowApi.directory().catch(err => {
            console.warn('workflowApi.directory notice:', err.message);
            return null;
          }),
          workflowApi.configuration().catch(err => {
            console.warn('workflowApi.configuration notice:', err.message);
            return null;
          })
        ]);
        if (dirRes && Array.isArray(dirRes)) directory = dirRes;
        if (confRes) saved = confRes;
      } catch (err) {
        console.warn('Workflow fetch notice:', err);
      }

      // If workflowApi returned empty, fallback to api.getAllUsers()
      if (!directory.length && api?.getAllUsers) {
        try {
          const res = await api.getAllUsers();
          const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          if (list.length) directory = list;
        } catch (e) {
          console.warn('api.getAllUsers fallback notice:', e);
        }
      }

      const employees = directory.map(normalize).filter(person => person.id);
      setPeople(employees);
      setMatrix({ ...saved.configuration, ...reconcileMatrix(saved.configuration || emptyConfiguration(), employees) });
      setRevision(saved.revision || 0);
      setSavedAt(saved.savedAt || null);
      setDirty(false);
      setFocus('');
      setSelectedLink(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [api, scope]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handleAvatarUpdate = (e) => {
      const { userid, profile_pic_url } = e.detail || {};
      if (userid && profile_pic_url) {
        setPeople(prev => prev.map(p => (p.id === userid || p.userid === userid || p.employee_code === userid) ? { ...p, profile_pic_url } : p));
      }
    };
    const handleUsersUpdate = () => { load(); };
    window.addEventListener('pulse-avatar-updated', handleAvatarUpdate);
    window.addEventListener('pulse-users-updated', handleUsersUpdate);
    return () => {
      window.removeEventListener('pulse-avatar-updated', handleAvatarUpdate);
      window.removeEventListener('pulse-users-updated', handleUsersUpdate);
    };
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const change = next => { setMatrix(next); setDirty(true); setError(''); };
  const addPerson = (id, position) => {
    if (saving || loading) return;
    if (!byId[id] || matrix.nodes.some(node => node.id === id)) return;
    change({ ...matrix, nodes: [...matrix.nodes, { id, position: position || { x: (matrix.nodes.length % 3) * 290, y: Math.floor(matrix.nodes.length / 3) * 200 } }] });
    setFocus('');
  };
  const removePerson = id => {
    if (saving || loading) return;
    change({ ...matrix, nodes: matrix.nodes.filter(node => node.id !== id), links: matrix.links.filter(link => link.manager !== id && link.employee !== id) });
    if (focus === id) setFocus(''); setSelectedLink(null);
  };
  const connect = (connection, replacing = null) => {
    if (saving || loading) return false;
    const issue = validateLink(matrix.links, connection, replacing);
    if (issue) { setError(issue); return false; }
    const nodes = [...matrix.nodes];
    for (const id of [connection.manager, connection.employee]) {
      if (!byId[id]) { setError('Select employees from the live directory.'); return false; }
      if (!nodes.some(node => node.id === id)) nodes.push({ id, position: { x: nodes.length * 290, y: 0 } });
    }
    change({ ...matrix, nodes, links: [...matrix.links.filter(link => link.id !== replacing), { ...matrix.links.find(link => link.id === replacing), ...connection, id: replacing || crypto.randomUUID() }] });
    return true;
  };
  const save = async () => {
    setSaving(true); setError('');
    try {
      const issue = validateConfiguration(matrix, people);
      if (issue) throw new Error(issue);
      const result = await workflowApi.publish(matrix, revision);
      setRevision(result.revision); setDirty(false); setSavedAt(result.savedAt); onShowToast?.({ type: 'success', title: 'Configuration published', message: 'Reporting and responsibility settings now apply to new requests. Existing requests keep their assigned route.' });
    } catch (failure) { setError(failure.message); } finally { setSaving(false); }
  };
  useEffect(() => {
    const frame = requestAnimationFrame(() => flow.current?.fitView({ padding: .2, duration: 200 }));
    return () => cancelAnimationFrame(frame);
  }, [focus, depth, loading, view]);
  const visible = useMemo(() => visiblePeople(matrix.nodes, matrix.links, focus, depth), [matrix, focus, depth]);
  const nodes = matrix.nodes.filter(node => visible.has(node.id) && byId[node.id]).map(node => ({ ...node, type: 'employee', data: { person: byId[node.id], focused: focus === node.id, remove: removePerson, setFocus } }));
  const edges = matrix.links.filter(link => visible.has(link.manager) && visible.has(link.employee)).map(link => ({ id: link.id, source: link.manager, target: link.employee, type: 'smoothstep', label: link.type === 'indirect' ? 'Indirect' : undefined, style: { stroke: selectedLink === link.id ? '#293f21' : '#81976e', strokeWidth: selectedLink === link.id ? 3 : 1.7, strokeDasharray: link.type === 'indirect' ? '6 5' : undefined }, markerEnd: { type: MarkerType.ArrowClosed, color: '#81976e' }, labelStyle: { fill: '#627553', fontSize: 10 }, labelBgStyle: { fill: '#f7faf2' } }));
  const arrange = () => {
    const graph = new dagre.graphlib.Graph(); graph.setDefaultEdgeLabel(() => ({})); graph.setGraph({ rankdir: 'TB', ranksep: 85, nodesep: 45 });
    matrix.nodes.forEach(node => graph.setNode(node.id, { width: 245, height: 145 })); matrix.links.forEach(link => graph.setEdge(link.manager, link.employee)); dagre.layout(graph);
    change({ ...matrix, nodes: matrix.nodes.map(node => ({ ...node, position: { x: graph.node(node.id).x - 122.5, y: graph.node(node.id).y - 72.5 } })) });
    requestAnimationFrame(() => flow.current?.fitView({ padding: .2, duration: 250 }));
  };
  const selected = matrix.links.find(link => link.id === selectedLink);
  const roster = people.filter(person => `${person.name} ${person.id} ${person.department || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const options = people.map(person => <option key={person.id} value={person.id}>{person.name} · {person.id}</option>);
  return <div className="hm-page" aria-busy={loading || saving}>
    <div className="hm-heading"><div><span className="hm-eyebrow">PEOPLE & ORGANIZATION</span><h1>Organizational hierarchy <span>& reporting matrix</span></h1><p>Build a clear picture of who reports to whom.</p></div><button className="hm-button hm-button--primary" disabled={loading || saving || !dirty} onClick={save}><Save size={15} />{saving ? 'Saving…' : 'Publish changes'}</button></div>
    <div className="hm-summary"><span><Users size={15} /><strong>{people.length}</strong> employees</span><span><Network size={15} /><strong>{matrix.nodes.length}</strong> on chart</span><span><i className="hm-line" /><strong>{matrix.links.filter(link => link.type === 'direct').length}</strong> direct</span><span><i className="hm-line hm-line--dashed" /><strong>{matrix.links.filter(link => link.type === 'indirect').length}</strong> indirect</span><small>{dirty ? 'Unsaved changes' : savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : 'No saved reporting relationships'}</small></div>
    {error && <div className="hm-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
    <fieldset disabled={loading || saving} className="hm-workspace">
      <div className="hm-main"><div className="hm-toolbar"><div className="hm-tabs"><button aria-pressed={view === 'chart'} onClick={() => setView('chart')}><GitBranch size={14} />Flowchart</button><button aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 size={14} />Reporting table</button><button aria-pressed={view === 'responsibilities'} onClick={() => setView('responsibilities')}>Responsibilities</button><button aria-pressed={view === 'policies'} onClick={() => setView('policies')}>Policies & preview</button><button aria-pressed={view === 'inbox'} onClick={() => setView('inbox')}>Requests & audit</button></div><button className="hm-button" onClick={() => { if (!dirty || window.confirm('Discard unsaved changes and reload the saved hierarchy?')) load(); }}><RefreshCw size={13} />Reload</button></div>
      {['responsibilities','policies'].includes(view) ? <WorkflowSettings configuration={matrix} onChange={change} people={people} view={view} /> : view === 'inbox' ? <WorkflowInbox currentUser={currentUser} people={people} /> : view === 'chart' ? <><div className="hm-chart-tools"><label>Focus employee<select value={focus} onChange={event => setFocus(event.target.value)}><option value="">All placed employees</option>{matrix.nodes.map(node => <option key={node.id} value={node.id}>{byId[node.id]?.name}</option>)}</select></label><label>Levels above & below<select value={depth} disabled={!focus} onChange={event => setDepth(Number(event.target.value))}>{[1,2,3,4,5,6].map(level => <option key={level} value={level}>{level} levels</option>)}</select></label><label>New connection<select value={type} onChange={event => setType(event.target.value)}><option value="direct">Direct</option><option value="indirect">Indirect</option></select></label><button className="hm-button" onClick={arrange} disabled={!matrix.nodes.length}><ArrowDown size={14} />Arrange</button></div>
        <div className="hm-canvas" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('application/hrms-employee'); if (id && flow.current) addPerson(id, flow.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })); }}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={instance => { flow.current = instance; }} onNodesChange={changes => { const positions = changes.filter(item => item.type === 'position'); if (positions.length) { setMatrix(current => ({ ...current, nodes: applyNodeChanges(positions, current.nodes) })); setDirty(true); } }} onConnect={params => connect({ manager: params.source, employee: params.target, type })} onEdgeClick={(_, edge) => setSelectedLink(edge.id)} onPaneClick={() => setSelectedLink(null)} nodesDraggable={!saving && !loading} nodesConnectable={!saving && !loading} deleteKeyCode={null} fitView minZoom={.15} maxZoom={1.5}><Background color="#dce5d2" gap={22} /><Controls showInteractive={false} /></ReactFlow>
          {!nodes.length && <div className="hm-canvas-empty"><Network size={34} strokeWidth={1.3} /><h3>{loading ? 'Loading your organization…' : 'Start with your people'}</h3><p>Drag employee cards here, or use the + button. Connect a manager’s bottom node to an employee’s top node.</p></div>}
          {selected && <div className="hm-edge-editor"><span>{byId[selected.manager]?.name} → {byId[selected.employee]?.name}</span><select aria-label="Selected connection type" value={selected.type} onChange={event => connect({ ...selected, type: event.target.value }, selected.id)}><option value="direct">Direct</option><option value="indirect">Indirect</option></select><button aria-label="Remove selected connection" onClick={() => { change({ ...matrix, links: matrix.links.filter(link => link.id !== selected.id) }); setSelectedLink(null); }}><Trash2 size={14} /></button></div>}
        </div><div className="hm-chart-caption"><span><i className="hm-line" /> Direct reporting</span><span><i className="hm-line hm-line--dashed" /> Indirect / dotted-line reporting</span><small>{focus ? `Showing up to ${depth} levels above and below` : 'Select an employee to explore up to 6 levels each way'}</small></div></> : <div className="hm-table-view">
        <div className="hm-form"><h3>{editId ? 'Update reporting relationship' : 'Add reporting relationship'}</h3><div><label>Manager<select value={draft.manager} onChange={event => setDraft({ ...draft, manager: event.target.value })}><option value="">Choose manager</option>{options}</select></label><label>Employee<select value={draft.employee} onChange={event => setDraft({ ...draft, employee: event.target.value })}><option value="">Choose employee</option>{options}</select></label><label>Reporting type<select value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}><option value="direct">Direct</option><option value="indirect">Indirect</option></select></label><button className="hm-button hm-button--primary" onClick={() => { if (connect(draft, editId)) { setDraft({ manager: '', employee: '', type: 'direct' }); setEditId(null); } }}>{editId ? 'Update' : 'Add link'}</button>{editId && <button className="hm-button" onClick={() => { setEditId(null); setDraft({ manager: '', employee: '', type: 'direct' }); }}>Cancel</button>}</div></div>
        <div className="hm-table-scroll"><table><thead><tr><th>Employee</th><th>Reports to</th><th>Relationship</th><th>Actions</th></tr></thead><tbody>{matrix.links.map(link => <tr key={link.id}><td><strong>{byId[link.employee]?.name}</strong><small>{link.employee}</small></td><td><strong>{byId[link.manager]?.name}</strong><small>{link.manager}</small></td><td><span className={`hm-type hm-type--${link.type}`}>{link.type}</span></td><td><button onClick={() => { setDraft({ manager: link.manager, employee: link.employee, type: link.type }); setEditId(link.id); }}>Edit</button><button aria-label={`Remove reporting relationship for ${byId[link.employee]?.name}`} onClick={() => { change({ ...matrix, links: matrix.links.filter(item => item.id !== link.id) }); if (editId === link.id) { setEditId(null); setDraft({ manager: '', employee: '', type: 'direct' }); } }}><Trash2 size={14} /></button></td></tr>)}</tbody></table>{!matrix.links.length && <div className="hm-table-empty">No reporting relationships yet. Add a manager and employee above.</div>}</div></div>}
      </div>
      <aside className="hm-roster"><div className="hm-roster-heading"><span className="hm-eyebrow">LIVE DIRECTORY</span><h2>Your people <span>{people.length}</span></h2><p>Drag a card onto the chart to get started.</p></div><label className="hm-search"><Search size={14} /><input aria-label="Search employee cards" placeholder="Name, ID or department…" value={search} onChange={event => setSearch(event.target.value)} /></label><div className="hm-roster-list">{roster.map(person => { const placed = matrix.nodes.some(node => node.id === person.id); return <div className={`hm-person ${placed ? 'is-placed' : ''}`} key={person.id} draggable={!placed} onDragStart={event => { event.dataTransfer.setData('application/hrms-employee', person.id); event.dataTransfer.effectAllowed = 'copy'; }}><div className="hm-person-top"><Avatar name={person.name} src={person.profile_pic_url} size="sm" /><div><strong>{person.name}</strong><small>{person.designation || person.id}</small></div>{!placed && <GripVertical size={15} />}</div><p>{person.department || 'Department not set'}</p><div className="hm-person-bottom"><button onClick={() => onSelectEmployee?.(person.id)} disabled={!onSelectEmployee}>View profile</button><button aria-label={`${placed ? 'Focus' : 'Add'} ${person.name}`} onClick={() => { if (placed) { setFocus(person.id); setView('chart'); } else addPerson(person.id); }}>{placed ? <><Focus size={12} />On chart</> : <><Plus size={13} />Add</>}</button></div></div>; })}{!roster.length && <p className="hm-roster-empty">{loading ? 'Loading employees…' : people.length ? 'No matching employees.' : 'No employees in the live directory.'}</p>}</div></aside>
    </fieldset>
  </div>;
}
