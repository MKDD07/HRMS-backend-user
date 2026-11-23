import { ProfileLogs } from './ProfileLogs';
import { AccountDetailsSkeleton } from './AccountDetailsSkeleton';
import { ProfileTabToolbar } from './ProfileTabToolbar';
import { ProfileAttendance } from './ProfileAttendance';
import { ProfileContactIcons } from './ProfileContactIcons';
import { departmentTheme } from '../../../lib/departmentTheme';
import './DossierTheme.scss';
import { DossierAccounts } from './DossierAccounts';
import { PAYMENT_METHODS, validatePaymentDetails } from '../../../../shared/paymentDetails.mjs';
import { Card } from '../../../components/ui/Card';
import { TenantPanelHeader } from '../../../components/ui/TenantPanel';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ProfileContentSkeleton } from './EmployeeProfileSkeleton';
import { DossierLeaveEntitlements } from './DossierLeaveEntitlements';
import { ViewTabs } from '../../../components/ui/ViewTabs';
import { DossierOverview, DossierKpis, DossierGoals, DossierDocuments, DossierRules } from './DossierEditors';
import { useAvatarImage } from '../../../lib/avatarImage';
import React, { useEffect, useRef, useState } from 'react';
import { UserRound, CalendarDays, CalendarCheck, Wallet, ChartNoAxesCombined, Target, Files, ShieldCheck, History, Plus, Mail, Phone, MapPin, Camera, Pencil, CheckCheck, BadgeCheck } from 'lucide-react';
import { displayFields, profileImage } from './directoryData';
import { ImageCropperModal } from '../../../components/ui/ImageCropperModal';
import { Button } from '../../../components/ui/Button';

