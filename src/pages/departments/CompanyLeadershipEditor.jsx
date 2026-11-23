import React, { useState } from 'react';
import { Check, Save, UserCheck, X, ArrowRight } from 'lucide-react';
import { COMPANY_ROLES } from '../../../shared/companyLeadership.mjs';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { TenantPanel } from '../../components/ui/TenantPanel';
const nameOf = person => person?.name || [person?.first_name, person?.last_name].filter(Boolean).join(' ') || 'Not assigned';

export function CompanyLeadershipEditor({ people, draft, finalized, onChange, onSave, saving, canEdit }) {
  const [selectedRole, setSelectedRole] = useState('Owner');
  const changed = COMPANY_ROLES.some(role => (draft[role] || '') !== (finalized?.roles?.[role] || ''));
  return <div className="workspace-grid company-leadership-workspace">
    <TenantPanel className="company-leadership-main" title="Company leadership" subtitle="Choose a person from the directory or drag them onto a role.">
      <div className="company-leadership-status"><span>{changed ? 'Draft changes' : finalized ? 'Finalized' : 'Not finalized'}</span></div>
      <div className="company-role-tiles">{COMPANY_ROLES.map(role => {
        const person = people.find(person => person.id === draft[role]);
        const pending = (draft[role] || '') !== (finalized?.roles?.[role] || '');
        return <div className={'company-role-tile' + (selectedRole === role ? ' is-active' : '')} key={role} onDragOver={event => { if (canEdit && !saving && event.dataTransfer.types.includes('application/hrms-company-person')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} onDrop={event => { event.preventDefault(); if (!canEdit || saving) return; const id = event.dataTransfer.getData('application/hrms-company-person'); if (!people.some(person => person.id === id && person.account_status !== 'disabled' && !['Inactive', 'disabled'].includes(person.status))) return; setSelectedRole(role); onChange({ ...draft, [role]: id }); }}>
          <button type="button" disabled={!canEdit || saving} aria-pressed={selectedRole === role} onClick={() => setSelectedRole(role)}><span className="company-role-label">{role}<small>{pending ? 'Draft' : finalized?.roles?.[role] ? 'Finalized' : 'Unassigned'}</small></span>{person ? <Avatar size="md" name={nameOf(person)} src={person.profile_pic_url}/> : <span className="company-role-placeholder"><UserCheck size={22}/></span>}<span className="company-role-person"><strong>{nameOf(person)}</strong><small>{person?.designation || 'Select someone to assign this role'}</small></span><ArrowRight size={17}/></button>
          {canEdit && person && <Button size="sm" variant="outline" iconOnly icon={X} disabled={saving} aria-label={'Clear ' + role + ' draft assignment'} onClick={() => onChange({ ...draft, [role]: '' })}/>}
        </div>;
      })}</div>
      <div className="company-leadership-editor-footer"><p>Save your draft to return later. Finalize when the assignments are ready.</p>{canEdit && <div><Button variant="outline" icon={Save} disabled={saving} onClick={() => onSave(false)}>Save draft</Button><Button className={'company-finalize-icon' + (!changed && finalized ? ' is-finalized' : '')} variant="fadeout" iconOnly icon={Check} disabled={saving || (!changed && Boolean(finalized))} aria-hidden={!changed && finalized ? true : undefined} tabIndex={!changed && finalized ? -1 : 0} aria-label="Finalize assignments" title="Finalize assignments" onClick={() => onSave(true)}/></div>}</div>
    </TenantPanel>
    {canEdit && <aside className="company-leadership-picker"><div className="company-leadership-picker-label"><small>Assigning</small><strong>{selectedRole}</strong><span>Select a person or drag them onto a role</span></div><EmployeeDirectory employees={people.filter(person => person.account_status !== 'disabled' && !['Inactive', 'disabled'].includes(person.status))} variant="list" pageSize={7} selectedId={draft[selectedRole]} getCardProps={person => ({ draggable: !saving, onDragStart: event => { event.dataTransfer.setData('application/hrms-company-person', person.id); event.dataTransfer.effectAllowed = 'copy'; } })} onSelect={person => { if (!saving) onChange({ ...draft, [selectedRole]: person.id }); }} /></aside>}
  </div>;
}
