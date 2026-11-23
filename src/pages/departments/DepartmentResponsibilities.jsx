import { Avatar } from '../../components/ui/Avatar';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { departmentMembers } from '../../../shared/departmentMembership.mjs';
import React, { useEffect, useState } from 'react';
import { ClipboardList, Users, ShieldCheck, Plus, Check, X, RotateCcw } from 'lucide-react';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { WorkspaceFilters } from '../../components/ui/WorkspaceFilters';
import { Toggle } from '../../components/ui/Toggle';
import { WorkflowSettings } from '../../components/hierarchy/WorkflowSettings';
import { REQUEST_TYPES, defaultPolicy, resolveResponsibilityHolder, resolveRoute } from '../../../shared/workflowModel.mjs';
import { personOnLeave } from '../../../shared/departmentCoverage.mjs';
import { istDay } from '../../../shared/overviewModel.mjs';
import './DepartmentResponsibilities.scss';

const labels = { leave: 'Leave', attendance: 'Attendance corrections', expense: 'Expenses', other: 'Other requests' };
const nameOf = person => person?.name || person?.first_name || person?.id || 'Not assigned';
const active = person => person.account_status !== 'disabled' && !['Inactive', 'disabled'].includes(person.status);

export function DepartmentResponsibilities({ configuration, department, people, onChange, disabled }) {
  const [tab, setTab] = useState('setup');
  const [kind, setKind] = useState('leave');
  const [employee, setEmployee] = useState('');
  const [assigning, setAssigning] = useState('primary');
  const [today, setToday] = useState(() => istDay());
  useEffect(() => {
    const updateDay = () => setToday(istDay());
    const timer = window.setInterval(updateDay, 30_000);
    document.addEventListener('visibilitychange', updateDay);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateDay);
    };
  }, []);
  const record = configuration.departments?.find(row => row.name === department) || { name: department, head: '', targets: '', responsibilities: '' };
  const setting = { enabled: false, primary: '', backup: '', unavailable: false, ...record.approvals?.[kind] };
  const primary = setting.primary || record.head;
  const names = Object.fromEntries(people.map(person => [person.id, nameOf(person)]));
  const byId = new Map(people.map(person => [person.id, person]));
  const team = departmentMembers(department, people, record.temporaryMembers);
  const onLeave = person => Boolean(person && personOnLeave(person, configuration.departments, today));
  const handler = setting.enabled ? resolveResponsibilityHolder(configuration, department, byId, primary, setting, today) : '';
  const isCovering = id => handler && handler !== primary && handler === id;
  function assignmentBadge(person) {
    if (isCovering(person.id)) return <StatusBadge status="Acting primary" variant="success" />;
    if (person.id === primary) return onLeave(person)
      ? <StatusBadge status="Primary on leave" variant="neutral" />
      : <StatusBadge status="Primary" variant="info" />;
    if (person.id === setting.backup) return onLeave(person)
      ? <StatusBadge status="Backup on leave" variant="neutral" />
      : <StatusBadge status="Backup" variant="warning" />;
    if (!active(person)) return <StatusBadge status="Inactive" />;
    return onLeave(person) ? <StatusBadge status="On leave" /> : null;
  }
  const update = changes => {
    const assignment = { ...setting, ...changes };
    const next = { ...record, approvals: { ...record.approvals, [kind]: assignment } };
    let policies = configuration.policies;
    const id = `department:${encodeURIComponent(department)}:${kind}`;
    if (assignment.enabled) {
      const existing = policies.find(policy => policy.id === id);
      const policy = { ...defaultPolicy(kind), ...existing, id, name: `${department} · ${labels[kind]}`, department, mode: 'any', maxStep: 1, enabled: true, priority: existing?.priority ?? Math.max(0, ...policies.map(row => row.priority || 0)) + 1 };
      policies = [...policies.filter(row => row.id !== id), policy];
    } else policies = policies.filter(row => row.id !== id);
    onChange({ ...configuration, policies, departments: [...(configuration.departments || []).filter(row => row.name !== department), next] });
  };
  const preview = employee ? REQUEST_TYPES.map(type => ({ type, route: resolveRoute(configuration, people, { requester: employee, kind: type, days: 1 }, today) })) : [];
  return <div className="department-responsibilities">
    <ViewTabs value={tab} onChange={setTab} label="Responsibility views" tabs={[{ id: 'setup', label: 'Responsibilities', icon: ClipboardList }, { id: 'person', label: 'Employee view', icon: Users }, { id: 'advanced', label: 'Advanced policies', icon: ShieldCheck }]} />
    {tab === 'setup' && <div className="workspace-grid department-responsibilities__workspace">
      <TenantPanel className="department-responsibilities__main" title="Who handles requests?" subtitle="Choose a request type, then add a primary person and one backup from your team.">
      <div className="department-responsibilities__tabs"><ViewTabs value={kind} onChange={value=>{setKind(value);setAssigning('primary');}} label="Request types" tabs={REQUEST_TYPES.map(id => ({ id, label: labels[id] }))} /></div>
      <fieldset disabled={disabled}>
        <WorkspaceFilters>
          <label><span className="workspace-filters__label">Department approval</span><Toggle checked={setting.enabled} aria-label={`Enable ${labels[kind]} responsibility`} onChange={() => update({ enabled: !setting.enabled })} /></label>
          <label><span className="workspace-filters__label">Use backup now</span><Toggle checked={setting.unavailable} aria-label="Primary person unavailable" onChange={() => update({ unavailable: !setting.unavailable })} /></label>
        </WorkspaceFilters>
        <div className="department-responsibilities__body">
          <ViewTabs value={assigning} onChange={setAssigning} label="Choose assignment role" tabs={[{id:'primary',label:'Primary person'},{id:'backup',label:'Backup person'}]} />
          <div className="department-responsibilities__assignees">{['primary','backup'].map(role=>{
            const id=role==='primary'?primary:setting.backup;
            const person=byId.get(id);
            return <div className={`department-responsibilities__assignee${onLeave(person) ? ' is-on-leave' : ''}`} key={role}>
              {person && <Avatar size="md" name={nameOf(person)} src={person.profile_pic_url} userid={person.id} />}
              <div className="department-responsibilities__assignee-copy"><small>{role==='primary'?'Primary person':'Backup person'}</small><strong>{person?nameOf(person):'Choose from the team directory'}</strong>{person && <div>{assignmentBadge(person)}</div>}{role==='primary' && person && !setting.primary && <small>Department head</small>}</div>
              {role==='primary' ? setting.primary && <Button size="sm" variant="fadeout" icon={record.head?RotateCcw:X} iconOnly aria-label={record.head?'Use department head as primary':'Clear primary person'} title={record.head?'Use department head':'Clear primary person'} onClick={()=>update({primary:'',backup:setting.backup===record.head?'':setting.backup,enabled:record.head?setting.enabled:false})}/> : person && <Button size="sm" variant="fadeout" icon={X} iconOnly aria-label="Remove backup person" title="Remove backup" onClick={()=>update({backup:''})}/>}
            </div>;
          })}</div>
          <p role="status">Adding a person enables {labels[kind].toLowerCase()} approval. Approved leave activates the backup automatically.</p>
        </div>
      </fieldset>
      <div className="department-responsibilities__body">
        <p>When enabled, this replaces individual reporting assignments for {labels[kind].toLowerCase()} in {department}. If both people are unavailable, approval needs administrator attention.</p>
        <div className="department-responsibilities__table"><table><thead><tr><th>Responsibility</th><th>Primary</th><th>Backup</th><th>Handling now</th></tr></thead><tbody>{REQUEST_TYPES.map(type => {
          const row = record.approvals?.[type];
          const owner = row?.primary || record.head;
          const current = row?.enabled ? resolveResponsibilityHolder(configuration, department, byId, owner, row, today) : '';
          return <tr key={type}><th scope="row">{labels[type]}</th><td>{row?.enabled ? names[owner] || 'Not assigned' : 'Individual reporting rules'}</td><td>{row?.enabled ? names[row.backup] || 'Not assigned' : '—'}</td><td>{row?.enabled ? names[current] || 'No available approver' : 'See employee view'}</td></tr>;
        })}</tbody></table></div>
      </div>
    </TenantPanel>
      <aside className="department-responsibilities__directory" aria-label="Team assignment directory">
        <EmployeeDirectory employees={team} variant="list" searchOnly headerTitle="Team directory" subtitle={`Add a ${assigning === 'primary' ? 'primary person' : 'backup'} for ${labels[kind].toLowerCase()}.`} selectedId={assigning==='primary'?primary:setting.backup} actionsPlacement="inline" pageSize={6}
          getCardProps={person => ({ className: (person.id === primary || person.id === setting.backup) && onLeave(person) ? 'is-approval-assignee-on-leave' : '' })}
          renderMeta={assignmentBadge}
          renderActions={person=>{
            const selected=person.id===(assigning==='primary'?primary:setting.backup);
            const otherRole=person.id===(assigning==='primary'?setting.backup:primary);
            const unavailable=disabled || !active(person) || selected || otherRole;
            const hint=selected?'Already assigned':otherRole?`Already assigned as ${assigning==='primary'?'backup':'primary'}`:`Add ${nameOf(person)} as ${assigning} for ${labels[kind].toLowerCase()}`;
            return <Button size="sm" variant="fadeout" icon={selected?Check:Plus} iconOnly disabled={unavailable} title={hint} aria-label={hint} onClick={()=>{if(unavailable)return;update({[assigning]:person.id,enabled:true});if(assigning==='primary')setAssigning('backup');}}/>;
          }} />
      </aside>
    </div>}
    {tab === 'person' && <TenantPanel title="Employee responsibilities" subtitle="See what this person receives, their backup duties, and who handles their own requests.">
      <WorkspaceFilters><label><span className="workspace-filters__label">Employee</span><select value={employee} onChange={event => setEmployee(event.target.value)}><option value="">Choose employee</option>{team.map(person => <option key={person.id} value={person.id}>{nameOf(person)}</option>)}</select></label></WorkspaceFilters>
      <div className="department-responsibilities__body">{!employee ? <p>Select a person to see all assignments.</p> : <>
        <h3>Assigned responsibilities</h3>
        <ul>{(configuration.departments || []).flatMap(team => REQUEST_TYPES.flatMap(type => {
          const row = team.approvals?.[type]; if (!row?.enabled) return [];
          const role = (row.primary || team.head) === employee ? 'Primary' : row.backup === employee ? 'Backup' : '';
          return role ? <li key={`${team.name}:${type}`}>{team.name} · {labels[type]} · {role}</li> : [];
        }))}{configuration.links.flatMap(link => REQUEST_TYPES.flatMap(type => {
          const row = link.responsibilities?.[type];
          const team = people.find(person => person.id === link.employee)?.department;
          if (!row?.enabled || configuration.departments?.find(item => item.name === team)?.approvals?.[type]?.enabled) return [];
          const role = link.manager === employee ? row.role : row.backup === employee ? 'Backup' : '';
          return role ? <li key={`${link.id}:${type}`}>{labels[type]} · {role} for {names[link.employee]}</li> : [];
        }))}</ul>
        <h3>Their requests go to</h3>
        {preview.map(({type,route}) => <p key={type}><strong>{labels[type]}:</strong> {route.blocked || route.participants.map(person => `${person.name} (${person.role}${person.delegated ? ', backup' : ''})`).join(', ')}{route.policy && ` · ${route.policy.name}`}</p>)}
      </>}</div>
    </TenantPanel>}
    {tab === 'advanced' && <fieldset disabled={disabled}><details><summary>Individual reporting responsibilities</summary><WorkflowSettings configuration={configuration} people={people} onChange={onChange} view="responsibilities" /></details><details><summary>Policies and routing preview</summary><WorkflowSettings configuration={configuration} people={people} onChange={onChange} view="policies" /></details></fieldset>}
  </div>;
}
