import React, { useEffect, useRef, useState } from 'react';
import { Users, ShieldCheck, KeyRound } from 'lucide-react';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { Button } from '../../components/ui/Button';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { TenantHeader } from '../../components/ui/TenantHeader';

import { PermissionPicker } from '../../components/ui/PermissionPicker';
import { Toggle } from '../../components/ui/Toggle';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { billingApi } from '../../lib/billingApi';
import { DASHBOARD_PAGES } from '../../../shared/dashboardAccess.mjs';
import { dashboardAdminApi } from '../../lib/dashboardAdminApi';
import '../dashboard/DashboardPage.scss';
import './WorkspaceSettings.scss';
import './DashboardUsersPage.scss';

const ACCESS_PAGE_GROUPS = [
  { id: 'people', label: 'People', keys: ['dashboard', 'employees', 'hierarchy', 'departments'] },
  { id: 'time', label: 'Time & attendance', keys: ['attendance', 'geofence-rules', 'shifts', 'leave', 'company-calendar'] },
  { id: 'pay', label: 'Pay & benefits', keys: ['payroll', 'salary-structure', 'expenses', 'benefits'] },
  { id: 'talent', label: 'Talent', keys: ['recruitment', 'performance', 'appraisals', 'onboarding', 'offboarding', 'learning'] },
  { id: 'workplace', label: 'Workplace', keys: ['assets', 'timesheets', 'documents', 'helpdesk', 'surveys'] },
  { id: 'insights', label: 'Insights & settings', keys: ['hr-analytics', 'reports', 'settings'] },
];

