import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveEmployeeDossier } from './EmployeesPage/LiveEmployeeDossier';
import { ArrowDownAZ, ArrowUpRight, Building2, Check, ChevronLeft, ChevronRight, Download, GitBranch, LayoutGrid, List, LoaderCircle, MapPin, Plus, RefreshCw, Search, Users, UserCheck, X, AlertCircle } from 'lucide-react';
import './EmployeesPage.css';
import { currentPresence } from './EmployeesPage/directoryData';

const nameOf = (person) => [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || person.userid || 'Unnamed employee';
const statusOf = (value) => value ? String(value).replace(/([a-z])([A-Z])/g, '$1 $2') : 'Not provided';
const uniqueValues = (people, field) => [...new Set(people.map(person => person[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

function DirectoryDialog({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={ref} className="people-dialog" aria-labelledby="people-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="people-dialog-head"><h2 id="people-dialog-title">{title}</h2><button className="people-icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
    {children}
  </dialog>;
}
function AddPerson({ api, onClose, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    Object.keys(values).forEach(key => { values[key] = values[key].trim(); });
    if (!values.userid || !values.first_name || !values.email) { setError('Employee ID, first name and email are required.'); return; }
    if (values.password && (values.password.length < 6 || values.password.length > 128)) {
      setError('Password must contain 6 to 128 characters.');
      return;
    }
    setSaving(true); setError('');
    try {
      await api.createUser({ ...values, password: values.password || 'Welcome@123' }, { liveOnly: true });
      onCreated();
    } catch (err) { setError(err.message || 'Unable to add employee. Please try again.'); }
    finally { setSaving(false); }
  }
  return <DirectoryDialog title="Add employee" onClose={() => { if (!saving) onClose(); }}>
    <form onSubmit={submit} className="people-form">
      <p>Create a record in your employee directory.</p>
      <div className="people-form-grid">
        {[
          ['userid', 'Employee ID', true], ['first_name', 'First name', true], ['last_name', 'Last name'], ['email', 'Work email', true, 'email'], ['password', 'Initial password', false, 'password'], ['phone_number', 'Phone number', false, 'tel'], ['designation', 'Job title'], ['department', 'Department'], ['work_location', 'Work location'], ['date_of_joining', 'Joining date', false, 'date']
        ].map(([key, label, required, type]) => <label key={key}>{label}{required ? ' *' : ''}<input name={key} type={type || 'text'} required={required} minLength={key === 'password' ? 6 : undefined} maxLength={key === 'password' ? 128 : undefined} placeholder={key === 'password' ? 'Min 6 characters (default: Welcome@123)' : undefined} autoComplete="off" disabled={saving} /></label>)}
        <label>Employment status<select name="status" defaultValue="" required disabled={saving}><option value="" disabled>Select status</option>{['Active', 'OnLeave', 'Probation', 'Inactive'].map(status => <option key={status} value={status}>{statusOf(status)}</option>)}</select></label>
        <label>Access role<select name="type" defaultValue="Employee" disabled={saving}>{['Employee', 'Department Manager', 'HR Admin', 'Super Admin'].map(role => <option key={role}>{role}</option>)}</select></label>
      </div>
      {error && <div role="alert" className="people-error">{error}</div>}
      <div className="people-dialog-footer"><button type="button" className="people-button" onClick={onClose} disabled={saving}>Cancel</button><button className="people-button people-button--primary" disabled={saving}>{saving ? <LoaderCircle size={16} className="people-spin" /> : <Plus size={16} />}{saving ? 'Saving…' : 'Add employee'}</button></div>
    </form>
  </DirectoryDialog>;
}

export function EmployeesPage({ api, onSelectEmployee, onShowToast, onNavigate }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('asc');
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [presence, setPresence] = useState({});
  const [presenceLoading, setPresenceLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let timer;
    const update = async () => {
      const next = {};
      let index = 0;
      await Promise.all(Array.from({ length: Math.min(6, employees.length) }, async () => {
        while (index < employees.length && !cancelled) {
          const person = employees[index++];
          try {
            const result = await api.getAttendance(person.userid, undefined, { liveOnly: true });
            next[person.userid] = currentPresence(result.data);
          } catch { next[person.userid] = 'Unavailable'; }
        }
      }));
      if (!cancelled) { setPresence(next); setPresenceLoading(false); timer = setTimeout(update, 60000); }
    };
    setPresence({}); setPresenceLoading(true); update();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [api, employees]);
  const presenceOf = person => presence[person.userid] || 'Checking...';
  const requestId = useRef(0);

  const loadUsers = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setError('');
    try {
      const result = await api.getAllUsers({ liveOnly: true });
      if (result?.success === false || !Array.isArray(result?.data)) throw new Error('The employee directory returned an invalid response.');
      if (id === requestId.current) setEmployees(result.data);
    } catch (err) {
      if (id === requestId.current) { setEmployees([]); setError(err.message || 'Unable to load employees.'); }
    } finally { if (id === requestId.current) setLoading(false); }
  }, [api]);
  useEffect(() => { loadUsers(); return () => { requestId.current += 1; }; }, [loadUsers]);

  useEffect(() => {
    const handleAvatarUpdate = (e) => {
      const { userid, profile_pic_url } = e.detail || {};
      if (userid && profile_pic_url) {
        setEmployees(prev => prev.map(p => (p.userid === userid || p.user_id === userid || p.employee_code === userid) ? { ...p, profile_pic_url } : p));
      }
    };
    window.addEventListener('pulse-avatar-updated', handleAvatarUpdate);
    window.addEventListener('pulse-users-updated', loadUsers);
    return () => {
      window.removeEventListener('pulse-avatar-updated', handleAvatarUpdate);
      window.removeEventListener('pulse-users-updated', loadUsers);
    };
  }, [loadUsers]);
  const departments = useMemo(() => uniqueValues(employees, 'department'), [employees]);
  const statuses = ['Active', 'Punched out', 'Not punched in', 'Unavailable'];
  const locations = useMemo(() => uniqueValues(employees, 'work_location'), [employees]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter(person => (!department || person.department === department) && (!status || presence[person.userid] === status) && [nameOf(person), person.userid, person.email, person.designation, person.department].some(value => String(value || '').toLowerCase().includes(query)))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)) * (sort === 'asc' ? 1 : -1));
  }, [employees, search, department, status, sort, presence]);
  const activePerson = filtered.find(person => person.userid === selected?.userid) || filtered[0] || null;
  const hasFilters = Boolean(search || department || status);
  function clearFilters() { setSearch(''); setDepartment(''); setStatus(''); }
  function exportDirectory() {
    const columns = ['userid', 'first_name', 'last_name', 'email', 'department', 'designation', 'work_location', 'status', 'attendance_today'];
    const escapeCell = value => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
    const csv = [columns, ...filtered.map(person => columns.map(key => key === 'attendance_today' ? presenceOf(person) : person[key]))].map(row => row.map(escapeCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'employees.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stats = [
    { label: 'Total employees', value: employees.length, icon: Users, caption: 'People in your directory' },
    { label: 'Punched in now', value: presenceLoading || Object.values(presence).includes('Unavailable') ? '-' : employees.filter(person => presence[person.userid] === 'Active').length, icon: UserCheck, caption: 'Today, without a punch-out' },
    { label: 'Departments', value: departments.length, icon: Building2, caption: 'Across your organization' },
    { label: 'Work locations', value: locations.length, icon: MapPin, caption: 'Recorded work locations' }
  ];
  return <div className="people-page">
    <header className="people-header">
      <div><div className="people-eyebrow">WORKSPACE / PEOPLE</div><h1>Employees<span className="people-title-dot">.</span></h1><p>A considered space for your people and their details.</p></div>
      <div className="people-header-actions"><button className="people-button" disabled={loading || !!error || !filtered.length} onClick={exportDirectory}><Download size={16} />Export CSV</button><button className="people-button people-button--primary" onClick={() => setAdding(true)}><Plus size={17} />Add employee</button></div>
    </header>
    <section className="people-stats" aria-label="Directory overview">{stats.map(({ label, value, icon: Icon, caption }) => <div className="people-stat" key={label}><div className="people-stat-label">{label}<Icon size={17} /></div><strong>{loading || error ? '—' : value.toLocaleString()}</strong><span>{caption}</span></div>)}</section>
    <div className="people-workspace">
    <section className="people-dossier-column" aria-label="Selected employee dossier">
      {loading ? <div className="people-empty">Loading employee dossier...</div> : activePerson ? <LiveEmployeeDossier key={activePerson.userid} person={activePerson} api={api} presence={presenceOf(activePerson)} onShowToast={onShowToast} /> : <div className="people-empty"><Users size={30} /><h3>No employee selected</h3><p>Select a person from the directory to view their dossier.</p></div>}
    </section>
    <EmployeeDirectory employees={filtered} totalCount={employees.length} selectedId={activePerson?.userid} onSelect={setSelected} getStatus={presenceOf} loading={loading} error={error} onRefresh={loadUsers}
      headerAction={onNavigate && <button className="people-text-button" onClick={() => onNavigate('hierarchy')}><GitBranch size={15} />Org chart</button>}
      toolbar={<><input aria-label="Search employees" placeholder="Search name, email or ID..." value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Filter department" value={department} onChange={event => setDepartment(event.target.value)}><option value="">All departments</option>{departments.map(item => <option key={item}>{item}</option>)}</select><select aria-label="Filter attendance" value={status} onChange={event => setStatus(event.target.value)}><option value="">All attendance</option>{statuses.map(item => <option key={item}>{item}</option>)}</select><button onClick={() => setSort(sort === 'asc' ? 'desc' : 'asc')}>{sort === 'asc' ? 'A-Z' : 'Z-A'}</button>{hasFilters && <button onClick={clearFilters}>Clear filters</button>}</>} />
    </div>
    <div className="people-footnote"><Check size={13} />Directory totals reflect the employee records available from your connected service.</div>
    {adding && <AddPerson api={api} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); clearFilters(); loadUsers(); onShowToast?.({ type: 'success', title: 'Employee added', message: 'The employee record was saved successfully.' }); }} />}
  </div>;
}
