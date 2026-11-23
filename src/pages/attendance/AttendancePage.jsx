import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import { readAttendanceSnapshot, saveAttendanceSnapshot, clearAttendanceSnapshot } from '../../lib/attendanceConsoleCache.mjs';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { TenantHeader } from '../../components/ui/TenantHeader';
import { Modal } from '../../components/ui/Modal';

import { WorkflowInbox } from '../../components/hierarchy/WorkflowInbox';
import { MockLocationIcon } from './MockLocationIcon';
import { MonthlyAttendanceDetails, CompleteLogDetails } from './AttendanceDetails';
import { AttendanceMatrix } from './AttendanceMatrix';
import { IndividualAttendanceMatrix } from './IndividualAttendanceMatrix';
import { AttendanceLeaveCharts } from './AttendanceLeaveCharts';
import { exportAttendancePdf } from './attendancePdfExport';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UniversalCalendar, DayButton } from '../../components/ui/UniversalCalendar';
import { CalendarDays, Table2, List, Download, ChevronLeft, ChevronRight, Clock3, Users, Fingerprint, AlertCircle, FileDown, PieChart } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { attendanceDay, currentPresence, displayFields, profileImage } from '../employees/EmployeesPage/directoryData';
import { dateKey, recordDate, hasPunch, monthDates, dayLedger, formatMinutes, csvText } from './attendanceLedger';
import './AttendancePage.scss';

