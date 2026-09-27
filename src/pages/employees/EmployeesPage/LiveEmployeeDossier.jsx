import { useAvatarImage } from '../../../lib/avatarImage';
import React, { useEffect, useRef, useState } from 'react';
import { UserRound, CalendarDays, CalendarCheck, Wallet, ChartNoAxesCombined, Target, Files, ShieldCheck, History, RefreshCw, LoaderCircle, Plus, X, Mail, Phone, MapPin, Camera } from 'lucide-react';
import { displayFields, profileImage } from './directoryData';
import { ImageCropperModal } from '../../../components/ui/ImageCropperModal';

const tabs = [
  ['overview', 'Overview', UserRound], ['attendance', 'Attendance', CalendarDays], ['leave', 'Leave', CalendarCheck],
  ['salary', 'Salary', Wallet], ['kpi', 'KPI', ChartNoAxesCombined], ['goals', 'Goals', Target],
  ['documents', 'Documents', Files], ['rules', 'Rules', ShieldCheck], ['logs', 'Logs', History]
];
const label = value => String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, character => character.toUpperCase());
const value = item => item == null || item === '' ? 'Not provided' : String(item);
const belongsTo = (record, userid) => !record?.userid && !record?.user_id || String(record.userid || record.user_id) === String(userid);
const sectionKeys = {
  kpi: ['kpi', 'kpis', 'kpiDetails', 'performance', 'performanceDetails'], goals: ['goals', 'goalDetails'],
  documents: ['documents', 'employeeDocuments', 'documentDetails'], rules: ['rules', 'employeeRules', 'geofenceRules'], logs: ['logs', 'auditLogs', 'activityLogs']
};
function Fields({ data }) {
  if (data == null || data === '') return <span className="dossier-muted">Not provided</span>;
  if (Array.isArray(data)) return data.length ? <div className="dossier-records">{data.map((record, index) => <Fields key={index} data={record} />)}</div> : <span className="dossier-muted">No records</span>;
  if (typeof data === 'string' && /^https?:\/\//i.test(data)) return <a href={data} target="_blank" rel="noopener noreferrer" className="dossier-resource-link">Open linked resource</a>;
  if (typeof data !== 'object') return <span>{typeof data === 'boolean' ? (data ? 'Yes' : 'No') : String(data)}</span>;
  return <dl className="dossier-fields">{displayFields(data).map(([key, item]) => <div key={key}><dt>{label(key)}</dt><dd><Fields data={item} /></dd></div>)}</dl>;
}
function RecordList({ records, title }) {
  if (!records.length) return <div className="dossier-empty">No {title.toLowerCase()} records returned for this employee.</div>;
  return <div className="dossier-records">{records.map((record, index) => <details className="dossier-record" key={record.id || index}><summary>{record.title || record.name || record.date || record.attdate || `${title} record ${index + 1}`}<span>View details</span></summary><Fields data={record} /></details>)}</div>;
}
function SalaryForm({ person, api, onSaved, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const amount = Number(form.amount_paid);
    if (!Number.isFinite(amount) || amount < 0) { setError('Enter a valid non-negative amount.'); return; }
    setSaving(true); setError('');
    try {
      await api.addSalary({ user_id: person.userid, employee_name: [person.first_name, person.last_name].filter(Boolean).join(' '), month: form.month, year: form.year, pay_date: form.pay_date, amount_paid: amount, transaction_ref: form.transaction_ref }, { liveOnly: true });
      onSaved();
    } catch (err) { setError(err.message || 'Salary entry was not saved.'); }
    finally { setSaving(false); }
  }
  return <form className="people-form dossier-edit" onSubmit={submit}><h3>Add salary payment record</h3><p>Record a completed payment for {person.userid}. This does not transfer money.</p><div className="people-form-grid"><label>Month<select name="month" required disabled={saving} defaultValue=""><option value="" disabled>Select month</option>{Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleString('en', { month: 'long' })).map(month => <option key={month}>{month}</option>)}</select></label><label>Year<input name="year" type="number" min="1900" max="2200" required disabled={saving} /></label><label>Payment date<input name="pay_date" type="date" required disabled={saving} /></label><label>Amount paid<input name="amount_paid" type="number" min="0" step="0.01" required disabled={saving} /></label><label>Transaction reference<input name="transaction_ref" required disabled={saving} /></label></div>{error && <p role="alert" className="people-error">{error}</p>}<div className="people-dialog-footer"><button type="button" className="people-button" onClick={onCancel} disabled={saving}>Cancel</button><button className="people-button people-button--primary" disabled={saving}>{saving ? 'Saving...' : 'Save payment record'}</button></div></form>;
}
export function LiveEmployeeDossier({ person, api, presence, onShowToast }) {
  const [tab, setTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [month, setMonth] = useState('');
  const [addingSalary, setAddingSalary] = useState(false);
  const [decision, setDecision] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [failedImage, setFailedImage] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErrors({});
    const requests = [
      ['profile', () => api.getUser(person.userid, { liveOnly: true })],
      ['attendance', () => api.getAttendance(person.userid, undefined, { liveOnly: true })],
      ['leave', () => api.getLeaves(person.userid, { liveOnly: true })],
      ['salary', () => api.getSalaries(person.userid, { liveOnly: true })]
    ];
    Promise.allSettled(requests.map(([, fetcher]) => fetcher())).then(results => {
      if (cancelled) return;
      const next = {}; const failures = {};
      results.forEach((result, index) => {
        const key = requests[index][0];
        if (result.status === 'rejected') failures[key] = result.reason?.message || `Unable to load ${key}.`;
        else if (key === 'profile') setProfile(result.value);
        else next[key] = result.value.data.filter(record => belongsTo(record, person.userid));
      });
      if (failures.profile) setProfile(null);
      setRecords(next); setErrors(failures); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [api, person.userid, revision]);
  const [customAvatar, setCustomAvatar] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState('');
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setCustomAvatar(null);
    setRawImageSrc('');
    setIsCropperOpen(false);
  }, [person.userid]);

  const employee = { ...person, ...profile?.data?.[0] };
  const name = [employee.first_name, employee.last_name].filter(Boolean).join(' ') || employee.name || employee.userid;
  const image = useAvatarImage(customAvatar || profileImage(employee));
  const sourceRecords = records[tab] || [];
  const filteredRecords = month ? sourceRecords.filter(record => String(record.date || record.attdate || record.start_date || record.startdate || record.pay_date || '').startsWith(month)) : sourceRecords;
  const sectionData = (sectionKeys[tab] || []).flatMap(key => {
    const data = profile?.[key] ?? employee[key];
    return data == null ? [] : Array.isArray(data) ? data : [data];
  }).filter(record => belongsTo(record, person.userid));
  const refresh = () => setRevision(value => value + 1);
  const saved = title => { if (!mounted.current) return; setAddingSalary(false); setDecision(null); refresh(); onShowToast?.({ type: 'success', title, message: `Saved for ${person.userid}.` }); };

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
      setCustomAvatar(croppedDataUrl);
      setFailedImage('');

      if (api.uploadAvatar) {
        await api.uploadAvatar(person.userid, croppedDataUrl);
      } else {
        await api.updateUser(person.userid, { profile_pic_url: croppedDataUrl });
      }

      onShowToast?.({
        type: 'success',
        title: 'Profile image updated',
        message: `Cropped and saved to Cloudflare R2 storage for ${name}.`
      });
      setIsCropperOpen(false);
      refresh();
    } catch (err) {
      onShowToast?.({
        type: 'error',
        title: 'Upload failed',
        message: err.message || 'Unable to save cropped image to R2 storage.'
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
  return <div className="live-dossier" aria-label={`Dossier for ${name}`}>
    <header className="dossier-header"><div className="dossier-identity"><div className={`dossier-avatar-wrap ${uploadingAvatar ? 'is-uploading' : ''}`} onClick={handleAvatarClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAvatarClick(); } }} title="Click to upload profile photo to Cloudflare R2" aria-label="Click to upload profile photo to Cloudflare R2"><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} disabled={uploadingAvatar} />{uploadingAvatar ? <span className="dossier-initials dossier-avatar-loading"><LoaderCircle className="people-spin" size={24} /></span> : image && failedImage !== image ? <img src={image} alt={name} onError={() => setFailedImage(image)} /> : <span className="dossier-initials">{name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</span>}<span className="dossier-avatar-badge" title="Upload new photo to R2"><Camera size={11} /></span><span className={`dossier-status-dot ${presence === 'Active' ? 'dossier-status-dot--active' : 'dossier-status-dot--inactive'}`} title={`Status: ${presence}`} aria-label={`Status: ${presence}`} /></div><div><span className="dossier-eyebrow">EMPLOYEE DOSSIER</span><h2>{name}</h2><p>{value(employee.designation)} / {value(employee.department)}</p><div className="dossier-id"><span>{employee.userid}</span></div></div></div><button className="people-icon-button" aria-label="Refresh employee dossier" onClick={refresh} disabled={loading || saving || uploadingAvatar}><RefreshCw size={17} className={loading ? 'people-spin' : ''} /></button></header>
    <div className="dossier-contact">
      {employee.email ? (
        <a href={`mailto:${employee.email}`} className="dossier-contact-link dossier-contact-link--mail" title={`Email: ${employee.email}`} aria-label={`Email ${employee.email}`}>
          <Mail size={15} />
        </a>
      ) : (
        <span className="dossier-contact-link dossier-contact-link--mail dossier-contact-link--disabled" title="No email provided" aria-label="No email provided">
          <Mail size={15} />
        </span>
      )}
      {(employee.phone_number || employee.phone) ? (
        <a href={`tel:${employee.phone_number || employee.phone}`} className="dossier-contact-link dossier-contact-link--call" title={`Call: ${employee.phone_number || employee.phone}`} aria-label={`Call ${employee.phone_number || employee.phone}`}>
          <Phone size={15} />
        </a>
      ) : (
        <span className="dossier-contact-link dossier-contact-link--call dossier-contact-link--disabled" title="No phone provided" aria-label="No phone provided">
          <Phone size={15} />
        </span>
      )}
      <span><MapPin size={14} />{value(employee.work_location)}</span>
    </div>
    <nav className="dossier-tabs" aria-label="Employee dossier sections">{tabs.map(([id, title, Icon]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setMonth(''); setDecision(null); setAddingSalary(false); setSaveError(''); }} disabled={saving}><Icon size={15} />{title}</button>)}</nav>
    <div className="dossier-content" aria-busy={loading}>
      <div className="dossier-section-title"><div><h3>{tabs.find(item => item[0] === tab)[1]}</h3></div>{['attendance', 'leave', 'salary'].includes(tab) && <label className="dossier-month">Filter month<input aria-label="Filter records by month" type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>}</div>
      {loading ? <div role="status" className="dossier-empty"><LoaderCircle className="people-spin" size={24} />Loading employee records...</div> : errors[['overview', 'kpi', 'goals', 'documents', 'rules', 'logs'].includes(tab) ? 'profile' : tab] ? <div className="people-error" role="alert">{errors[['overview', 'kpi', 'goals', 'documents', 'rules', 'logs'].includes(tab) ? 'profile' : tab]}<button className="people-button" onClick={refresh}>Retry</button></div> : <>
        {tab === 'overview' && <><p className="dossier-note">Profile details from the connected service. Profile editing is not connected to a live save endpoint.</p><Fields data={employee} />{displayFields(profile || {}).filter(([key, item]) => key !== 'data' && item && typeof item === 'object' && !Object.values(sectionKeys).flat().includes(key)).map(([key, item]) => <section className="dossier-subsection" key={key}><h3>{label(key)}</h3><Fields data={item} /></section>)}</>}
        {tab === 'attendance' && <><p className="dossier-note">Recorded punch history. Missing punches are not marked absent. Attendance corrections are not connected to a live save endpoint.</p>{filteredRecords.length ? <div className="dossier-table"><table><thead><tr><th>Date</th><th>Punch in</th><th>Punch out</th><th>Hours</th><th>Details</th></tr></thead><tbody>{filteredRecords.map((record, index) => <tr key={record.id || index}><td>{value(record.date || record.attdate)}</td><td>{value(record.check_in_time || record.intime)}</td><td>{value(record.check_out_time || record.outtime)}</td><td>{value(record.total_hours || record.totalhours)}</td><td><details><summary>View</summary><Fields data={record} /></details></td></tr>)}</tbody></table></div> : <div className="dossier-empty">No attendance records for this selection.</div>}</>}
        {tab === 'leave' && <>{decision && <form className="people-form dossier-edit" onSubmit={submitDecision}><h3>{decision.status === 'Approved' ? 'Approve' : 'Reject'} leave request</h3><p>{value(decision.record.start_date || decision.record.startdate)} / {value(decision.record.end_date || decision.record.enddate)}</p><label>Decision remarks<input name="remarks" required disabled={saving} /></label>{saveError && <p role="alert" className="people-error">{saveError}</p>}<div className="people-dialog-footer"><button type="button" className="people-button" onClick={() => setDecision(null)} disabled={saving}>Cancel</button><button className="people-button people-button--primary" disabled={saving}>{saving ? 'Saving...' : 'Save decision'}</button></div></form>}{filteredRecords.length ? filteredRecords.map((record, index) => <article className="dossier-record" key={record.id || index}><div className="dossier-leave-heading"><h4>{record.leave_type || 'Leave request'}</h4><span className="people-status">{value(record.status)}</span></div><Fields data={record} />{String(record.status).toLowerCase() === 'pending' && (record.id || record.leave_id) && <div className="dossier-actions">{['Approved', 'Rejected'].map(status => <button key={status} disabled={saving} className="people-button" onClick={() => { setDecision({ record, status }); setSaveError(''); }}>{status === 'Approved' ? 'Approve' : 'Reject'}</button>)}</div>}</article>) : <div className="dossier-empty">No leave records for this selection.</div>}</>}
        {tab === 'salary' && <>{addingSalary ? <SalaryForm person={employee} api={api} onSaved={() => saved('Salary record saved')} onCancel={() => setAddingSalary(false)} /> : <button className="people-button" onClick={() => setAddingSalary(true)}><Plus size={15} />Add payment record</button>}<RecordList records={filteredRecords} title="Salary" /></>}
        {sectionKeys[tab] && <><p className="dossier-note">{tab === 'logs' ? 'Audit events returned by the employee service. No activity is generated locally.' : `Only ${tab} returned for this employee are shown. Editing is not connected to a live save endpoint.`}</p><RecordList records={sectionData} title={tabs.find(item => item[0] === tab)[1]} /></>}
      </>}
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
