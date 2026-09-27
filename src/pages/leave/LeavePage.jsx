import { WorkflowInbox } from '../../components/hierarchy/WorkflowInbox';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Check, X, ArrowRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { Modal } from '../../components/ui/Modal';
import { dateKey, leaveDates, leaveSummary, normalizeLeaveDate } from './leaveCalendarData';
import { BezierLeaveChart } from './BezierLeaveChart';
import { companyCalendarApi } from '../../lib/companyCalendarApi';
import { PROFESSIONAL_LEAVE_PRESETS, eligibleFor } from '../../lib/leavePolicy';
import './LeavePage.css';

const nameOf = person => [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.name || person?.userid || 'Employee';
const statusOf = leave => String(leave?.status || 'Pending').toLowerCase();
const startOf = leave => normalizeLeaveDate(leave?.start_date || leave?.startdate || '');
const endOf = leave => normalizeLeaveDate(leave?.end_date || leave?.enddate || startOf(leave));

const LEAVE_TYPE_COLORS = [
  '#4f772d', // Forest Olive
  '#d97706', // Amber
  '#2563eb', // Royal Blue
  '#7c3aed', // Purple Violet
  '#db2777', // Vivid Pink
  '#059669', // Emerald
  '#ea580c', // Coral Orange
  '#0891b2', // Deep Cyan
  '#475569', // Slate
  '#9333ea', // Electric Purple
  '#ca8a04', // Bronze Yellow
  '#e11d48'  // Crimson Rose
];



export function LeavePage({ currentUser = {}, allUsers, api, onShowToast }) {
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [people, setPeople] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [calendarConfig, setCalendarConfig] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [queueStatus, setQueueStatus] = useState('pending');
  const [decision, setDecision] = useState(null);
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [chartLeaveType, setChartLeaveType] = useState('Earned / Privilege Leave');
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear());
  const sequence = useRef(0);
  const calendarRef = useRef(null);

  const load = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true); setError('');
    try {
      const [users, leaveResult, configResult] = await Promise.all([
        api.getAllUsers({ liveOnly: true }),
        api.getLeaves(undefined, { liveOnly: true }),
        companyCalendarApi.configuration().catch(() => null)
      ]);
      if (id !== sequence.current) return;
      setPeople(users.data);
      const liveLeaves = Array.isArray(leaveResult?.data) ? leaveResult.data : [];
      setLeaves(liveLeaves);
      if (configResult) setCalendarConfig(configResult);
    } catch (err) { if (id === sequence.current) setError(err.message); }
    finally { if (id === sequence.current) setLoading(false); }
  }, [api]);
  useEffect(() => { load(); return () => { sequence.current++; }; }, [load]);

  const visibleLeaves = useMemo(() => selectedId ? leaves.filter(leave => leave.userid === selectedId) : leaves, [leaves, selectedId]);
  const personById = useMemo(() => new Map(people.map(person => [person.userid, person])), [people]);
  const selectedPerson = useMemo(() => selectedId ? personById.get(selectedId) : null, [selectedId, personById]);

  const allLeaveTypes = useMemo(() => {
    const configured = (calendarConfig?.leaveTypes || []).filter(t => t.active !== false);
    if (configured.length > 0) return configured;
    return PROFESSIONAL_LEAVE_PRESETS.map(p => ({ ...p, active: true }));
  }, [calendarConfig]);

  const eligibleLeaveTypes = useMemo(() => {
    if (!selectedPerson) return allLeaveTypes;

    const userAssignment = (calendarConfig?.assignments || []).find(a => a.userid === selectedPerson.userid);
    if (userAssignment?.mode === 'custom' && userAssignment.overrides) {
      return allLeaveTypes.filter(type => {
        const override = userAssignment.overrides[type.id];
        if (override !== undefined) return Boolean(override.enabled);
        return eligibleFor(type, selectedPerson);
      });
    }

    const policyGroup = (calendarConfig?.groups || []).find(g => g.id === userAssignment?.group_id)
      || (calendarConfig?.groups || []).find(g =>
        g.active && (
          g.assignment_mode === 'people'
            ? (g.userids || []).includes(selectedPerson.userid)
            : (g.teams || []).some(t => [selectedPerson.employment_type, selectedPerson.department, selectedPerson.type].includes(t))
        )
      );

    if (policyGroup && Array.isArray(policyGroup.leave_type_ids) && policyGroup.leave_type_ids.length > 0) {
      return allLeaveTypes.filter(type => policyGroup.leave_type_ids.includes(type.id));
    }

    return allLeaveTypes.filter(type => eligibleFor(type, selectedPerson));
  }, [selectedPerson, allLeaveTypes, calendarConfig]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const leave of visibleLeaves) for (const day of leaveDates(leave)) map.set(day, [...(map.get(day) || []), leave]);
    return map;
  }, [visibleLeaves]);
  const dailyLeaves = byDay.get(selectedDate) || [];
  const calendarYear = month.getFullYear();
  const graphs = useMemo(() => leaveSummary(visibleLeaves, chartYear, eligibleLeaveTypes), [visibleLeaves, chartYear, eligibleLeaveTypes]);
  const enrichedTypes = useMemo(() => {
    return (graphs.types || []).map((type, index) => ({
      ...type,
      _color: (type.color && !['#66864f', '#ffffff', '#000000', ''].includes(type.color))
        ? type.color
        : LEAVE_TYPE_COLORS[index % LEAVE_TYPE_COLORS.length]
    }));
  }, [graphs.types]);

  useEffect(() => {
    if (!enrichedTypes.length) return;
    const match = enrichedTypes.some(t => t.name === chartLeaveType || t.code === chartLeaveType);
    if (!match) {
      const earned = enrichedTypes.find(t =>
        t.name.toLowerCase().includes('earned') ||
        t.name.toLowerCase().includes('privilege') ||
        t.code === 'EL' ||
        t.code === 'PL'
      );
      setChartLeaveType(earned ? earned.name : enrichedTypes[0].name);
    }
  }, [enrichedTypes, chartLeaveType]);
  const requests = useMemo(() => visibleLeaves.filter(leave => queueStatus === 'all' || statusOf(leave) === queueStatus).sort((a, b) => startOf(b).localeCompare(startOf(a))), [visibleLeaves, queueStatus]);
  const pending = visibleLeaves.filter(leave => statusOf(leave) === 'pending').length;
  const approved = visibleLeaves.filter(leave => statusOf(leave) === 'approved').length;
  const review = async () => {
    if (!decision || (decision.status === 'Rejected' && !remark.trim())) return;
    setSaving(true); setError('');
    try {
      const reviewed = await api.reviewLeave({ leave_id: decision.leave_id ?? decision.id, status: decision.status, approver_userid: currentUser.userid, remarks: remark.trim() }, { liveOnly: true });
      setDecision(null); setRemark('');
      await load();
      onShowToast?.({ type: 'success', title: 'Leave updated', message: reviewed.data?.status === 'Pending' ? 'Your approval is recorded. Further approval is required.' : 'Decision recorded.' });
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <div className="leave-console">
    <header className="leave-header">
      <div>
        <span className="leave-eyebrow">WORKSPACE / LEAVE REQUESTS</span>
        <h1>Leaves<span>.</span></h1>
        <p>Explore recorded time off and review employee requests.</p>
      </div>
      <div className="leave-header-actions"><button className="leave-button" aria-expanded={showWorkflow} onClick={() => setShowWorkflow(value => !value)}>Requests & approvals</button>
        <button
          type="button"
          className="leave-refresh-btn"
          onClick={load}
          disabled={loading}
          title="Refresh leave records"
          aria-label="Refresh"
        >
          <RefreshCw size={17} className={loading ? 'is-spinning' : ''} />
        </button>
      </div>
    </header>
    {showWorkflow && <section className="hm-page hm-main"><WorkflowInbox currentUser={currentUser} people={people} initialKind="leave" /></section>}
    {error && <div className="leave-alert" role="alert">Leave records are unavailable: {error} <button type="button" onClick={load}>Retry</button></div>}
    <section className="leave-stats" aria-label="Leave overview"><div><span>Employees</span><strong>{loading || error ? '-' : people.length}</strong><small>Live directory</small></div><div><span>Leave requests</span><strong>{loading || error ? '-' : visibleLeaves.length}</strong><small>{calendarYear} and other recorded periods</small></div><div><span>Pending review</span><strong>{loading || error ? '-' : pending}</strong><small>Awaiting a decision</small></div><div><span>Approved</span><strong>{loading || error ? '-' : approved}</strong><small>Recorded requests</small></div></section>
    <div className="leave-layout"><main className="leave-main">
      <section className="leave-panel" ref={calendarRef} tabIndex={-1}><div className="leave-panel-heading"><div><span className="leave-eyebrow">TIME-OFF CALENDAR</span><h2>{selectedId ? nameOf(personById.get(selectedId)) : 'Company leave schedule'}</h2><p>Select a date to see recorded leave requests.</p></div><div className="leave-controls"><select aria-label="Filter employee" value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">All employees</option>{people.map(person => <option key={person.userid} value={person.userid}>{nameOf(person)}</option>)}</select><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(calendarYear, month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button><input type="month" aria-label="Calendar month" value={`${calendarYear}-${String(month.getMonth() + 1).padStart(2, '0')}`} onChange={event => { if (event.target.value) { const [y, m] = event.target.value.split('-').map(Number); setMonth(new Date(y, m - 1, 1)); } }} /><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(calendarYear, month.getMonth() + 1, 1))}><ChevronRight size={16} /></button></div></div>
      <DayPicker mode="single" month={month} onMonthChange={setMonth} selected={new Date(`${selectedDate}T12:00:00`)} onSelect={date => { if (date) setSelectedDate(dateKey(date)); }} weekStartsOn={1} showOutsideDays={false} modifiers={{ approved: date => (byDay.get(dateKey(date)) || []).some(leave => statusOf(leave) === 'approved'), pending: date => (byDay.get(dateKey(date)) || []).some(leave => statusOf(leave) === 'pending') }} modifiersClassNames={{ approved: 'leave-day-approved', pending: 'leave-day-pending' }} footer={<div className="leave-legend"><span>Approved leave</span><span>Pending request</span></div>} />
      <div className="leave-day-details"><h3>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>{!dailyLeaves.length && <p className="leave-empty">No recorded leave on this date.</p>}{dailyLeaves.map((leave, index) => <article key={`${leave.userid}-${leave.id || index}`}><div><strong>{nameOf(personById.get(leave.userid))}</strong><small>{leave.leave_type || 'Leave'} / {startOf(leave)} to {endOf(leave)}</small></div><span className={`leave-pill ${statusOf(leave)}`}>{leave.status || 'Pending'}</span></article>)}</div></section>

      {/* Leave Types Bezier Chart Section with Type Selector and Calendar Year */}
      <div className="leave-graphs">
        <section className="leave-panel">
          <div className="leave-panel-heading">
            <div>
              <span className="leave-eyebrow">REQUEST MIX</span>
              <h2>Leave types</h2>
              <p>Monthly days breakdown across leave categories in {chartYear}.</p>
            </div>
            <div className="leave-chart-header-controls">
              <select
                aria-label="Filter leave type"
                className="leave-type-dropdown"
                value={chartLeaveType}
                onChange={event => setChartLeaveType(event.target.value)}
              >
                {enrichedTypes.map(type => (
                  <option key={type.name} value={type.name}>
                    {type.name} ({type.code})
                  </option>
                ))}
              </select>
              <select
                aria-label="Calendar year"
                className="leave-year-dropdown"
                value={chartYear}
                onChange={event => setChartYear(Number(event.target.value))}
              >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          {loading || error ? (
            <p className="leave-empty">Live chart unavailable.</p>
          ) : !enrichedTypes.length ? (
            <p className="leave-empty">No leave types configured.</p>
          ) : (
            <BezierLeaveChart
              types={enrichedTypes}
              monthlyByType={graphs.monthlyByType}
              selectedType={chartLeaveType}
              onSelectType={setChartLeaveType}
              year={chartYear}
              height={300}
            />
          )}
        </section>
      </div>

      <section className="leave-panel"><div className="leave-panel-heading"><div><span className="leave-eyebrow">REVIEW DESK</span><h2>Leave requests</h2><p>Approve or reject pending requests from the live records.</p></div><select aria-label="Filter request status" value={queueStatus} onChange={event => setQueueStatus(event.target.value)}><option value="pending">Pending</option><option value="all">All requests</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div><div className="leave-request-list">{loading ? <p className="leave-empty">Loading requests...</p> : error ? <p className="leave-empty">Requests unavailable.</p> : !requests.length ? <p className="leave-empty">No requests match this filter.</p> : requests.map((leave, index) => <article key={`${leave.userid}-${leave.id || index}`}><div><strong>{nameOf(personById.get(leave.userid))}</strong><small>{leave.userid} / {leave.leave_type || 'Leave'} / {startOf(leave)} <ArrowRight size={11} /> {endOf(leave)}</small>{leave.reason && <p>{leave.reason}</p>}</div><span className={`leave-pill ${statusOf(leave)}`}>{leave.status || 'Pending'}</span>{statusOf(leave) === 'pending' && <div className="leave-review-actions"><button type="button" onClick={() => setDecision({ ...leave, status: 'Approved' })}><Check size={14} />Approve</button><button type="button" onClick={() => setDecision({ ...leave, status: 'Rejected' })}><X size={14} />Reject</button></div>}</article>)}</div></section>
    </main><aside className="leave-side"><EmployeeDirectory employees={people} selectedId={selectedId} onSelect={person => setSelectedId(person.userid)} loading={loading} error={error} subtitle="Filter the calendar and charts by employee." pageSize={5} headerAction={selectedId && <button type="button" className="leave-clear" onClick={() => setSelectedId('')}>Show all</button>} /></aside></div>
    <Modal isOpen={!!decision} onClose={() => { if (!saving) { setDecision(null); setRemark(''); } }} title={decision?.status === 'Approved' ? 'Approve leave request' : 'Reject leave request'}><div className="leave-decision"><p>{decision && `${nameOf(personById.get(decision.userid))} / ${decision.leave_type || 'Leave'} / ${startOf(decision)} to ${endOf(decision)}`}</p>{decision?.status === 'Rejected' && <label>Reason for rejection<textarea value={remark} onChange={event => setRemark(event.target.value)} rows={3} required /></label>}<div><button type="button" className="leave-button" onClick={() => setDecision(null)} disabled={saving}>Cancel</button><button type="button" className="leave-button is-primary" onClick={review} disabled={saving || (decision?.status === 'Rejected' && !remark.trim())}>{saving ? 'Saving...' : `Confirm ${decision?.status?.toLowerCase()}`}</button></div></div></Modal>
  </div>;
}
