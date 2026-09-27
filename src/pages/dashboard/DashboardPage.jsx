import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, Users, UserCheck, CalendarDays, Clock3, RefreshCw, Building2, ArrowRight, AlertCircle, CheckCircle2, FileText, Wallet, GitBranch } from 'lucide-react';
import { attendanceDay, currentPresence } from '../employees/EmployeesPage/directoryData';
import { attendanceSeries, departmentCounts, normalizeLeaves } from './dashboardData';
import './DashboardPage.css';

const nameOf = person => [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.name || person?.userid || 'Employee';
function Empty({ children }) { return <div className="tenant-empty">{children}</div>; }
function Panel({ title, subtitle, action, children, className = '' }) { return <section className={`tenant-panel ${className}`}><div className="tenant-panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>; }

export function DashboardPage({ currentUser, onNavigate, api, onShowToast }) {
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const [days, setDays] = useState(7);
  const [department, setDepartment] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true);
    const issues = {};
    const [usersResult, leavesResult] = await Promise.allSettled([api.getAllUsers({ liveOnly: true }), api.getLeaves(undefined, { liveOnly: true })]);
    if (id !== sequence.current) return;
    const people = usersResult.status === 'fulfilled' ? usersResult.value.data : [];
    if (usersResult.status === 'rejected') issues.employees = 'Employee directory is unavailable.';
    if (leavesResult.status === 'rejected') issues.leaves = 'Leave records are unavailable.';
    const records = {};
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(6, people.length) }, async () => {
      while (index < people.length && id === sequence.current) {
        const person = people[index++];
        try { records[person.userid] = (await api.getAttendance(person.userid, undefined, { liveOnly: true })).data; }
        catch { records[person.userid] = null; }
      }
    }));
    if (id !== sequence.current) return;
    const failed = Object.values(records).filter(value => value === null).length;
    if (failed) issues.attendance = `Attendance could not be loaded for ${failed} employee${failed === 1 ? '' : 's'}.`;
    setEmployees(people); setLeaves(leavesResult.status === 'fulfilled' ? normalizeLeaves(leavesResult.value.data) : []);
    setAttendance(records); setErrors(issues); setUpdated(new Date()); setLoading(false);
  }, [api]);
  useEffect(() => { refresh(); return () => { sequence.current += 1; }; }, [refresh]);
  const today = attendanceDay(updated || new Date());
  const people = useMemo(() => employees.filter(person => !department || person.department === department), [employees, department]);
  const scopedIds = new Set(people.map(person => person.userid));
  const scopedLeaves = leaves.filter(leave => !department || scopedIds.has(leave.userid));
  const scopedAttendance = Object.fromEntries(people.map(person => [person.userid, attendance[person.userid]]));
  const attendanceUnavailable = Boolean(errors.employees || people.some(person => !Array.isArray(attendance[person.userid])));
  const leaveUnavailable = Boolean(errors.leaves || (department && errors.employees));
  const chart = attendanceSeries(scopedAttendance, today, days);
  const hasPunches = chart.some(day => day.employees > 0);
  const active = people.filter(person => currentPresence(attendance[person.userid] || [], updated || new Date()) === 'Active').length;
  const onLeave = new Set(scopedLeaves.filter(leave => leave.state === 'approved' && leave.start && leave.end && leave.start <= today && leave.end >= today).map(leave => leave.userid).filter(Boolean)).size;
  const pending = scopedLeaves.filter(leave => leave.state === 'pending');
  const upcoming = scopedLeaves.filter(leave => leave.state === 'approved' && leave.start && leave.end >= today).sort((a, b) => a.start.localeCompare(b.start));
  const departments = departmentCounts(people);
  const missing = people.filter(person => !person.email || !person.department || !person.designation);
  const stats = [
    { title: 'Total employees', value: errors.employees ? null : people.length, note: 'In the employee directory', icon: Users, page: 'employees' },
    { title: 'Punched in now', value: attendanceUnavailable ? null : active, note: 'Today, without a punch-out', icon: UserCheck, page: 'attendance' },
    { title: 'On leave today', value: leaveUnavailable ? null : onLeave, note: 'Approved leave covering today', icon: CalendarDays, page: 'leave' },
    { title: 'Pending leave requests', value: leaveUnavailable ? null : pending.length, note: 'Awaiting a decision', icon: Clock3, page: 'leave' }
  ];
  const link = (page, label = 'View all') => <button className="tenant-link" onClick={() => onNavigate?.(page)}>{label}<ArrowUpRight size={14} /></button>;
  const personFor = record => employees.find(person => person.userid === record.userid);
  return <main id="tenant-admin-dashboard" className="tenant-dashboard">
    <header className="tenant-header"><div><span className="tenant-eyebrow">WORKSPACE / OVERVIEW</span><h1>Tenant Admin Console<span>.</span></h1><p>{currentUser?.first_name ? `Welcome back, ${currentUser.first_name}. ` : ''}Your people, attendance and priorities in one place.</p></div><button className="tenant-button" disabled={loading} onClick={refresh}><RefreshCw size={15} className={loading ? 'tenant-spin' : ''} />{loading ? 'Refreshing...' : 'Refresh data'}</button></header>
    <div className="tenant-context"><span>{new Date(`${today}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}<small>India time</small></span><label>Department<select aria-label="Filter dashboard by department" value={department} onChange={event => setDepartment(event.target.value)}><option value="">All departments</option>{[...new Set(employees.map(person => person.department).filter(Boolean))].sort().map(value => <option key={value}>{value}</option>)}</select></label></div>
    {!loading && Object.keys(errors).length > 0 && <div role="alert" className="tenant-warning"><AlertCircle size={18} /><span>{Object.values(errors).join(' ')} Unavailable metrics are shown as a dash.</span><button onClick={refresh}>Retry</button></div>}
    <section className="tenant-stats" aria-label="Workforce overview" aria-busy={loading}>{stats.map(({ title, value, note, icon: Icon, page }) => <button key={title} className="tenant-stat" onClick={() => onNavigate?.(page)}><div>{title}<Icon size={17} /></div><strong>{loading || value == null ? '-' : value.toLocaleString()}</strong><p>{note}<ArrowUpRight size={13} /></p></button>)}</section>
    <div className="tenant-main-grid">
      <Panel title="Attendance activity" subtitle="Unique employees with a recorded punch-in each day" className="tenant-trend" action={<div className="tenant-range" aria-label="Attendance date range">{[7, 30].map(value => <button key={value} aria-pressed={days === value} onClick={() => setDays(value)}>{value} days</button>)}</div>}>
        {loading ? <Empty>Loading attendance records...</Empty> : attendanceUnavailable ? <Empty>Attendance is incomplete. Retry to load the full trend.</Empty> : !hasPunches ? <Empty>No recorded punch-ins in the last {days} days.</Empty> : <><div className="tenant-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 15, right: 15, bottom: 10, left: -18 }} accessibilityLayer><defs><linearGradient id="tenantAttendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#53755b" stopOpacity={0.22} /><stop offset="100%" stopColor="#53755b" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0e9" strokeDasharray="3 4" /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={25} tick={{ fontSize: 10, fill: '#8a9386' }} /><YAxis allowDecimals={false} domain={[0, Math.max(1, ...chart.map(day => day.employees))]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#8a9386' }} /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload.date} contentStyle={{ borderRadius: 10, border: '1px solid #e5eae0', fontSize: 12 }} /><Area name="Employees punched in" dataKey="employees" type="monotoneX" stroke="#527357" strokeWidth={2.5} fill="url(#tenantAttendanceFill)" isAnimationActive={false} dot={days === 7 ? { r: 3, fill: '#527357' } : false} /></AreaChart></ResponsiveContainer></div><details className="tenant-data-table"><summary>View chart data</summary><table><thead><tr><th>Date</th><th>Employees punched in</th></tr></thead><tbody>{chart.map(row => <tr key={row.date}><td>{row.date}</td><td>{row.employees}</td></tr>)}</tbody></table></details></>}
        <div className="tenant-panel-footer"><span>Recorded punches only; missing punches do not imply absence.</span>{link('attendance', 'Attendance')}</div>
      </Panel>
      <Panel title="Needs your attention" subtitle="Open leave requests" action={link('leave')}>
        {loading ? <Empty>Loading requests...</Empty> : leaveUnavailable ? <Empty>Leave requests are unavailable.</Empty> : !pending.length ? <Empty><CheckCircle2 size={25} />No pending leave requests.</Empty> : <div className="tenant-request-list">{pending.slice(0, 4).map((leave, index) => <div className="tenant-request" key={leave.id || leave.leave_id || index}><div><strong>{personFor(leave) ? nameOf(personFor(leave)) : leave.employee_name || leave.name || leave.userid || 'Employee not provided'}</strong><span className="tenant-pill">Pending</span></div><p>{leave.leave_type || 'Leave request'}</p><small>{leave.start || 'Date not provided'} / {leave.end || 'Date not provided'}</small><button className="tenant-link" onClick={() => onNavigate?.('leave')}>Review request<ArrowRight size={14} /></button></div>)}</div>}
      </Panel>
      <Panel title="Team distribution" subtitle="Employees by department" action={link('employees', 'Directory')}>
        {loading ? <Empty>Loading departments...</Empty> : errors.employees ? <Empty>Employee data is unavailable.</Empty> : !departments.length ? <Empty>No employees in this selection.</Empty> : <div className="tenant-departments">{departments.map(item => <div key={item.name}><div><span>{item.name}</span><strong>{item.count}<small>{Math.round(item.count / people.length * 100)}%</small></strong></div><div className="tenant-track"><span style={{ width: `${item.count / people.length * 100}%` }} /></div></div>)}</div>}
      </Panel>
      <Panel title="Leave schedule" subtitle="Approved leave, current and upcoming" action={link('leave')}>
        {loading ? <Empty>Loading leave schedule...</Empty> : leaveUnavailable ? <Empty>Leave schedule is unavailable.</Empty> : !upcoming.length ? <Empty>No current or upcoming approved leave.</Empty> : <div className="tenant-leave-list">{upcoming.slice(0, 5).map((leave, index) => <div key={leave.id || index}><span className="tenant-calendar-icon"><CalendarDays size={18} /></span><div><strong>{personFor(leave) ? nameOf(personFor(leave)) : leave.employee_name || leave.name || leave.userid || 'Employee not provided'}</strong><p>{leave.start} / {leave.end}</p></div><span className="tenant-pill">{leave.start <= today ? 'On leave' : 'Upcoming'}</span></div>)}</div>}
      </Panel>
    </div>
    <section className="tenant-bottom"><div className="tenant-quality"><span className="tenant-quality-icon"><Building2 size={22} /></span><div><h2>Keep your directory complete</h2><p>{loading ? 'Checking employee records...' : errors.employees ? 'Employee records could not be checked.' : `${missing.length} employee${missing.length === 1 ? '' : 's'} missing an email, department or job title.`}</p></div>{link('employees', 'Review directory')}</div><div className="tenant-shortcuts">{[[GitBranch, 'Organization', 'hierarchy'], [Wallet, 'Payroll', 'payroll'], [FileText, 'Documents', 'documents']].map(([Icon, label, page]) => <button key={page} onClick={() => onNavigate?.(page)}><Icon size={16} />{label}<ArrowUpRight size={13} /></button>)}</div></section>
    <footer className="tenant-freshness" role="status">{loading ? 'Fetching the latest records...' : updated ? `Last refresh attempt: ${updated.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' })} IST${Object.keys(errors).length ? ' - some sources unavailable' : ' - records loaded'}.` : 'Not refreshed yet.'} Use Refresh data for the latest punches and requests.</footer>
  </main>;
}
export default DashboardPage;