const currentMonth = () => { const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date()); return parts.find(p => p.type === 'year').value + '-' + parts.find(p => p.type === 'month').value; };
const tabs = [
  ['overview', 'Overview', UserRound], ['attendance', 'Attendance', CalendarDays], ['leave', 'Leave', CalendarCheck],
  ['salary', 'Accounts & Payments', Wallet], ['kpi', 'KPI', ChartNoAxesCombined], ['goals', 'Goals', Target],
  ['documents', 'Documents', Files], ['rules', 'Rules', ShieldCheck], ['logs', 'Logs', History]
];
const label = value => String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, character => character.toUpperCase());
const value = item => item == null || item === '' ? 'Not provided' : String(item);
const belongsTo = (record, userid) => !record?.userid && !record?.user_id || String(record.userid || record.user_id) === String(userid);
function Fields({ data }) {
  if (data == null || data === '') return <span className="dossier-muted">Not provided</span>;
  if (Array.isArray(data)) return data.length ? <div className="dossier-records">{data.map((record, index) => <Fields key={index} data={record} />)}</div> : <span className="dossier-muted">No records</span>;
  if (typeof data === 'string' && /^https?:\/\//i.test(data)) return <a href={data} target="_blank" rel="noopener noreferrer" className="dossier-resource-link">Open linked resource</a>;
  if (typeof data !== 'object') return <span>{typeof data === 'boolean' ? (data ? 'Yes' : 'No') : String(data)}</span>;
  return <dl className="dossier-fields">{displayFields(data).map(([key, item]) => <div key={key}><dt>{label(key)}</dt><dd><Fields data={item} /></dd></div>)}</dl>;
}
function RecordList({ records, title }) {
  if (!records.length) return <div className="card overview-card dossier-empty dossier-empty-card">No {title.toLowerCase()} records returned for this employee.</div>;
  return <div className="dossier-records">{records.map((record, index) => <details className="dossier-record" key={record.id || index}><summary>{record.title || record.name || record.date || record.attdate || `${title} record ${index + 1}`}<span>View details</span></summary><Fields data={record} /></details>)}</div>;
}
function SalaryForm({ person, api, onSaved, onCancel }) {
  const [method, setMethod] = useState(PAYMENT_METHODS.includes(person.preferred_payment_method) ? person.preferred_payment_method : 'Bank transfer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const amount = Number(form.amount_paid);
    if (!Number.isFinite(amount) || amount < 0) { setError('Enter a valid non-negative amount.'); return; }
    setSaving(true); setError('');
    try {
      await api.addSalary({ user_id: person.userid, employee_name: [person.first_name, person.last_name].filter(Boolean).join(' '), month: form.month, year: form.year, pay_date: form.pay_date, amount_paid: amount, transaction_ref: form.reference, payment: validatePaymentDetails({method,...form}) }, { liveOnly: true });
      onSaved();
    } catch (err) { setError(err.message || 'Salary entry was not saved.'); }
    finally { setSaving(false); }
  }
  const personName = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || 'this employee';
  const todayParts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = key => todayParts.find(item => item.type === key).value;
  return <Card className="tenant-panel dossier-salary-card">
    <TenantPanelHeader title="Add salary payment" subtitle={`Record a completed payment for ${personName}.`} icon={Wallet}/>
    <form className="dossier-inline-form dossier-salary-form" onSubmit={submit}>
      <fieldset disabled={saving}>
        <div className="dossier-form-grid">
          <label>Payroll month<select name="month" required defaultValue={new Date(2026, Number(part('month')) - 1, 1).toLocaleString('en', { month: 'long' })}>{Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleString('en', { month: 'long' })).map(month => <option key={month}>{month}</option>)}</select></label>
          <label>Payroll year<input name="year" type="number" min="1900" max="2200" required defaultValue={part('year')}/></label>
          <label>Payment date<input name="pay_date" type="date" required defaultValue={`${part('year')}-${part('month')}-${part('day')}`}/></label>
          <label>Amount paid<input name="amount_paid" type="number" min="0" step="0.01" required placeholder="0.00"/></label>
          <label>Payment method<select value={method} onChange={event => setMethod(event.target.value)}>{PAYMENT_METHODS.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>{method === 'Cash' ? 'Receipt number' : method === 'Cheque' ? 'Cheque number' : method === 'UPI' ? 'UPI transaction ID' : 'UTR / transaction reference'}<input key={method} name="reference" required maxLength={200} placeholder="Enter reference"/></label>
          {method === 'Cash' && <label>Received by<input name="received_by" required maxLength={200} defaultValue={personName}/></label>}
          {method === 'UPI' && <label>UPI ID<input name="upi_id" defaultValue={person.upi_id || ''} maxLength={200}/></label>}
          {method === 'Cheque' && <><label>Cheque bank<input name="bank_name" required maxLength={200} defaultValue={person.bank_name || ''}/></label><label>Cheque date<input name="cheque_date" type="date" required/></label></>}
        </div>
        {error && <p role="alert" className="people-error">{error}</p>}
        <div className="dossier-salary-footer"><Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button><Button type="submit" size="sm" variant="colored" icon={CheckCheck} wrapContent={false} loading={saving}>Save payment</Button></div>
      </fieldset>
    </form>
  </Card>;
}
export function LiveEmployeeDossier({ person, api, presence = 'Unknown', onShowToast, onUpdated }) {
  const [editing,setEditing]=useState(false);
  const [inlineBusy,setInlineBusy]=useState(false);
  const [tab, setTab] = useState('overview');
  const [leaveView, setLeaveView] = useState('available');
  useEffect(() => { setLeaveView('available'); setDecision(null); }, [person?.userid]);
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState({});
  const [errors, setErrors] = useState({});
  const [fetchLoading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState(null);
  const [revision, setRevision] = useState(0);
  const [month, setMonth] = useState(currentMonth);
  const [addingSalary, setAddingSalary] = useState(false);
  const [accountView, setAccountView] = useState('accounts');
  const [decision, setDecision] = useState(null);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [failedImage, setFailedImage] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const targetId = person?.userid || person?.user_id || person?.employee_code || person?.employee_id;
  const loading = fetchLoading || loadedId !== targetId;
  const activeTarget = useRef(targetId);
  activeTarget.current = targetId;
  useEffect(() => { setEditing(false); setAddingSalary(false); setSaveError(''); setFailedImage(''); }, [targetId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErrors({});
    const requests = [
      ['profile', () => api.getEmployeeDossier(targetId)],
      ['attendance', () => api.getAttendance(targetId, undefined, { liveOnly: true })],
      ['leave', () => api.getLeaves(targetId, { liveOnly: true })],
      ['salary', () => api.getSalaries(targetId, { liveOnly: true })]
    ];
    Promise.allSettled(requests.map(([, fetcher]) => fetcher())).then(results => {
      if (cancelled) return;
      const next = {}; const failures = {};
      results.forEach((result, index) => {
        const key = requests[index][0];
        if (result.status === 'rejected') failures[key] = result.reason?.message || `Unable to load ${key}.`;
        else if (key === 'profile') setProfile(result.value);
        else next[key] = result.value.data.filter(record => belongsTo(record, targetId));
      });
      if (failures.profile) setProfile(null);
      setRecords(next); setErrors(failures); setLoadedId(targetId); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [api, targetId, revision]);
  const [customAvatar, setCustomAvatar] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState('');
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setCustomAvatar(null);
    setRawImageSrc('');
    setIsCropperOpen(false);
  }, [targetId]);

  const currentProfile = loadedId === targetId ? profile : null;
  const employee = { ...person, ...(currentProfile?.data?.[0] || (currentProfile?.data && typeof currentProfile.data === 'object' ? currentProfile.data : null) || {}) };
  const name = [employee.first_name, employee.last_name].filter(Boolean).join(' ') || employee.name || employee.userid;
  const image = useAvatarImage((loadedId === targetId ? customAvatar : null) || profileImage(employee));
  const sourceRecords = records[tab] || [];
  const filteredRecords = month ? sourceRecords.filter(record => String(record.date || record.attdate || record.start_date || record.startdate || record.pay_date || '').startsWith(month)) : sourceRecords;
  const refresh = () => setRevision(value => value + 1);
  const saved = title => { if (!mounted.current) return; setAddingSalary(false); setDecision(null); refresh(); onShowToast?.({ type: 'success', title, message: `Saved for ${targetId}.` }); };

  async function saveInline(changes) {
    setInlineBusy(true);
    try {
      await api.updateUser(targetId,{...changes,dossier_revision:employee.dossier_revision});
      const result=await api.getEmployeeDossier(targetId);
      if (activeTarget.current !== targetId) return;
      setProfile(result);setEditing(false);onUpdated?.(result.data[0]);
      onShowToast?.({type:'success',title:'Changes saved'});
    } finally {setInlineBusy(false);}
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      const idToUpdate = employee.userid || person.userid || person.user_id;
      await api.updateUser(idToUpdate, { profile_finalized:true, dossier_revision:employee.dossier_revision });
      onShowToast?.({
        type: 'success',
        title: 'Profile finalized',
        message: `Employee record for ${name} has been verified and finalized.`
      });
      refresh();
    } catch (err) {
      onShowToast?.({
        type: 'error',
        title: 'Finalize failed',
        message: err.message || 'Unable to finalize employee record.'
      });
    } finally {
      if (mounted.current) setFinalizing(false);
    }
  }

  const handleAvatarClick = () => {
    if (!uploadingAvatar) fileInputRef.current?.click();
  };

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      onShowToast?.({ type: 'error', title: 'Invalid format', message: 'Please select a PNG, JPEG or WebP image.' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      onShowToast?.({ type: 'error', title: 'Image too large', message: 'Maximum allowed image size is 8 MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setIsCropperOpen(true);
    };
    reader.onerror = () => {
      onShowToast?.({ type: 'error', title: 'Read error', message: 'Unable to read the selected image file.' });
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
  }

  async function handleCropComplete(croppedDataUrl) {
    setUploadingAvatar(true);
    try {

      setFailedImage('');

      const uploaded = await api.uploadAvatar(targetId,croppedDataUrl);
      if (activeTarget.current !== targetId) return;
      setCustomAvatar(uploaded.profile_pic_url);
      setProfile(previous => previous ? {
        ...previous,
        data: Array.isArray(previous.data)
          ? previous.data.map(record => ({ ...record, profile_pic_url: uploaded.profile_pic_url }))
          : { ...previous.data, profile_pic_url: uploaded.profile_pic_url }
      } : previous);
      onUpdated?.({ ...employee, userid: targetId, profile_pic_url: uploaded.profile_pic_url });
      onShowToast?.({
        type: 'success',
        title: 'Profile image updated',
        message: `Profile photo saved for ${name}.`
      });
      setIsCropperOpen(false);
    } catch (err) {
      onShowToast?.({
        type: 'error',
        title: 'Upload failed',
        message: err.message || 'Unable to save profile photo.'
      });
    } finally {
      if (mounted.current) setUploadingAvatar(false);
    }
  }

  async function submitDecision(event) {
    event.preventDefault();
    const remarks = new FormData(event.currentTarget).get('remarks');
    setSaving(true); setSaveError('');
    try {
      const currentUser = api.getCurrentUser?.();
      if (!currentUser?.userid) throw new Error('Sign in again to identify the approver.');
      await api.reviewLeave({ leave_id: decision.record.leave_id || decision.record.id, status: decision.status, approver_userid: currentUser.userid, remarks }, { liveOnly: true });
      saved('Leave decision saved');
    } catch (err) { if (mounted.current) setSaveError(err.message); }
    finally { if (mounted.current) setSaving(false); }
  }
  return <div className="card overview-card live-dossier dossier-workspace" style={departmentTheme(employee.department || 'General')} aria-label={`Dossier for ${name}`}>
    <header className="dossier-header"><div className="dossier-identity"><div className={`dossier-avatar-wrap ${uploadingAvatar ? 'is-uploading' : ''}`} onClick={handleAvatarClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAvatarClick(); } }} title="Upload profile photo" aria-label="Upload profile photo"><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} disabled={uploadingAvatar} />{uploadingAvatar ? <span className="dossier-initials dossier-avatar-loading" role="status" aria-label="Uploading profile photo"><Skeleton className="dossier-avatar-skeleton"/></span> : image && failedImage !== image ? <img src={image} alt={name} onError={() => setFailedImage(image)} /> : <span className="dossier-initials">{name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</span>}<span className="dossier-avatar-badge" title="Upload new photo"><Camera size={11} /></span><span className={`dossier-status-dot ${presence === 'Active' ? 'dossier-status-dot--active' : ['Not punched in', 'Punched out'].includes(presence) ? 'dossier-status-dot--inactive' : 'dossier-status-dot--unknown'}`} title={`Status: ${presence}`} aria-label={`Status: ${presence}`} /></div><div className="dossier-identity-copy"><h2>{name}{employee.profile_finalized && <span className="dossier-verified" title="Profile verified" role="img" aria-label="Profile verified"><BadgeCheck size={20} aria-hidden="true" /></span>}</h2><p>{value(employee.designation)} &middot; {value(employee.department)}</p><div className="dossier-identity-meta"><div className="dossier-identity-tags"><span>{employee.employee_code || targetId}</span>{!employee.profile_finalized && <span>Profile needs review</span>}</div><ProfileContactIcons employee={employee} /></div></div></div><div className="dossier-header-actions"><Button variant="outline" size="sm" iconOnly icon={Pencil} aria-label="Edit employee profile" disabled={loading || inlineBusy || editing || Boolean(errors.profile)} onClick={() => {
  setTab('overview');
  setEditing(true);
}} title="Edit employee profile" /><Button variant="colored" size="sm" icon={CheckCheck} onClick={handleFinalize} loading={finalizing} disabled={finalizing || loading || editing || inlineBusy || Boolean(errors.profile) || employee.profile_finalized} title="Verify and finalize employee profile">{employee.profile_finalized ? 'Finalized' : 'Finalize'}</Button></div></header>
    <div className="dossier-navigation"><ViewTabs variant="slider" label="Employee dossier sections" value={tab} disabled={saving || editing || inlineBusy} onChange={id => { setTab(id); setMonth(currentMonth()); setDecision(null); setAddingSalary(false); setSaveError(''); }} tabs={tabs.map(([id, label, icon]) => ({ id, label, icon }))}/></div>
    <div className="dossier-content" aria-busy={loading}>
      <ProfileTabToolbar tab={tab} leaveView={leaveView} accountView={accountView} onLeaveView={next => { setLeaveView(next); setDecision(null); }} onAccountView={next => { setAccountView(next); setAddingSalary(false); }} month={month} onMonth={setMonth} disabled={loading || saving || editing || inlineBusy} />
      <div className={`dossier-tab-body dossier-tab-body--${tab}`} key={tab}>{loading && tab !== 'overview' ? (tab === 'salary' ? <AccountDetailsSkeleton history={accountView === 'history'} /> : <ProfileContentSkeleton />) : tab !== 'overview' && errors[(['kpi', 'goals', 'documents', 'rules', 'logs'].includes(tab) || (tab === 'leave' && leaveView === 'available') || (tab === 'salary' && accountView === 'accounts')) ? 'profile' : tab] ? <div className="people-error" role="alert">{errors[(['kpi', 'goals', 'documents', 'rules', 'logs'].includes(tab) || (tab === 'leave' && leaveView === 'available')) ? 'profile' : tab]}<Button className="people-button" onClick={refresh} variant="outline" type="submit" wrapContent={false}>Retry</Button></div> : <>
        {tab === 'overview' && <>
          {errors.profile && !loading && <div className="people-error" role="alert" style={{ marginBottom: '1rem' }}>{errors.profile}<Button className="people-button" onClick={refresh} variant="outline" type="submit" wrapContent={false}>Retry</Button></div>}
          {(!errors.profile || loading) && <DossierOverview employee={employee} loading={loading} editing={editing && !loading} onSave={saveInline} onCancel={()=>setEditing(false)}/>}
        </>}
        {tab === 'attendance' && <ProfileAttendance records={filteredRecords} renderDetails={record => <Fields data={record} />} />}
        {tab === 'leave' && <>{leaveView === 'available' ? <DossierLeaveEntitlements employee={employee}/> : <>{decision && <form className="people-form dossier-edit" onSubmit={submitDecision}><h3>{decision.status === 'Approved' ? 'Approve' : 'Reject'} leave request</h3><p>{value(decision.record.start_date || decision.record.startdate)} / {value(decision.record.end_date || decision.record.enddate)}</p><label>Decision remarks<input name="remarks" required disabled={saving} /></label>{saveError && <p role="alert" className="people-error">{saveError}</p>}<div className="people-dialog-footer"><Button type="button" className="people-button" onClick={() => setDecision(null)} disabled={saving} variant="outline" wrapContent={false}>Cancel</Button><Button className="people-button people-button--primary" disabled={saving} variant="colored" type="submit" wrapContent={false}>{saving ? 'Saving...' : 'Save decision'}</Button></div></form>}{filteredRecords.length ? filteredRecords.map((record, index) => <article className="dossier-record" key={record.id || index}><div className="dossier-leave-heading"><h4>{record.leave_type || 'Leave request'}</h4><span className="metric-cardus">{value(record.status)}</span></div><Fields data={record} />{String(record.status).toLowerCase() === 'pending' && (record.id || record.leave_id) && <div className="dossier-actions">{['Approved', 'Rejected'].map(status => <Button key={status} disabled={saving} className="people-button" onClick={() => {
  setDecision({
    record,
    status
  });
  setSaveError('');
}} variant="outline" type="submit" wrapContent={false}>{status === 'Approved' ? 'Approve' : 'Reject'}</Button>)}</div>}</article>) : <div className="card overview-card dossier-empty dossier-empty-card">No leave records for this selection.</div>}</>}</>}
        {tab === 'salary' && <>{accountView === 'accounts' ? <DossierAccounts employee={employee} onSave={saveInline}/> : <>{addingSalary && <SalaryForm person={employee} api={api} onSaved={() => saved('Salary record saved')} onCancel={() => setAddingSalary(false)} />}<RecordList records={filteredRecords} title="Payment" />{!addingSalary && <div className="dossier-add-action"><Button size="sm" variant="colored" iconOnly icon={<Plus size={22} aria-hidden="true" />} aria-label="Add salary payment record" title="Add salary payment record" onClick={() => setAddingSalary(true)} /></div>}</>}</>}
        {tab==='kpi'&&<DossierKpis employee={employee} onSave={saveInline}/>}
        {tab==='goals'&&<DossierGoals employee={employee}/>}
        {tab==='documents'&&<DossierDocuments employee={employee}/>}
        {tab==='rules'&&<DossierRules employee={employee} onSave={saveInline}/>}
        {tab==='logs' && <ProfileLogs records={employee.dossier_audit || []} />}
      </>}</div>
    </div>
    <ImageCropperModal
      isOpen={isCropperOpen}
      imageSrc={rawImageSrc}
      onClose={() => setIsCropperOpen(false)}
      onCrop={handleCropComplete}
      isUploading={uploadingAvatar}
      title={`Adjust & Crop Photo for ${name}`}
    />
  </div>;
}
