import { WorkflowInbox } from '../../components/hierarchy/WorkflowInbox';
import { MockLocationIcon } from './MockLocationIcon';
import { MonthlyAttendanceDetails, CompleteLogDetails } from './AttendanceDetails';
import { IndividualAttendanceMatrix } from './IndividualAttendanceMatrix';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
﻿import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UniversalCalendar, DayButton } from '../../components/ui/UniversalCalendar';
import { CalendarDays, Table2, List, RefreshCw, Download, Search, ChevronLeft, ChevronRight, Clock3, Users, Fingerprint, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { attendanceDay, currentPresence, displayFields } from '../employees/EmployeesPage/directoryData';
import { ATTENDANCE_CODES, dateKey, recordDate, hasPunch, monthDates, dayLedger, formatMinutes, csvText } from './attendanceLedger';
import './AttendancePage.scss';

const CalendarData = createContext({});
function LedgerDay(props) {
  const summaries = useContext(CalendarData);
  const summary = summaries[dateKey(props.day.date)];
  return <DayButton {...props} className={`${props.className || ''} attendance-day-${summary?.code || 'NR'}`}><span>{props.day.date.getDate()} <MockLocationIcon records={summary?.records || []} /></span>{summary && !props.modifiers.outside && <small className={`attendance-calendar-label code-${summary.code}`}>{summary.text}</small>}</DayButton>;
}
const nameOf = person => [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || person.userid;
const shown = value => value == null || value === '' ? 'Not recorded' : String(value);
function RawFields({ record }) {
  return <dl className="attendance-details">{displayFields(record).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{value && typeof value === 'object' ? JSON.stringify(value) : shown(value)}</dd></div>)}</dl>;
}
export function AttendancePage({ currentUser, api, todaysAttendance, onPunchAttendance, onShowToast }) {
  const today = attendanceDay();
  const todayDate = new Date(`${today}T12:00:00`);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [month, setMonth] = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState('individual');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [leaves, setLeaves] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [logPage, setLogPage] = useState(1);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true); setErrors({});
    const failures = {};
    const [peopleResult, leaveResult] = await Promise.allSettled([api.getAllUsers({ liveOnly: true }), api.getLeaves(undefined, { liveOnly: true })]);
    if (id !== generation.current) return;
    const people = peopleResult.status === 'fulfilled' ? peopleResult.value.data : [];
    if (peopleResult.status === 'rejected') failures.people = 'Employee directory could not be loaded.';
    if (leaveResult.status === 'rejected') failures.leaves = 'Leave data is unavailable; leave markers may be incomplete.';
    const records = {}; let next = 0;
    await Promise.all(Array.from({ length: Math.min(6, people.length) }, async () => {
      while (next < people.length && id === generation.current) {
        const person = people[next++];
        try {
          const result = await api.getAttendance(person.userid, undefined, { liveOnly: true });
          records[person.userid] = result.data.filter(record => !(record.userid || record.user_id) || String(record.userid || record.user_id) === String(person.userid));
        } catch { records[person.userid] = null; }
      }
    }));
    if (id !== generation.current) return;
    const failed = Object.values(records).filter(value => value === null).length;
    if (failed) failures.attendance = `Attendance unavailable for ${failed} employee${failed === 1 ? '' : 's'}. Their cells show ?.`;
    setEmployees(people); setAttendance(records); setLeaves(leaveResult.status === 'fulfilled' ? leaveResult.value.data : []); setErrors(failures); setUpdated(new Date()); setLoading(false);
  }, [api]);
  useEffect(() => { load(); return () => { generation.current += 1; }; }, [load]);
  const departments = [...new Set(employees.map(person => person.department).filter(Boolean))].sort();
  const filteredPeople = useMemo(() => employees.filter(person => (!department || person.department === department) && [nameOf(person), person.userid, person.email].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))), [employees, department, search]);
  const activeId = view === 'matrix' ? '' : filteredPeople.some(person => person.userid === employeeId) ? employeeId : filteredPeople[0]?.userid || '';
  const people = view === 'matrix' ? employees : activeId ? filteredPeople.filter(person => person.userid === activeId) : filteredPeople;
  const historyYears = [...employees.map(person => person.date_of_joining || person.joining_date), ...Object.values(attendance).flatMap(records => (records || []).map(record => recordDate(record)))].map(date => Number(String(date || '').slice(0,4))).filter(year => year >= 1900 && year <= todayDate.getFullYear());
  const firstYear = Math.min(todayDate.getFullYear(), ...historyYears);
  const years = Array.from({length: Math.max(todayDate.getFullYear(), month.getFullYear()) - Math.min(firstYear, month.getFullYear()) + 1}, (_, i) => Math.min(firstYear, month.getFullYear()) + i);
  const dates = useMemo(() => monthDates(month), [month]);
  const ledger = useMemo(() => Object.fromEntries(people.map(person => [person.userid, Object.fromEntries(dates.map(day => [day, dayLedger(attendance[person.userid] ?? null, leaves, person.userid, day, today, person.date_of_joining || person.joining_date || '')]))])), [people, dates, attendance, leaves, today]);
  const logs = people.flatMap(person => (attendance[person.userid] || []).filter(record => dates.includes(recordDate(record))).map(record => ({ ...record, employee: person }))).sort((a, b) => recordDate(b).localeCompare(recordDate(a)));
  const missing = people.some(person => attendance[person.userid] === null);
  const selectedLogs = logs.filter(record => recordDate(record) === selectedDate);
  const selectedLeaves = people.flatMap(person => (ledger[person.userid]?.[selectedDate]?.leaves || []).map(leave => ({ ...leave, employee: person })));
  const recordedDays = people.reduce((count, person) => count + dates.filter(day => ledger[person.userid][day].records.some(record => hasPunch(record.check_in_time || record.intime))).length, 0);
  const minutes = people.flatMap(person => dates.map(day => ledger[person.userid][day].minutes)).filter(value => value !== null);
  const summary = Object.fromEntries(dates.map(day => {
    const cells = people.map(person => ledger[person.userid][day]);
    if (people.length === 1) return [day, { records: cells[0].records, code: cells[0].code, text: cells[0].code === 'NR' ? 'No record' : cells[0].label }];
    const count = cells.filter(cell => cell.records.some(record => hasPunch(record.check_in_time || record.intime))).length;
    return [day, { records: cells.flatMap(cell=>cell.records), code: missing ? '?' : count ? 'P' : 'NR', text: missing ? 'Partial data' : count ? `${count} punched in` : day > today ? 'Upcoming' : 'No punches' }];
  }));
  function changeMonth(date) { const next = new Date(date.getFullYear(), date.getMonth(), 1); setMonth(next); setSelectedDate(dateKey(next)); setLogPage(1); }
  function openCell(person, day) { setEmployeeId(person.userid); setSelectedDate(day); setView('calendar'); setLogPage(1); }
  function exportLedger() {
    const rows = [['Employee ID', 'Employee', 'Date', 'Recorded status', 'Punch in', 'Punch out', 'Reported hours', 'Leave data available']];
    people.forEach(person => dates.forEach(day => {
      const cell = ledger[person.userid][day];
      if (cell.records.length) cell.records.forEach(record => rows.push([person.userid, nameOf(person), day, record.status || record.attstatus || cell.label, record.check_in_time || record.intime || '', record.check_out_time || record.outtime || '', record.total_hours ?? record.totalhours ?? '', errors.leaves ? 'No' : 'Yes']));
      else rows.push([person.userid, nameOf(person), day, cell.label, '', '', '', errors.leaves ? 'No' : 'Yes']);
    }));
    const url = URL.createObjectURL(new Blob(['\uFEFF', csvText(rows)], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `attendance-ledger-${dateKey(month).slice(0, 7)}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const logPages = Math.max(1, Math.ceil(logs.length / 25));
  const safeLogPage = Math.min(logPage, logPages);
  return <main className="attendance-console">
    <header className="attendance-header">
      <div>
        <span className="attendance-eyebrow">WORKSPACE / ATTENDANCE</span>
        <h1>Attendance &amp; Logs Console<span>.</span></h1>
        <p>A calendar and ledger for every recorded working day.</p>
      </div>
      <div className="attendance-actions">
        <Button
          variant={showWorkflow ? "colored" : "outline"}
          size="md"
          aria-expanded={showWorkflow}
          onClick={() => setShowWorkflow(value => !value)}
        >
          Correction requests
        </Button>
        <Button
          variant={view === 'matrix' ? 'colored' : 'outline'}
          size="md"
          icon={Table2}
          onClick={() => { setView('matrix'); setLogPage(1); }}
          aria-pressed={view === 'matrix'}
        >
          Monthly Attendance Matrix
        </Button>
        <Button
          variant="fadeout"
          size="md"
          iconOnly
          icon={RefreshCw}
          loading={loading}
          onClick={load}
          aria-label="Refresh attendance"
        />
      </div>
    </header>
    {showWorkflow && <section className="hm-page hm-main"><WorkflowInbox currentUser={currentUser} people={employees} initialKind="attendance" /></section>}
    <section className="attendance-controls"><div className="attendance-month-nav"><select aria-label="Attendance year" value={month.getFullYear()} onChange={event => changeMonth(new Date(Number(event.target.value), month.getMonth(), 1))}>{years.map(year => <option key={year} value={year}>{year}</option>)}</select><button aria-label="Previous month" onClick={() => changeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={17} /></button><input type="month" aria-label="Attendance month" value={dateKey(month).slice(0, 7)} onChange={event => { if (event.target.value) changeMonth(new Date(`${event.target.value}-01T12:00:00`)); }} /><button aria-label="Next month" onClick={() => changeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={17} /></button><button onClick={() => { setMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)); setSelectedDate(today); }}>Today</button></div><div className="attendance-view-tabs">{[['individual', Table2, 'Individual matrix'], ['calendar', CalendarDays, 'Day ledger'], ['logs', List, 'Logs']].map(([id, Icon, title]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}><Icon size={15} />{title}</button>)}</div><button className="attendance-button" onClick={exportLedger} disabled={loading || !!errors.people || !people.length}><Download size={15} />Export ledger</button></section>

    {!loading && Object.keys(errors).length > 0 && <div className="attendance-warning" role="alert"><AlertCircle size={18} /><span>{Object.values(errors).join(' ')}</span><button onClick={load}>Retry</button></div>}
    <div className="attendance-summary-heading"><h2>Monthly overview</h2><span>{month.toLocaleDateString('en-GB',{month:'long',year:'numeric'})} / {people.length === 1 ? nameOf(people[0]) : 'All employees'}</span></div>
    <section className="attendance-stats" aria-label="Monthly summary">{[[Users, 'Employees', people.length, 'employees'], [Fingerprint, 'Days with punches', missing ? '-' : recordedDays, 'days'], [Clock3, 'Reported hours', missing || !minutes.length ? '-' : formatMinutes(minutes.reduce((sum, value) => sum + value, 0)), 'hours'], [List, 'Punch records', missing ? '-' : logs.length, 'records']].map(([Icon, title, count, key]) => <button className="attendance-stat-button" key={key} aria-expanded={selectedMetric===key} aria-controls="attendance-month-details" onClick={()=>setSelectedMetric(selectedMetric===key?null:key)}><span>{title}<Icon size={16} /></span><strong>{loading || errors.people ? '-' : count}</strong><small>View monthly details</small></button>)}</section>
    {selectedMetric && <MonthlyAttendanceDetails metric={selectedMetric} people={people} dates={dates} ledger={ledger} logs={logs} monthLabel={month.toLocaleDateString('en-GB',{month:'long',year:'numeric'})} onClose={()=>setSelectedMetric(null)} onOpenDay={(person,day)=>{openCell(person,day);setSelectedMetric(null);}} loading={loading} error={errors.people} missing={missing} />}
    <div className={`attendance-person-workspace ${view === 'matrix' ? 'attendance-all-matrix' : ''}`}><div className="attendance-person-content">
    {loading ? <div className="attendance-empty" role="status"><RefreshCw className="attendance-spin" size={24} />Loading live attendance records...</div> : errors.people ? <div className="attendance-empty">The employee directory is unavailable. Use Retry to load the ledger.</div> : !people.length ? <div className="attendance-empty">No employees match this selection.</div> : <>
    {view === 'individual' && people[0] && <IndividualAttendanceMatrix person={people[0]} records={attendance[people[0].userid]} leaves={leaves} year={month.getFullYear()} today={today} onOpenDay={(person, day) => { setMonth(new Date(`${day.slice(0,7)}-01T12:00:00`)); openCell(person, day); }} leaveUnavailable={!!errors.leaves} />}
    {view === 'calendar' && <div className="attendance-calendar-layout"><section className="attendance-panel"><div className="attendance-panel-heading"><h2>{people.length === 1 ? nameOf(people[0]) : 'Team attendance'}</h2><span>{month.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</span></div><CalendarData.Provider value={summary}><UniversalCalendar size="lg" mode="single" required month={month} onMonthChange={changeMonth} selected={new Date(`${selectedDate}T12:00:00`)} onSelect={date => { if (date) setSelectedDate(dateKey(date)); }} weekStartsOn={1} hideNavigation showOutsideDays={false} components={{ DayButton: LedgerDay }} /></CalendarData.Provider><div className="attendance-legend"><span className="code-P">P: Punch recorded</span><span className="code-L">L: Recorded late</span><span className="code-A">A: Recorded absent</span><span className="code-LV">LV: Approved leave</span><span className="code-HD">HD: Half day</span><span>NR: No record</span><span>?: Unavailable</span></div></section><section className="attendance-panel attendance-day-detail" aria-live="polite"><div className="attendance-panel-heading"><div><h2>{people.length === 1 ? `${nameOf(people[0])} / Day ledger` : 'Day ledger'}</h2><p>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><span>{selectedLogs.length} records</span></div>{missing && <p className="attendance-note">Some employees' attendance is unavailable.</p>}{!selectedLogs.length && !selectedLeaves.length ? <div className="attendance-empty">{selectedDate > today ? 'No records for this upcoming date.' : 'No punch or approved leave records for this date.'}</div> : <div className="attendance-day-records">{selectedLogs.map((record, index) => <article key={`${record.employee.userid}-${record.id || index}`}><strong>{nameOf(record.employee)}</strong><small>{record.employee.userid} / {recordDate(record)} <MockLocationIcon record={record} /></small><div className="attendance-punches"><div><span>Punch in</span><b>{shown(record.check_in_time || record.intime)} <MockLocationIcon record={record} phase="in" /></b></div><div><span>Punch out</span><b>{shown(record.check_out_time || record.outtime)} <MockLocationIcon record={record} phase="out" /></b></div></div><p>{shown(record.total_hours ?? record.totalhours)} reported hours</p>{record.check_in_distance != null && <p>Recorded distance: {record.check_in_distance} m</p>}{record.move_in_url && /^https?:\/\//i.test(record.move_in_url) && <a href={record.move_in_url} target="_blank" rel="noopener noreferrer">Open attendance capture</a>}<details><summary>Complete log details</summary><CompleteLogDetails record={record} /></details></article>)}{selectedLeaves.map((leave, index) => <article key={`leave-${leave.id || index}`}><strong>{nameOf(leave.employee)}</strong><span className="attendance-leave">Approved leave</span><p>{leave.leave_type || 'Leave'} / {leave.start_date || leave.startdate} to {leave.end_date || leave.enddate}</p></article>)}</div>}</section></div>}
    {view === 'matrix' && <section className="attendance-panel"><div className="attendance-panel-heading"><div><h2>Monthly Attendance Matrix</h2><p>Select any cell to open the employee's day ledger.</p></div><span>{dates.length} days / {people.length} employees</span></div><div className="attendance-matrix-scroll"><table className="attendance-matrix"><thead><tr><th scope="col">Employee</th>{dates.map(day => <th scope="col" key={day}><span>{Number(day.slice(8))}</span><small>{new Date(`${day}T12:00:00`).toLocaleDateString('en', { weekday: 'short' })}</small></th>)}<th scope="col">Punch days</th><th scope="col">Reported hours</th></tr></thead><tbody>{people.map(person => { const cells = dates.map(day => ledger[person.userid][day]); const times = cells.map(cell => cell.minutes).filter(value => value !== null); return <tr key={person.userid}><th scope="row"><button onClick={() => openCell(person, selectedDate)}><strong>{nameOf(person)}</strong><small>{person.userid}</small></button></th>{dates.map(day => { const cell = ledger[person.userid][day]; return <td key={day}><button className={`attendance-matrix-cell code-${cell.code}`} title={`${nameOf(person)} / ${day}: ${cell.label}`} aria-label={`${nameOf(person)}, ${day}, ${cell.label}`} onClick={() => openCell(person, day)}>{cell.code}<MockLocationIcon records={cell.records} /></button></td>; })}<td>{attendance[person.userid] === null ? '?' : cells.filter(cell => cell.records.some(record => hasPunch(record.check_in_time || record.intime))).length}</td><td>{times.length ? formatMinutes(times.reduce((sum, time) => sum + time, 0)) : '-'}</td></tr>; })}</tbody></table></div><div className="attendance-legend">{Object.entries(ATTENDANCE_CODES).map(([code,title]) => <span key={code} className={`code-${code}`}>{code}: {title}</span>)}</div></section>}
    {view === 'logs' && <section className="attendance-panel"><div className="attendance-panel-heading"><div><h2>Attendance logs</h2><p>All returned punch records in the selected month.</p></div><span>{logs.length} records</span></div>{!logs.length ? <div className="attendance-empty">No attendance logs in this month.</div> : <><div className="attendance-logs-scroll"><table className="attendance-logs"><thead><tr><th>Employee</th><th>Date</th><th>Punch in</th><th>Punch out</th><th>Hours</th><th>Ledger</th></tr></thead><tbody>{logs.slice((safeLogPage - 1) * 25, safeLogPage * 25).map((record, index) => <tr key={`${record.employee.userid}-${record.id || index}`}><td><strong>{nameOf(record.employee)}</strong><small>{record.employee.userid}</small></td><td>{recordDate(record)} <MockLocationIcon record={record} /></td><td>{shown(record.check_in_time || record.intime)} <MockLocationIcon record={record} phase="in" /></td><td>{shown(record.check_out_time || record.outtime)} <MockLocationIcon record={record} phase="out" /></td><td>{shown(record.total_hours ?? record.totalhours)}</td><td><button className="attendance-text" onClick={() => openCell(record.employee, recordDate(record))}>Open day</button></td></tr>)}</tbody></table></div><div className="attendance-pagination"><button disabled={safeLogPage === 1} onClick={() => setLogPage(safeLogPage - 1)}>Previous</button><span>Page {safeLogPage} of {logPages}</span><button disabled={safeLogPage === logPages} onClick={() => setLogPage(safeLogPage + 1)}>Next</button></div></>}</section>}
    </>}
    </div>{view !== 'matrix' && <EmployeeDirectory employees={filteredPeople} totalCount={employees.length} selectedId={activeId} onSelect={person => { setEmployeeId(person.userid); setView('individual'); setLogPage(1); }} loading={loading} error={errors.people || ''} onRefresh={load}
      subtitle="Select a person to view their attendance from joining."
      getStatus={person => attendance[person.userid] === null ? 'Unavailable' : currentPresence(attendance[person.userid] || [])}
      toolbar={<><input aria-label="Search employees" placeholder="Search employee name or ID..." value={search} onChange={event => { setSearch(event.target.value); setLogPage(1); }} /><select aria-label="Department" value={department} onChange={event => { setDepartment(event.target.value); setLogPage(1); }}><option value="">All departments</option>{departments.map(item => <option key={item}>{item}</option>)}</select><button onClick={() => { setEmployeeId(''); setView('matrix'); setLogPage(1); }}>All employees matrix</button>{(search || department) && <button onClick={() => { setSearch(''); setDepartment(''); }}>Clear filters</button>}</>} />}</div>
    <footer className="attendance-footnote">India reporting dates. Missing punches do not imply absence, weekly off or payable days. Hours use recorded totals only. {updated && `Last refresh: ${updated.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' })} IST.`}</footer>
  </main>;
}
