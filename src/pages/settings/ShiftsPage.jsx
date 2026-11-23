import { StatusBadge } from '../../components/ui/StatusBadge';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { shiftTimingError } from '../../../shared/shiftTiming.mjs';
import { createPortal } from 'react-dom';
import { Toast } from '../../components/ui/Toast';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { TenantHeader } from '../../components/ui/TenantHeader';

import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { cacheCompanyShifts } from '../../lib/shiftStore';
import React, { useEffect, useId, useState } from 'react';
import { Eye, CalendarDays, Clock3, Clock, Coffee, Plus, Moon, Sun, Sunset, Sunrise, Edit2, Trash2, Sparkles } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { dashboardAdminApi } from '../../lib/dashboardAdminApi';
import '../dashboard/DashboardPage.scss';
import './WorkspaceSettings.scss';

const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const templates = [
  { key: 'day', name: 'Day shift', startTime: '09:00', endTime: '18:00', breakDurationMins: 60, gracePeriodMins: 0, workingDays: days.slice(0,5), icon: Sun, label: 'Day / General' },
  { key: 'afternoon', name: 'Afternoon shift', startTime: '14:00', endTime: '22:00', breakDurationMins: 45, gracePeriodMins: 0, workingDays: days.slice(0,6), icon: Sunset, label: 'Evening' },
  { key: 'night', name: 'Night shift', startTime: '22:00', endTime: '06:00', breakDurationMins: 30, gracePeriodMins: 0, workingDays: days.slice(0,5), icon: Moon, label: 'Overnight' }
];
export function ShiftsPage() {
  const shiftFormId = useId();
  const [data,setData] = useState({value:[],revision:0}), [loading,setLoading] = useState(true), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [editing,setEditing] = useState(null), [workingDays,setWorkingDays] = useState([]), [saving,setSaving] = useState(false);
  const [shortLeaveEnabled, setShortLeaveEnabled] = useState(false);
  const [earlyInEnabled, setEarlyInEnabled] = useState(false);
  const [earlyOutEnabled, setEarlyOutEnabled] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [viewing, setViewing] = useState(null);

  async function load() { setLoading(true); setError(''); try { const result = await dashboardAdminApi.configuration('shifts'); setData(result); cacheCompanyShifts(result.value); } catch(e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  function edit(shift) { setError(''); setEditing(shift); setWorkingDays(shift.workingDays); setShortLeaveEnabled(!!shift.shortLeaveEnabled); setEarlyInEnabled(!!shift.earlyInEnabled); setEarlyOutEnabled(!!shift.earlyOutEnabled); }
  async function remove(shift) {
    if (!window.confirm(`Are you sure you want to delete "${shift.name}"?`)) return;
    setSaving(true); setError('');
    const next = data.value.filter(s => s.id !== shift.id);
    try {
      const result = await dashboardAdminApi.saveConfiguration('shifts', next, data.revision);
      setData(result);
      cacheCompanyShifts(result.value);
      setNotice(`Shift profile "${shift.name}" removed.`);
    } catch(e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const shift = { ...editing, ...values, id: editing.id || crypto.randomUUID(), workingDays, breakDurationMins: Number(values.breakDurationMins), gracePeriodMins: Number(values.gracePeriodMins), earlyExitGraceMins:Number(values.earlyExitGraceMins), halfDayHours:Number(values.halfDayHours), shortLeaveEnabled, earlyInEnabled: shortLeaveEnabled && earlyInEnabled, earlyOutEnabled: shortLeaveEnabled && earlyOutEnabled, earlyInTime: shortLeaveEnabled && earlyInEnabled ? values.earlyInTime : '', earlyOutTime: shortLeaveEnabled && earlyOutEnabled ? values.earlyOutTime : '', isDefault: values.isDefault === 'on', isOvernight: values.endTime < values.startTime, status: values.status === 'on' ? 'Active' : 'Inactive' };
    const timingError = shiftTimingError(shift);
    if (timingError) { setError(timingError); setSaving(false); return; }
    const next = [...data.value.filter(s => s.id !== shift.id), shift].map(s => shift.isDefault ? {...s,isDefault:s.id===shift.id} : s);
    try { const result = await dashboardAdminApi.saveConfiguration('shifts',next,data.revision); setData(result); cacheCompanyShifts(result.value); setEditing(null); setNotice('Shift profile saved to your company workspace.'); } catch(e) { setError(e.message); } finally { setSaving(false); }
  }

  function handleSelectTemplate(template) {
    setShowTemplateModal(false);
    edit({ ...template, isDefault: !data.value.length, status: 'Active' });
  }

  return <main className="tenant-dashboard workspace-settings">
    <TenantHeader
      settings={{
        subheading: "WORKSPACE / WORK SCHEDULES",
        heading: "Shifts",
        paragraph: "Build reusable schedules with working days, breaks, and arrival grace.",
        buttons: [
          { id: 'templates', label: 'Shift Templates' },
          { id: 'create', label: 'Create shift' }
        ],
        refresh: true
      }}
      actions={{
        refresh: { onClick: load, loading },
        templates: {
          icon: Sparkles,
          variant: 'outline',
          disabled: loading || !!error,
          onClick: () => setShowTemplateModal(true)
        },
        create: {
          icon: Plus,
          disabled: loading || !!error,
          onClick: () => edit({ ...templates[0], name: '', isDefault: !data.value.length, status: 'Active' })
        }
      }}
    />

    <MetricOverview loading={loading}>
      {[['Shift profiles',data.value.length,'Saved company schedules'],['Active shifts',data.value.filter(s => s.status==='Active').length,'Available schedule profiles'],['Default schedule',data.value.find(s => s.isDefault)?.name || 'Not set','Your company’s reference shift']].map(([label,value,note]) => (
        <MetricCard key={label} loading={loading} label={label} icon={Clock3} value={loading ? '—' : value} caption={note} />
      ))}
    </MetricOverview>

    {notice && createPortal(<div className="shift-glass-notification" role="status" aria-live="polite"><Toast type="success" message={notice} onClose={() => setNotice('')} /></div>, document.body)}
    {error && !editing && <p className="ws-error" role="alert">{error}</p>}

    <TenantPanel title={<>Company shift profiles</>} subtitle={<>Working hours, weekly schedules and attendance grace.</>} className="ws-section shift-profiles">
      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr>
              <th>Shift</th>
              <th>Schedule</th>
              <th>Working days</th>
              <th>Break & grace</th>
              <th>Status</th>
              <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.value.map(s => {
              const ShiftIcon = s.isOvernight ? Moon : Sun;
              return (
                <tr key={s.id}>
                  <td>
                    <div className="shift-profile-name"><span className="shift-profile-icon"><ShiftIcon size={18} /></span><div><strong>{s.name}</strong>
                    <small>{s.isDefault ? 'Default schedule' : s.isOvernight ? 'Overnight schedule' : 'Day schedule'}</small></div></div>
                  </td>
                  <td className="shift-profile-hours">{s.startTime} – {s.endTime}</td>
                  <td><div className="shift-profile-days" aria-label={`Working days: ${s.workingDays.join(', ')}`}>{days.map(day => <span key={day} className={s.workingDays.includes(day) ? 'is-working' : ''} title={day}>{day.slice(0, 2)}</span>)}</div></td>
                  <td><span>{s.breakDurationMins} min break</span><small>{s.gracePeriodMins} min arrival grace</small></td>
                  <td>
                    <StatusBadge status={s.status || 'Active'} />
                  </td>
                  <td>
                    <div className="ws-table-actions">
                      <Button type="button" className="ws-action-icon-btn" title="Edit shift" aria-label={`Edit ${s.name}`} disabled={saving || loading} onClick={() => edit(s)} variant="fadeout" wrapContent={false} iconOnly={true} size="sm">
                        <Edit2 size={16} />
                      </Button>
                      <Button type="button" className="ws-action-icon-btn" title="View shift" aria-label={`View ${s.name}`} disabled={saving || loading} onClick={() => setViewing(s)} variant="fadeout" iconOnly icon={Eye} size="sm" />
                      <Button type="button" className="ws-action-icon-btn ws-action-icon-btn--danger" title="Delete shift" aria-label={`Delete ${s.name}`} disabled={saving || loading} onClick={() => remove(s)} variant="fadeout" wrapContent={false} iconOnly={true} size="sm">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data.value.length && (
          <p className="tenant-empty">
            {loading ? 'Loading shifts...' : 'Choose a template or create your first company shift.'}
          </p>
        )}
      </div>
    </TenantPanel>

    {viewing && <Modal isOpen title={viewing.name} subtitle="Shift details" size="lg" className="shift-editor" onClose={() => setViewing(null)} footer={<Button variant="outline" onClick={() => setViewing(null)}>Close</Button>}>
      <TenantPanel title="Schedule & attendance" icon={Clock} headingLevel={3} className="shift-editor-section">
        <dl className="shift-view-details">
          {[
            ['Status', <StatusBadge status={viewing.status || 'Active'} />],
            ['Company default', viewing.isDefault ? 'Yes' : 'No'],
            ['Start time', viewing.startTime],
            ['End time', `${viewing.endTime}${viewing.endTime < viewing.startTime ? ' (next day)' : ''}`],
            ['Working days', (viewing.workingDays || []).join(', ') || 'None'],
            ['Break duration', `${viewing.breakDurationMins ?? 0} minutes`],
            ['Break starts', viewing.breakStartTime || 'Not set'],
            ['Break ends', viewing.breakEndTime || 'Not set'],
            ['Arrival grace', `${viewing.gracePeriodMins ?? 0} minutes`],
            ['Early-exit grace', `${viewing.earlyExitGraceMins ?? 0} minutes`],
            ['Half-day limit', Number(viewing.halfDayHours) ? `${viewing.halfDayHours} hours` : 'Disabled'],
            ['Short leave', viewing.shortLeaveEnabled ? 'Enabled' : 'Disabled'],
            ...(viewing.shortLeaveEnabled ? [
              ['Early in', viewing.earlyInEnabled ? viewing.earlyInTime || 'Not set' : 'Disabled'],
              ['Early out', viewing.earlyOutEnabled ? viewing.earlyOutTime || 'Not set' : 'Disabled'],
            ] : []),
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </TenantPanel>
    </Modal>}

    {showTemplateModal && (
      <Modal isOpen title="Choose your starting schedule" subtitle="Pick a template, then fine-tune the hours and attendance rules." size="lg" className="shift-template-picker" onClose={() => setShowTemplateModal(false)}>
        <div className="workspace-grid ws-template-grid">
          {templates.map(t => {
            const Icon = t.icon;
            const duration = (Number(t.endTime.slice(0, 2)) - Number(t.startTime.slice(0, 2)) + 24) % 24;
            return <TenantPanel key={t.key} title={t.name} subtitle={t.key === 'night' ? 'An overnight schedule' : t.key === 'day' ? 'The everyday workday' : 'A later start to the day'} icon={Icon} headingLevel={3}
              role="button" tabIndex={0} aria-label={'Use ' + t.name.toLowerCase() + ' template'}
              onClick={() => handleSelectTemplate(t)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleSelectTemplate(t);
                }
              }}
              className={'ws-template-card card--' + (t.key === 'night' ? 'purple' : t.key === 'day' ? 'amber' : 'blue')}>
              <div className="ws-template-card__body">
                <div className="ws-template-card__schedule"><span>SHIFT HOURS</span><strong>{t.startTime}<span aria-hidden="true">&ndash;</span>{t.endTime}</strong><small>{duration} hours &middot; {t.key === 'night' ? 'Ends next day' : 'Same day'}</small></div>
                <dl className="ws-template-card__details"><div><dt><Coffee size={14} aria-hidden="true" />Break</dt><dd>{t.breakDurationMins} min</dd></div><div><dt><CalendarDays size={14} aria-hidden="true" />Workweek</dt><dd>{t.workingDays.length} days</dd></div></dl>
                <p className="ws-template-card__days">{t.workingDays.length === 6 ? 'Monday to Saturday' : 'Monday to Friday'}</p>
              </div>
            </TenantPanel>;
          })}
        </div>
      </Modal>
    )}

    {/* Shift Create / Edit Form Modal */}
    {editing && (
      <Modal isOpen title={editing.id ? 'Edit shift' : 'Create shift'} subtitle="Build a schedule that works for your team." className="shift-editor" busy={saving} size="lg" onClose={() => !saving && setEditing(null)}
        footer={<><Button variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button><Button variant="colored" type="submit" form={shiftFormId} loading={saving} disabled={saving || !workingDays.length}>Save shift</Button></>}>
        <form id={shiftFormId} className="ws-form shift-editor-form" onSubmit={save}>
          <TenantPanel title="Schedule" subtitle="Set the hours and days your team works." icon={Clock} headingLevel={3} className="shift-editor-section">
          <div className="shift-editor-section__body">
          <div className="shift-editor-schedule"><label>Shift name<input name="name" defaultValue={editing.name} required maxLength={100} disabled={saving} /></label>
            <label>Start time<input type="time" name="startTime" defaultValue={editing.startTime} required disabled={saving} /></label>
            <label>End time<input type="time" name="endTime" defaultValue={editing.endTime} required disabled={saving} /></label>
          </div>
          <p className="ws-hint">Overnight shifts end on the following day.</p>
          <fieldset disabled={saving}>
            <legend>Working days</legend>
            <div className="ws-days">
              {days.map(d => (
                <label className="shift-day-toggle" key={d}>
                  <input type="checkbox" checked={workingDays.includes(d)} onChange={e => setWorkingDays(old => e.target.checked ? [...old,d] : old.filter(v => v!==d))} />
                  <span>{d}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="shift-editor-options">
            <label className="shift-rule-switch shift-setting"><span className="shift-setting__copy"><strong>Active shift</strong><small>Available for employee assignment</small></span><input type="checkbox" role="switch" aria-label="Active shift" name="status" defaultChecked={editing.status !== 'Inactive'} disabled={saving} /><span aria-hidden="true" /></label>
            <label className="shift-rule-switch shift-setting"><span className="shift-setting__copy"><strong>Company default</strong><small>Used when no shift is assigned</small></span><input type="checkbox" role="switch" aria-label="Default company schedule" name="isDefault" defaultChecked={editing.isDefault} disabled={saving} /><span aria-hidden="true" /></label>
          </div></div></TenantPanel>
          <TenantPanel title="Breaks & attendance" subtitle="Define break windows and attendance allowances." icon={Coffee} headingLevel={3} className="shift-editor-section">
          <div className="shift-editor-section__body">
          <div className="ws-form-grid">
            <label>Break duration (minutes)<input type="number" name="breakDurationMins" min="0" max="240" defaultValue={editing.breakDurationMins} required disabled={saving} /></label>
            <label>Arrival grace (minutes)<input type="number" name="gracePeriodMins" min="0" max="240" defaultValue={editing.gracePeriodMins ?? 0} required disabled={saving} /></label>
          </div>
          <div className="ws-form-grid shift-break-window">
            <label>Break starts<input type="time" name="breakStartTime" defaultValue={editing.breakStartTime || ''} disabled={saving} /></label>
            <label>Break ends<input type="time" name="breakEndTime" defaultValue={editing.breakEndTime || ''} disabled={saving} /></label>
          </div>

          <div className="ws-form-grid shift-editor-rules"><label>Early-exit grace (minutes)<input name="earlyExitGraceMins" type="number" min="0" max="240" defaultValue={editing.earlyExitGraceMins ?? 0} disabled={saving}/></label>
          <label>Half-day limit (hours)<input name="halfDayHours" type="number" min="0" max="12" step="0.25" defaultValue={editing.halfDayHours ?? 0} disabled={saving}/><small>Set to 0 to disable.</small></label></div>
          </div></TenantPanel>
          <TenantPanel title="Short leave" subtitle="Allow early arrivals or departures at specific times." icon={Clock3} headingLevel={3} className="shift-editor-section" controls={<label className="shift-rule-switch"><input type="checkbox" role="switch" aria-label="Enable short leave" checked={shortLeaveEnabled} disabled={saving} onChange={event => setShortLeaveEnabled(event.target.checked)} /><span aria-hidden="true" /></label>}>
          <div className="shift-editor-section__body">
            {shortLeaveEnabled && <div className="ws-form-grid">
              <div><div className="shift-rule-heading"><span>Early in</span><label className="shift-rule-switch"><input type="checkbox" role="switch" aria-label="Enable early in" checked={earlyInEnabled} disabled={saving} onChange={event => setEarlyInEnabled(event.target.checked)} /><span aria-hidden="true" /></label></div>{earlyInEnabled && <label>Early-in time<input name="earlyInTime" type="time" defaultValue={editing.earlyInTime || ''} required disabled={saving} /></label>}</div>
              <div><div className="shift-rule-heading"><span>Early out</span><label className="shift-rule-switch"><input type="checkbox" role="switch" aria-label="Enable early out" checked={earlyOutEnabled} disabled={saving} onChange={event => setEarlyOutEnabled(event.target.checked)} /><span aria-hidden="true" /></label></div>{earlyOutEnabled && <label>Early-out time<input name="earlyOutTime" type="time" defaultValue={editing.earlyOutTime || ''} required disabled={saving} /></label>}</div>
            </div>}
          {!shortLeaveEnabled && <p className="ws-hint">Turn on short leave to configure early-in and early-out times.</p>}
          </div></TenantPanel>

          {error && <p className="ws-error" role="alert">{error}</p>}
        </form>
      </Modal>
    )}
  </main>;
}