export function DashboardUsersPage() {
  const [capacity, setCapacity] = useState(null);
  const [planPages,setPlanPages]=useState(null);
  const [users, setUsers] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [selected, setSelected] = useState(null), [pages, setPages] = useState([]), [saving, setSaving] = useState(false), [enabled, setEnabled] = useState(false), [notice, setNotice] = useState('');
  const editor = useRef(null);
  async function load() {
    setLoading(true); setError('');
    try {
      const [employees, billing] = await Promise.allSettled([dashboardAdminApi.users(), billingApi.overview()]);
      if (employees.status === 'fulfilled') {
        setUsers(employees.value.map(user => ({ ...user, userid: user.user_id || user.userid })));
      } else { throw employees.reason; }
      if (billing.status === 'fulfilled') {const policy=billing.value.policy;setPlanPages(policy?.pages || null);setCapacity(policy?.testEnabled ? {employee_limit:policy.employeeLimit,dashboard_limit:policy.dashboardLimit,expired:false} : billing.value.capacity);}
      else { setCapacity(null); setError(billing.reason?.message || 'Plan capacity is unavailable.'); }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (selected) editor.current?.focus({ preventScroll: true }); }, [selected]);
  const count = users.filter(user => user.dashboard_access).length;
  function blockedReason(user) {
    if(user.plan_locked || user.dashboard_plan_locked)return 'Outside current plan capacity.';
    if (user.dashboard_access) return '';
    if (user.status !== 'active') return 'Only active employees can receive dashboard access.';
    if (!capacity) return 'Plan capacity is unavailable. Refresh to try again.';
    if (capacity.expired) return 'Renew your company plan to grant access.';
    if (count >= capacity.dashboard_limit) return 'Dashboard user limit reached. Review Plan & Subscription.';
    return '';
  }
  function edit(user, { grant = false } = {}) {
    if (saving) return;
    setError(''); setNotice(''); setSelected(user);
    setPages((user.dashboard_pages || []).filter(page=>!planPages || planPages.includes(page))); setEnabled(Boolean(user.dashboard_access) || (grant && !blockedReason(user)));
  }
  async function save(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!formElement.checkValidity()) {
      requestAnimationFrame(() => { const invalid = formElement.querySelector(':invalid'); invalid?.focus(); invalid?.reportValidity(); });
      return;
    }
    setSaving(true); setError('');
    try {
      const form = Object.fromEntries(new FormData(event.currentTarget));
      await dashboardAdminApi.saveUser({ ...form, employee_id: selected.employee_id, dashboard_access: enabled, dashboard_pages: pages });
      setSelected(null);
      setNotice('Access saved. Existing sessions were signed out; a temporary password requires a password change at next sign-in.');
      await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return <main className="tenant-dashboard workspace-settings dashboard-users">
    <TenantHeader settings={{ subheading: 'WORKSPACE / SUPER ADMIN', heading: 'Dashboard users', paragraph: 'Choose an employee and give them access to the pages they need.', refresh: true }} actions={{ refresh: { onClick: load, loading: loading || saving, disabled: saving } }} />
    <MetricOverview loading={loading}>{[[Users, 'Dashboard users', capacity ? `${count} / ${capacity.dashboard_limit}` : `${count} users`, 'Existing Super Admin excluded'], [ShieldCheck, 'Permission model', 'By page', 'Selected pages include their management actions'], [KeyRound, 'First login', 'Required', 'Temporary passwords must be changed']].map(([Icon, label, value, note]) => <MetricCard key={label} loading={label === 'Dashboard users' && loading} label={label} icon={Icon} value={value} caption={note} />)}</MetricOverview>
    {notice && <p className="ws-notice" role="status">{notice}</p>}
    {error && !selected && <p className="ws-error" role="alert">{error}</p>}
    <div className="workspace-grid dashboard-users-grid">
      <div className="dashboard-users-content">
      {selected ? <section key={selected.employee_id} className="dashboard-access-editor" ref={editor} tabIndex={-1} aria-label={`Dashboard access for ${selected.first_name}`}>
        <TenantPanel icon={ShieldCheck} title={`${selected.first_name} ${selected.last_name || ''}`} subtitle={`${selected.employee_code || ''} / ${selected.username}`} controls={
          <div className="dashboard-access-switch">
            <strong id="dashboard-access-label">Dashboard access</strong>
            <Toggle checked={enabled} onChange={setEnabled} disabled={saving || Boolean(blockedReason(selected))} aria-labelledby="dashboard-access-label" />
          </div>
        }>
          <form className="ws-form dashboard-access-form" onSubmit={save} noValidate>
            <div className="dashboard-access-body">
            {blockedReason(selected) && <p className="ws-hint" role="status">{blockedReason(selected)}</p>}
            <section className="dashboard-access-section" aria-labelledby="dashboard-credentials-title">
              <h3 id="dashboard-credentials-title"><KeyRound size={16} aria-hidden="true" />Login credentials</h3>
              <div className="ws-form-grid">
                <label>Login ID<input name="username" defaultValue={selected.username} required minLength={3} maxLength={100} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,99}" disabled={saving} autoComplete="off" /></label>
                <label>{selected.dashboard_access ? 'New temporary password' : 'Temporary password'}<input name="password" type="password" autoComplete="new-password" required={enabled && !selected.dashboard_access} minLength={6} maxLength={128} disabled={saving || !enabled} placeholder={selected.dashboard_access ? 'Leave blank to keep the current password' : 'At least 6 characters'} aria-describedby="dashboard-password-hint" /></label>
              </div>
              <p className="ws-hint" id="dashboard-password-hint">A temporary password must be changed at the next sign-in. These credentials also apply to employee sign-in.</p>
            </section>
            <div className="dashboard-access-section">
              <PermissionPicker groups={ACCESS_PAGE_GROUPS} options={DASHBOARD_PAGES.filter(([id])=>!planPages || planPages.includes(id))} value={pages} onChange={setPages} disabled={saving || !enabled} description={enabled ? 'Choose only the pages this employee needs. Each page includes its management actions.' : 'Enable dashboard access to change page permissions.'} />
              <p className="ws-hint">User management and legacy payslip-template management are reserved for the Super Admin.</p>
            </div>
            {enabled && !pages.length && <p className="ws-hint" role="status">Select at least one page to save access.</p>}
            {error && <p className="ws-error" role="alert">{error}</p>}
            </div>
            <div className="ws-actions dashboard-access-footer"><span className="ws-hint">Changes apply when you save.</span><Button type="button" disabled={saving} onClick={() => setSelected(null)} variant="outline">Cancel</Button><Button disabled={saving || (enabled && (!pages.length || Boolean(blockedReason(selected))))} variant="colored" type="submit">{saving ? 'Saving...' : 'Save access'}</Button></div>
          </form>
        </TenantPanel>
      </section> : <TenantPanel className="dashboard-access-placeholder" title="Employee dashboard access" subtitle="Manage access without leaving the directory."><div><ShieldCheck size={36} strokeWidth={1.3} /><h3>Select an employee</h3><p>Choose someone from the Employee Directory to grant or manage their dashboard access.</p></div></TenantPanel>}
      </div>
      <EmployeeDirectory
        employees={users}
        loading={loading}
        selectedId={selected?.userid}
        onSelect={edit}
        onRefresh={saving ? undefined : load}
        subtitle="Manage employee access."
        actionsPlacement="inline"
        renderMeta={user => <span className={`dashboard-access-status ${user.dashboard_access ? 'is-enabled' : 'is-disabled'}`}>{user.dashboard_access ? 'Access enabled' : 'Not enabled'}</span>}
        renderActions={user => <Button className={`dashboard-access-action ${user.dashboard_access ? 'is-enabled' : 'is-pending'}`} type="button" variant="fadeout" size="sm" iconOnly icon={user.dashboard_access ? ShieldCheck : KeyRound} disabled={saving} title={blockedReason(user) || (user.dashboard_access ? 'Manage access' : 'Grant access')} aria-label={`${user.dashboard_access ? 'Manage' : 'Grant'} dashboard access for ${user.first_name} ${user.last_name || ''}`} onClick={() => edit(user, { grant: !user.dashboard_access })} />}
      />
    </div>
  </main>;
}

