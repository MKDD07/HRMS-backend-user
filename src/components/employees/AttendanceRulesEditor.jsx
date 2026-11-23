import { GeofencePreview } from '../ui/GeofencePreview';
import React, { useState } from 'react';
import { CalendarDays, MapPin, Save, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { TenantPanelHeader } from '../ui/TenantPanel';
import { Toggle } from '../ui/Toggle';
import '../../pages/employees/EmployeesPage/DossierEditors.scss';
import './AttendanceRulesEditor.scss';

const input = (name, label, type = 'text', value = '', required = false) => <label key={name}>{label}<input name={name} type={type} defaultValue={value ?? ''} step={type === 'number' ? 'any' : undefined} required={required}/></label>;
function RuleSwitch({ id, title, description, checked, onChange, disabled }) {
  return <div className="attendance-rule-switch"><label htmlFor={id}>{title}<small>{description}</small></label><Toggle id={id} checked={checked} onChange={onChange} disabled={disabled}/></div>;
}
export function AttendanceRulesEditor({ employee, onSave, compact = false, departmentMode = false }) {
  return <RulesForm key={`${employee.userid}:${employee.dossier_revision}`} employee={employee} onSave={onSave} compact={compact} departmentMode={departmentMode}/>;
}
function RulesForm({ employee, onSave, compact = false, departmentMode = false }) {
  const rule = employee.attendance_rule || {}, shift = employee.shift_override, sites = employee.available_locations || [];
  const [custom, setCustom] = useState(Boolean(shift)), [mode, setMode] = useState(rule.mode === 'campus' ? 'custom' : rule.mode || 'none'), [group, setGroup] = useState(rule.group_id || '');
  const [photo, setPhoto] = useState(rule.photo_required === true), [wfh, setWfh] = useState(rule.allow_wfh === true), [enabled, setEnabled] = useState(rule.status !== 'Paused');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [preview, setPreview] = useState({ latitude: rule.latitude ?? '', longitude: rule.longitude ?? '', radius: rule.radius_meters ?? '' });
  const site = sites.find(s => s.group_id === group);
  async function submit(event) {
    event.preventDefault(); const f = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      await onSave({ ...(compact ? {} : { shift_id: f.get('shift_id'), shift_override: custom ? { startTime: f.get('startTime'), endTime: f.get('endTime'), workingDays: f.getAll('workingDays'), breakDurationMins: Number(f.get('breakDurationMins')), gracePeriodMins: Number(f.get('gracePeriodMins')), earlyExitGraceMins: Number(f.get('earlyExitGraceMins')) } : null }),
        attendance_rule: { mode, group_id: group, name: f.get('location_name') || '', latitude: mode === 'custom' ? Number(f.get('latitude')) : null, longitude: mode === 'custom' ? Number(f.get('longitude')) : null, radius_meters: mode === 'custom' ? Number(f.get('radius_meters')) : null, photo_required: photo, allow_wfh: wfh, status: enabled ? 'Enforced' : 'Paused', notes: f.get('policy_notes') } });
      setDirty(false);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form className="dossier-inline-form attendance-rules-editor" onSubmit={submit} onChange={event => { setDirty(true); const { name, value } = event.target; if (['latitude', 'longitude', 'radius_meters'].includes(name)) setPreview(old => ({ ...old, [name === 'radius_meters' ? 'radius' : name]: value })); }}><fieldset disabled={busy}>
    {!compact && <Card className="overview-card attendance-rules-card">
      <TenantPanelHeader title="Work schedule" subtitle="Choose a company shift or set individual working hours." icon={CalendarDays}/>
      <div className="attendance-rules-body">
        <div className="dossier-form-grid"><label>Company shift<select name="shift_id" defaultValue={employee.shift_id || ''}><option value="">Company default</option>{(employee.available_shifts || []).filter(s => s.status === 'Active').map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>)}</select></label><RuleSwitch id="rules-individual-hours" title="Individual timings" description="Override the company shift for this person." checked={custom} onChange={value=>{setCustom(value);setDirty(true);}} disabled={busy}/></div>
        {custom && <><div className="dossier-form-grid">{input('startTime','Start time','time',shift?.startTime,true)}{input('endTime','End time','time',shift?.endTime,true)}{input('breakDurationMins','Break (minutes)','number',shift?.breakDurationMins ?? 0,true)}{input('gracePeriodMins','Arrival grace (minutes)','number',shift?.gracePeriodMins ?? 0,true)}{input('earlyExitGraceMins','Early exit grace (minutes)','number',shift?.earlyExitGraceMins ?? 0,true)}</div><fieldset className="attendance-working-days"><legend>Working days</legend><div>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <label key={day}><input type="checkbox" name="workingDays" value={day} defaultChecked={shift?.workingDays?.includes(day)}/><span>{day}</span></label>)}</div></fieldset></>}
      </div>
    </Card>}
    {compact && !departmentMode && <p className="attendance-assigned-shift">Assigned shift: <strong>{employee.shift_override ? 'Individual schedule' : employee.available_shifts?.find(item => item.id === employee.shift_id)?.name || 'Company default'}</strong></p>}
    <Card className="overview-card attendance-rules-card">
      <TenantPanelHeader title="Location & punch rules" subtitle="Set where this person can punch in and what is required." icon={MapPin}/>
      <div className="attendance-rules-body">
        <div className="dossier-form-grid"><label>Location policy<select value={mode} onChange={e => setMode(e.target.value)}><option value="none">No location boundary</option><option value="group">Campus site</option><option value="custom">Individual location</option></select></label>
          {mode === 'group' && <label>Assigned campus<select required value={group} onChange={e => { setGroup(e.target.value); const selected = sites.find(s => s.group_id === e.target.value); if (selected) setPhoto(selected.photo_required); }}><option value="">Select a campus</option>{rule.group_id && !site && <option value={rule.group_id} disabled>Assigned campus unavailable</option>}{sites.map(s => <option key={s.group_id} value={s.group_id}>{s.name}</option>)}</select></label>}
          {mode === 'custom' && <>{input('location_name','Location name','text',rule.name,true)}{input('latitude','Latitude','number',rule.latitude,true)}{input('longitude','Longitude','number',rule.longitude,true)}{input('radius_meters','Radius (metres)','number',rule.radius_meters,true)}</>}
        </div>
        {mode === 'group' && <p className="attendance-rules-boundary"><MapPin size={14}/>{site ? site.is_unrestricted ? 'This campus has no location boundary.' : `${site.latitude}, ${site.longitude} / ${site.radius_meters} m radius` : sites.length ? 'Select a campus to view its boundary.' : 'No campus sites saved. Add one in Geofence & Photo Rules.'}</p>}
        {mode === 'custom' && <GeofencePreview {...preview} />}
        {mode === 'group' && site && !site.is_unrestricted && <GeofencePreview latitude={site.latitude} longitude={site.longitude} radius={site.radius_meters} />}
      </div>
    </Card>
    <Card className="overview-card attendance-rules-card">
      <div className="attendance-rules-body">
        <div className="attendance-rules-options attendance-rules-options--combined"><RuleSwitch id="rules-photo" title="Photo required" description="Photo with each punch." checked={photo} onChange={value=>{setPhoto(value);setDirty(true);}} disabled={busy}/><RuleSwitch id="rules-wfh" title="Work from home" description="Allow remote attendance." checked={wfh} onChange={value=>{setWfh(value);setDirty(true);}} disabled={busy}/><RuleSwitch id="rules-enabled" title="Policy enabled" description={enabled ? 'Rules enabled.' : 'Rules paused.'} checked={enabled} onChange={value=>{setEnabled(value);setDirty(true);}} disabled={busy}/></div>
        <label className="attendance-admin-notes">Admin notes<textarea name="policy_notes" rows={2} maxLength={500} defaultValue={rule.notes || ''} placeholder="Optional notes about this policy" /></label>
      </div>
    </Card>
    {compact && <div className="attendance-effective-rule"><strong>Effective settings</strong><p>{enabled ? 'Enabled' : 'Paused'} / {mode === 'none' ? 'No location boundary' : mode === 'group' ? site?.name || 'Campus not selected' : 'Custom boundary'} / Photo {photo ? 'required' : 'optional'} / Remote work {wfh ? 'allowed' : 'off'}</p><small>These settings are saved. Location and photo enforcement is not connected to punching.</small>{employee.attendance_rule_updated_by && <small>Updated by {employee.attendance_rule_updated_by}</small>}{rule.updated_at && <small>Updated {new Date(rule.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</small>}</div>}
    {error && <p role="alert" className="people-error">{error}</p>}
    <div className="attendance-rules-footer"><Button type="submit" variant={dirty ? "colored" : "fadeout"} disabled={!dirty} size="sm" icon={Save} wrapContent={false} loading={busy}>{departmentMode ? 'Apply to department' : 'Save rules'}</Button></div>
  </fieldset></form>;
}
