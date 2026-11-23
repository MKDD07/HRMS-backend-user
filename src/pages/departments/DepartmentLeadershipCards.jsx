import React, { useEffect, useState } from 'react';
import { Building2, Save } from 'lucide-react';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { WorkspaceFilters } from '../../components/ui/WorkspaceFilters';
import { Button } from '../../components/ui/Button';
import { assignDepartmentRole } from '../../../shared/departmentRoles.mjs';

function DepartmentLeadershipCard({ record, onSave, disabled }) {
  const manager = Object.entries(record.memberRoles || {}).find(([,role]) => role === 'Manager')?.[0] || '';
  const [draft, setDraft] = useState({ manager, head: record.head || '' });
  useEffect(() => { setDraft({ manager, head: record.head || '' }); }, [manager, record.head]);
  const members = record.members.filter(person => person.department === record.name && person.account_status !== 'disabled' && person.status !== 'Inactive');
  const changed = draft.manager !== manager || draft.head !== (record.head || '');
  const save = () => {
    const { members: ignored, ...settings } = record;
    let next = { ...settings, head: '', memberRoles: Object.fromEntries(Object.entries(settings.memberRoles || {}).filter(([,role]) => !['Manager', 'Team leader'].includes(role))), leadershipCoverage: [] };
    if (draft.manager) next = assignDepartmentRole(next, draft.manager, 'Manager');
    if (draft.head) next = assignDepartmentRole(next, draft.head, 'Team leader');
    next.leadershipCoverage = (settings.leadershipCoverage || []).filter(row => next.memberRoles[row.person] === row.role && !['Manager', 'Team leader'].includes(next.memberRoles[row.cover]));
    onSave(next);
  };
  return <TenantPanel title={record.name} subtitle={`${record.members.length} members`} icon={Building2}>
    <fieldset disabled={disabled}>
      <WorkspaceFilters>
        <label><span className="workspace-filters__label">Manager</span><select value={draft.manager} onChange={event => setDraft({ ...draft, manager: event.target.value })}><option value="">Not assigned</option>{members.filter(person => person.id !== draft.head).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label><span className="workspace-filters__label">Team leader / department head</span><select value={draft.head} onChange={event => setDraft({ ...draft, head: event.target.value })}><option value="">Not assigned</option>{members.filter(person => person.id !== draft.manager).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <Button size="sm" variant="outline" icon={Save} disabled={!changed} onClick={save}>Save leaders</Button>
      </WorkspaceFilters>
    </fieldset>
  </TenantPanel>;
}

export function DepartmentLeadershipCards({ departments, onSave, disabled }) {
  return <section aria-label="Department leadership" className="department-leadership-section">
    <h2>Department leadership</h2>
    <p>Select each department’s Manager and Team leader. Saving updates direct reporting within that department.</p>
    <div className="workspace-grid department-leadership-grid">{departments.filter(record => record.name !== 'General' && !record.archived).map(record => <DepartmentLeadershipCard key={record.name} record={record} onSave={onSave} disabled={disabled} />)}</div>
  </section>;
}