const CalendarData = createContext({});
const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Date(2020, index, 1).toLocaleDateString('en-GB', { month: 'long' })
);
const attendanceViews = [
  { id: 'matrix', icon: Users, label: 'Team matrix' },
  { id: 'individual', icon: Table2, label: 'Individual matrix' },
  { id: 'logs', icon: List, label: 'Punch logs' },
  { id: 'calendar', icon: CalendarDays, label: 'Day details' },
  { id: 'charts', icon: PieChart, label: 'Leaves & analytics' },
];
function LedgerDay(props) {
  const summaries = useContext(CalendarData);
  const summary = summaries[dateKey(props.day.date)];
  return <DayButton {...props} title={summary?.text || 'No record'} className={`${props.className || ''} attendance-day-${summary?.code || 'NR'}`}><span className="attendance-calendar-date">{props.day.date.getDate()}</span>{!props.modifiers.outside && summary && !['NR', '-', '?', 'NA'].includes(summary.code) && <span className="attendance-calendar-dot" aria-hidden="true" />}<span className="sr-only">{summary?.text || 'No record'}</span></DayButton>;
}
const nameOf = person => [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || person.userid;
const shown = value => value == null || value === '' ? 'Not recorded' : String(value);
function RawFields({ record }) {
  return <dl className="attendance-details">{displayFields(record).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{value && typeof value === 'object' ? JSON.stringify(value) : shown(value)}</dd></div>)}</dl>;
}
export function AttendancePage({ currentUser, api, todaysAttendance, onPunchAttendance, onShowToast }) {
  const cacheScope = JSON.stringify([api.getAuthToken?.(), currentUser?.company_id, currentUser?.userid || currentUser?.user_id, currentUser?.role]);
  const cached = readAttendanceSnapshot(cacheScope);
  const today = attendanceDay();
  const todayDate = new Date(`${today}T12:00:00`);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [month, setMonth] = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState(attendanceViews[0].id);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState(() => cached?.employees || api.getCachedUsers?.() || []);
  const [peopleLoading, setPeopleLoading] = useState(() => !cached && !api.getCachedUsers?.());
  const [attendance, setAttendance] = useState(() => cached?.attendance || {});
  const [leaves, setLeaves] = useState(() => cached?.leaves || []);
  const [schedule, setSchedule] = useState(() => cached?.schedule || null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(!cached);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [logPage, setLogPage] = useState(1);
  const [exportingPdf, setExportingPdf] = useState(false);
  const generation = useRef(0);
  const preferredEmployee = useRef(employeeId);
  preferredEmployee.current = employeeId;

  const toast = (type, title, message) => onShowToast?.({ type, title, message });

  const load = useCallback(async () => {
    const id = ++generation.current;
    const saved = readAttendanceSnapshot(cacheScope);
    if (saved) {
      setEmployees(saved.employees); setAttendance(saved.attendance); setLeaves(saved.leaves); setSchedule(saved.schedule || null); setErrors({}); setPeopleLoading(false); setLoading(false);
      return;
    }
    setLoading(true); setErrors({});
    const failures = {};
    const directoryRequest = api.getAllUsers({ liveOnly: true, maxAge: 120000 }).then(result => {
      if (id === generation.current) { setEmployees(result.data); setPeopleLoading(false); }
      return result;
    }, error => {
      if (id === generation.current) setPeopleLoading(false);
      throw error;
    });
    const [peopleResult, leaveResult, scheduleResult] = await Promise.allSettled([
      directoryRequest,
      api.getLeaves(undefined, { liveOnly: true }),
      api.getAttendanceSchedule(),
    ]);
    if (id !== generation.current) return;
    const cachedPeople = api.getCachedUsers?.();
    const people = peopleResult.status === 'fulfilled' ? peopleResult.value.data : cachedPeople || [];
    if (peopleResult.status === 'rejected') {
      if (cachedPeople) failures.directoryRefresh = 'Showing the saved employee list; its latest update is unavailable.';
      else failures.people = 'Employee directory could not be loaded.';
    }
    if (leaveResult.status === 'rejected') failures.leaves = 'Leave data is unavailable; leave markers may be incomplete.';
    if (scheduleResult.status === 'rejected') failures.schedule = 'Working days and company holidays could not be loaded.';
    const attendanceSchedule = scheduleResult.status === 'fulfilled' ? scheduleResult.value : null;
    setSchedule(attendanceSchedule);
    setLeaves(leaveResult.status === 'fulfilled' ? leaveResult.value.data : []);
    setErrors({ ...failures });
    const orderedPeople = [...people].sort((a, b) => Number(b.userid === preferredEmployee.current) - Number(a.userid === preferredEmployee.current));
    const records = {}; let next = 0;
    await Promise.all(Array.from({ length: Math.min(6, people.length) }, async () => {
      while (next < people.length && id === generation.current) {
        const preferredIndex = orderedPeople.findIndex((person, index) => index >= next && person.userid === preferredEmployee.current);
        if (preferredIndex > next) [orderedPeople[next], orderedPeople[preferredIndex]] = [orderedPeople[preferredIndex], orderedPeople[next]];
        const person = orderedPeople[next++];
        try {
          const result = await api.getAttendance(person.userid, undefined, { liveOnly: true });
          records[person.userid] = result.data.filter(record => !(record.userid || record.user_id) || String(record.userid || record.user_id) === String(person.userid));
        } catch { records[person.userid] = null; }
        if (id === generation.current) setAttendance(previous => ({ ...previous, [person.userid]: records[person.userid] }));
      }
    }));
    if (id !== generation.current) return;
    const failed = Object.values(records).filter(value => value === null).length;
    if (failed) failures.attendance = `Attendance unavailable for ${failed} employee${failed === 1 ? '' : 's'}. Their cells show ?.`;
    const result = { employees: people, attendance: records, leaves: leaveResult.status === 'fulfilled' ? leaveResult.value.data : [], schedule: attendanceSchedule };
    if (!Object.keys(failures).length) saveAttendanceSnapshot(cacheScope, result);
    setEmployees(people); setAttendance(records); setLeaves(result.leaves); setErrors(failures); setLoading(false);
  }, [api, cacheScope]);

  useEffect(() => { load(); return () => { generation.current += 1; }; }, [load]);
  useEffect(() => {
    window.addEventListener('pulse-attendance-corrected', load);
    return () => window.removeEventListener('pulse-attendance-corrected', load);
  }, [load]);
  const departments = [...new Set(employees.map(person => person.department).filter(Boolean))].sort();
  const filteredPeople = useMemo(() => employees.filter(person => (!department || person.department === department) && [nameOf(person), person.userid, person.email].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))), [employees, department, search]);
  const activeId = view === 'matrix' || view === 'charts' ? '' : filteredPeople.some(person => person.userid === employeeId) ? employeeId : filteredPeople[0]?.userid || '';
  const contentLoading = loading && (!activeId || !Object.prototype.hasOwnProperty.call(attendance, activeId));
  const people = (view === 'matrix' || view === 'charts') ? employees : activeId ? filteredPeople.filter(person => person.userid === activeId) : filteredPeople;
  const historyYears = [...employees.map(person => person.date_of_joining || person.joining_date), ...Object.values(attendance).flatMap(records => (records || []).map(record => recordDate(record)))].map(date => Number(String(date || '').slice(0,4))).filter(year => year >= 1900 && year <= todayDate.getFullYear());
  const firstYear = Math.min(todayDate.getFullYear(), ...historyYears);
  const years = Array.from({length: Math.max(todayDate.getFullYear(), month.getFullYear()) - Math.min(firstYear, month.getFullYear()) + 1}, (_, i) => Math.min(firstYear, month.getFullYear()) + i);
  const dates = useMemo(() => monthDates(month), [month]);
  const officeHolidays = useMemo(() => new Map(schedule?.officeHolidays?.map(holiday => [holiday.date, holiday.name])), [schedule]);
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
  function changeMonth(date, day) {
    const next = new Date(date.getFullYear(), date.getMonth(), 1);
    setMonth(next);
    setSelectedDate(day || dateKey(next));
    setLogPage(1);
  }
  function moveMonth(offset) {
    changeMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }
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
    toast('success', 'CSV Exported', 'Downloaded raw attendance ledger spreadsheet.');
  }
  async function exportPdf() {
    setExportingPdf(true);
    try {
      await exportAttendancePdf({
        people,
        dates,
        ledger,
        month,
        department: view === 'matrix' || view === 'charts' ? '' : department,
        tenantName: currentUser?.company_name || currentUser?.company || 'Pulse HRMS',
        authorizerName: [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') || currentUser?.name || 'HR Manager',
      });
      toast('success', 'PDF exported', 'Downloaded the selected attendance report.');
    } catch {
      toast('error', 'PDF export failed', 'Try exporting the attendance report again.');
    } finally {
      setExportingPdf(false);
    }
  }
  const logPages = Math.max(1, Math.ceil(logs.length / 25));
  const safeLogPage = Math.min(logPage, logPages);
  const exportDisabled = contentLoading || Boolean(errors.people) || !people.length;
  const periodControls = (
    <div className="attendance-month-nav" role="group" aria-label="Attendance period">
      <div className="attendance-month-stepper">
        <Button variant="fadeout" size="sm" iconOnly icon={ChevronLeft} aria-label="Previous month" title="Previous month" onClick={() => moveMonth(-1)} />
        <select aria-label="Attendance month" value={month.getMonth()} onChange={event => changeMonth(new Date(month.getFullYear(), Number(event.target.value), 1))}>
          {monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
        </select>
        <select aria-label="Attendance year" value={month.getFullYear()} onChange={event => changeMonth(new Date(Number(event.target.value), month.getMonth(), 1))}>
          {years.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
        <Button variant="fadeout" size="sm" iconOnly icon={ChevronRight} aria-label="Next month" title="Next month" onClick={() => moveMonth(1)} />
      </div>
      <Button size="sm" variant="fadeout" disabled={selectedDate === today} onClick={() => changeMonth(todayDate, today)}>Today</Button>
    </div>
  );
  const employeeDirectory = view !== 'matrix' && view !== 'charts' && <EmployeeDirectory employees={filteredPeople} totalCount={employees.length} selectedId={activeId} onSelect={person => { setEmployeeId(person.userid); setLogPage(1); }} loading={peopleLoading} error={errors.people || ''} onRefresh={load}
      subtitle="Select a person to view their attendance from joining."
      getStatus={person => !Object.prototype.hasOwnProperty.call(attendance, person.userid) ? 'Loading attendance' : attendance[person.userid] === null ? 'Unavailable' : currentPresence(attendance[person.userid] || [])}
      toolbar={<><input aria-label="Search employees" placeholder="Search employee name or ID..." value={search} onChange={event => { setSearch(event.target.value); setLogPage(1); }} /><select aria-label="Department" value={department} onChange={event => { setDepartment(event.target.value); setLogPage(1); }}><option value="">All departments</option>{departments.map(item => <option key={item}>{item}</option>)}</select><Button onClick={() => {
  setEmployeeId('');
  setView('matrix');
  setLogPage(1);
}} variant="outline" type="button" wrapContent={false}>All employees matrix</Button>{(search || department) && <Button onClick={() => {
  setSearch('');
  setDepartment('');
}} variant="outline" type="button" wrapContent={false}>Clear filters</Button>}</>} />;
  return <main className="attendance-console">
    <TenantHeader
        settings={{
          subheading: "WORKSPACE / ATTENDANCE",
          heading: "Attendance & Logs Console",
          paragraph: "Review attendance, punches, and leave in one workspace.",
          buttons: [
            { id: 'corrections', label: 'Correction requests', variant: showWorkflow ? 'colored' : 'outline' },
            { id: 'pdf', label: 'Export PDF', variant: 'outline' },
            { id: 'csv', label: 'Export CSV', variant: 'outline' },
          ]
        }}
        actions={{
          corrections: { 'aria-expanded': showWorkflow, onClick: () => setShowWorkflow(true) },
          pdf: { onClick: exportPdf, icon: FileDown, loading: exportingPdf, disabled: exportDisabled, title: 'Download printable attendance report' },
          csv: { onClick: exportLedger, icon: Download, disabled: exportDisabled, title: 'Download attendance ledger as CSV' },
        }}
      />
    <Modal
      isOpen={showWorkflow}
      onClose={() => setShowWorkflow(false)}
      title="Attendance corrections"
      subtitle="Submit a correction or review requests assigned to you."
      size="xl"
      className="attendance-corrections-dialog"
    >
      <WorkflowInbox currentUser={currentUser} people={employees} requestKind="attendance" initialDate={selectedDate} />
    </Modal>

    <div className="attendance-view-controls">
      <ViewTabs label="Attendance views" value={view} onChange={id => { setView(id); setLogPage(1); }} tabs={attendanceViews} />
      {view !== 'matrix' && view !== 'individual' && periodControls}
    </div>

    {!contentLoading && Object.keys(errors).length > 0 && <div className="attendance-warning" role="alert"><AlertCircle size={18} /><span>{Object.values(errors).join(' ')}</span><Button onClick={() => { clearAttendanceSnapshot(); load(); }} variant="outline" type="button" wrapContent={false}>Retry</Button></div>}
    {view !== 'individual' && <MetricOverview loading={contentLoading} aria-label="Monthly summary">{[[Users, 'Employees', people.length, 'employees'], [Fingerprint, 'Days with punches', missing ? '-' : recordedDays, 'days'], [Clock3, 'Reported hours', missing || !minutes.length ? '-' : formatMinutes(minutes.reduce((sum, value) => sum + value, 0)), 'hours'], [List, 'Punch records', missing ? '-' : logs.length, 'records']].map(([Icon, title, count, key]) => <MetricCard key={key} aria-expanded={selectedMetric === key} aria-controls="attendance-month-details" onClick={() => setSelectedMetric(selectedMetric === key ? null : key)} as="button" loading={contentLoading} label={title} icon={Icon} value={contentLoading || errors.people ? '-' : count} caption="View monthly details" />)}</MetricOverview>}
    {view !== 'individual' && selectedMetric && <MonthlyAttendanceDetails metric={selectedMetric} people={people} dates={dates} ledger={ledger} logs={logs} monthLabel={month.toLocaleDateString('en-GB',{month:'long',year:'numeric'})} onClose={()=>setSelectedMetric(null)} onOpenDay={(person,day)=>{openCell(person,day);setSelectedMetric(null);}} loading={contentLoading} error={errors.people} missing={missing} />}

    {view === 'individual' && !contentLoading && !errors.people && people[0] ? (
      <IndividualAttendanceMatrix person={people[0]} records={attendance[people[0].userid]} leaves={leaves} year={month.getFullYear()} today={today} controls={periodControls} directory={employeeDirectory} officeHolidays={officeHolidays} workingDays={schedule?.workingDaysByUser?.[people[0].userid]} onOpenDay={(person, day) => { setMonth(new Date(`${day.slice(0,7)}-01T12:00:00`)); openCell(person, day); }} leaveUnavailable={!!errors.leaves} />
    ) : (
    <div className={`attendance-person-workspace workspace-grid ${view === 'matrix' || view === 'charts' ? 'attendance-all-matrix' : view === 'calendar' ? 'attendance-day-workspace' : ''}`}><div className="attendance-person-content">
    <SectionSkeleton loading={contentLoading}>{contentLoading ? (
      <div className="attendance-workspace-skeleton" role="status" aria-label="Loading attendance workspace">
        <div className="attendance-workspace-skeleton__header">
          <div className="attendance-workspace-skeleton__title" />
          <div className="attendance-workspace-skeleton__subtitle" />
        </div>
        <div className="attendance-workspace-skeleton__kpis">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="attendance-workspace-skeleton__kpi-card" />
          ))}
        </div>
        <div className="attendance-workspace-skeleton__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="attendance-workspace-skeleton__row" />
          ))}
        </div>
      </div>
    ) : errors.people ? <div className="attendance-empty">The employee directory is unavailable. Use Retry to load the ledger.</div> : !people.length ? <div className="attendance-empty">No employees match this selection.</div> : <>
    {view === 'charts' && <AttendanceLeaveCharts people={employees} dates={dates} ledger={ledger} month={month} />}
    {view === 'calendar' && <div className="attendance-calendar-layout workspace-grid"><TenantPanel className="attendance-calendar-panel" title={<>{people.length === 1 ? nameOf(people[0]) : 'Team attendance'}</>} subtitle={<>{month.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</>}><CalendarData.Provider value={summary}><UniversalCalendar size="sm" mode="single" required month={month} onMonthChange={changeMonth} selected={new Date(`${selectedDate}T12:00:00`)} onSelect={date => { if (date) setSelectedDate(dateKey(date)); }} weekStartsOn={1} hideNavigation showOutsideDays={false} components={{ DayButton: LedgerDay }} /></CalendarData.Provider><div className="attendance-legend"><span className="code-P">P: Punch recorded</span><span className="code-L">L: Recorded late</span><span className="code-A">A: Recorded absent</span><span className="code-LV">LV: Approved leave</span><span className="code-HD">HD: Half day</span><span>NR: No record</span><span>?: Unavailable</span></div></TenantPanel><TenantPanel className="attendance-day-detail" aria-live="polite" title="Day details" subtitle={<>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {selectedLogs.length} {selectedLogs.length === 1 ? 'record' : 'records'}</>}>{missing && <p className="attendance-note">Some employees' attendance is unavailable.</p>}{!selectedLogs.length && !selectedLeaves.length ? <div className="attendance-empty">{selectedDate > today ? 'No records for this upcoming date.' : 'No punch or approved leave records for this date.'}</div> : <div className="attendance-day-records">{selectedLogs.map((record, index) => <article key={`${record.employee.userid}-${record.id || index}`}><div className="attendance-day-person"><Avatar src={profileImage(record.employee)} name={nameOf(record.employee)} userid={record.employee.userid} size="sm" /><div><strong>{nameOf(record.employee)}</strong><small>{record.employee.designation || record.employee.department || 'Attendance record'} <MockLocationIcon record={record} /></small></div></div><div className="attendance-punches"><div className="attendance-punch-in"><span>Punch in</span><b>{shown(record.check_in_time || record.intime)} <MockLocationIcon record={record} phase="in" /></b></div><div className="attendance-punch-out"><span>Punch out</span><b>{shown(record.check_out_time || record.outtime)} <MockLocationIcon record={record} phase="out" /></b></div></div><p>{record.total_hours == null && record.totalhours == null || (record.total_hours ?? record.totalhours) === '' ? 'Hours not recorded' : `${shown(record.total_hours ?? record.totalhours)} reported hours`}</p>{record.check_in_distance != null && <p>Recorded distance: {record.check_in_distance} m</p>}{record.move_in_url && /^https?:\/\//i.test(record.move_in_url) && <a href={record.move_in_url} target="_blank" rel="noopener noreferrer">Open attendance capture</a>}<details><summary>Complete log details</summary><CompleteLogDetails record={record} /></details></article>)}{selectedLeaves.map((leave, index) => <article key={`leave-${leave.id || index}`}><strong>{nameOf(leave.employee)}</strong><span className="attendance-leave">Approved leave</span><p>{leave.leave_type || 'Leave'} / {leave.start_date || leave.startdate} to {leave.end_date || leave.enddate}</p></article>)}</div>}</TenantPanel></div>}
    {view === 'matrix' && (
      <TenantPanel className="attendance-panel attendance-monthly-panel" title={<>Monthly Attendance &amp; Leave Matrix</>} subtitle={<>Comprehensive status record of daily punches and approved leaves · {dates.length} days / {people.length} employees</>} controls={periodControls}>

        <AttendanceMatrix
          rowHeading="Employee"
          officeHolidays={officeHolidays}
          columns={dates.map(day => {
            const date = new Date(day + 'T12:00:00');
            return {
              id: day,
              label: Number(day.slice(8)),
              weekday: date.toLocaleDateString('en', { weekday: 'short' }),
              weekend: date.getDay() === 0 || date.getDay() === 6,
            };
          })}
          rows={people.map(person => ({
            id: person.userid,
            personName: nameOf(person),
            headingClass: 'matrix-emp-row',
            heading: (
              <Button variant="outline" wrapContent={false} layout="row" onClick={() => openCell(person, selectedDate)}>
                <strong>{nameOf(person)}</strong>
                {person.department && <div className="matrix-emp-meta"><small>{person.department}</small></div>}
              </Button>
            ),
            days: dates,
            workingDays: schedule?.workingDaysByUser?.[person.userid],
            cells: dates.map(day => ledger[person.userid][day]),
            unavailable: attendance[person.userid] === null,
            onOpenDay: day => openCell(person, day),
          }))}
        />
      </TenantPanel>
    )}
    {view === 'logs' && <TenantPanel className="attendance-panel attendance-log-panel" title="Attendance logs" subtitle={`Punch activity for the selected month · ${logs.length} records`}>

      {!logs.length ? <div className="attendance-empty"><Fingerprint size={28} /><strong>No punch activity</strong><span>No attendance logs in this month.</span></div> : <>
        <div className="attendance-logs-scroll"><table className="attendance-logs">
          <thead><tr><th>Employee</th><th>Date</th><th>Punch in</th><th>Punch out</th><th>Hours</th><th><span className="sr-only">Day details</span></th></tr></thead>
          <tbody>{logs.slice((safeLogPage - 1) * 25, safeLogPage * 25).map((record, index) => {
            const employee = record.employee;
            const day = recordDate(record);
            const date = new Date(`${day}T12:00:00`);
            const validDate = !Number.isNaN(date.getTime());
            return <tr key={`${employee.userid}-${record.id || index}`}>
              <td><div className="attendance-log-person"><Avatar src={profileImage(employee)} name={nameOf(employee)} userid={employee.userid} size="sm" /><div><strong>{nameOf(employee)}</strong>{(employee.designation || employee.department) && <small>{employee.designation || employee.department}</small>}</div></div></td>
              <td><strong>{validDate ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : day}</strong>{validDate && <small>{date.toLocaleDateString('en-IN', { weekday: 'long' })}</small>}<MockLocationIcon record={record} /></td>
              <td><span className={`attendance-log-time${record.check_in_time || record.intime ? ' attendance-log-time--in' : ''}`}>{shown(record.check_in_time || record.intime)}</span> <MockLocationIcon record={record} phase="in" /></td>
              <td><span className={`attendance-log-time${record.check_out_time || record.outtime ? ' attendance-log-time--out' : ''}`}>{shown(record.check_out_time || record.outtime)}</span> <MockLocationIcon record={record} phase="out" /></td>
              <td>{shown(record.total_hours ?? record.totalhours)}</td>
              <td><Button variant="fadeout" size="sm" className="btn--icon-sm" type="button" aria-label={`Open attendance for ${nameOf(employee)} on ${day}`} title="View day details" onClick={() => openCell(employee, day)}><ChevronRight size={16} /></Button></td>
            </tr>;
          })}</tbody>
        </table></div>
        <div className="attendance-pagination"><span className="attendance-log-count">{(safeLogPage - 1) * 25 + 1}–{Math.min(safeLogPage * 25, logs.length)} of {logs.length} records</span><span>{safeLogPage} / {logPages}</span><Button variant="fadeout" size="sm" className="btn--icon-sm" type="button" aria-label="Previous page" disabled={safeLogPage === 1} onClick={() => setLogPage(safeLogPage - 1)}><ChevronLeft size={16} /></Button><Button variant="fadeout" size="sm" className="btn--icon-sm" type="button" aria-label="Next page" disabled={safeLogPage === logPages} onClick={() => setLogPage(safeLogPage + 1)}><ChevronRight size={16} /></Button></div>
      </>}
    </TenantPanel>}
    </>}</SectionSkeleton>
    </div>{employeeDirectory}</div>
    )}
  </main>;
}

export default AttendancePage;
