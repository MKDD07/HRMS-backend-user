import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { TenantPanelHeader } from '../../components/ui/TenantPanel';
import { TenantHeader } from '../../components/ui/TenantHeader';

import { WorkflowInbox } from '../../components/hierarchy/WorkflowInbox';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Check, X, ArrowRight, Users, CalendarDays, ClipboardClock, CircleCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LeaveSchedule } from './LeaveSchedule';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { Modal } from '../../components/ui/Modal';
import { dateKey, leaveSummary, normalizeLeaveDate } from './leaveCalendarData';
import { BezierLeaveChart } from './BezierLeaveChart';
import { companyCalendarApi } from '../../lib/companyCalendarApi';
import { PROFESSIONAL_LEAVE_PRESETS, eligibleFor } from '../../lib/leavePolicy';
import './LeavePage.scss';

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
    <TenantHeader
        settings={{
          subheading: "WORKSPACE / LEAVE REQUESTS",
          heading: "Leaves",
          paragraph: "Explore recorded time off and review employee requests.",
          refresh: { label: "Refresh leave records" },
          buttons: [
            { id: 'action0', label: "Requests & approvals", variant: showWorkflow ? "colored" : "outline" }
          ]
        }}
        actions={{
          action0: { "aria-expanded": showWorkflow, "onClick": () => setShowWorkflow(value => !value) },
          refresh: { "icon": RefreshCw, "loading": loading, "onClick": load }
        }}
      />
    {showWorkflow && <section className="hm-page hm-main"><WorkflowInbox currentUser={currentUser} people={people} initialKind="leave" /></section>}
    {error && <div className="leave-alert" role="alert">Leave records are unavailable: {error} <Button type="button" onClick={load} variant="outline" wrapContent={false}>Retry</Button></div>}
    <MetricOverview loading={loading} aria-label="Leave overview"><MetricCard loading={loading} label="Employees" icon={Users} value={loading || error ? '-' : people.length} caption="Live directory" /><MetricCard loading={loading} label="Leave requests" icon={CalendarDays} value={loading || error ? '-' : visibleLeaves.length} caption={<>{calendarYear} and other recorded periods</>} /><MetricCard loading={loading} label="Pending review" icon={ClipboardClock} value={loading || error ? '-' : pending} caption="Awaiting a decision" /><MetricCard loading={loading} label="Approved" icon={CircleCheck} value={loading || error ? '-' : approved} caption="Recorded requests" /></MetricOverview>
    <div className="workspace-grid leave-layout"><main className="leave-main">
      <section className="leave-panel leave-schedule-panel" ref={calendarRef} tabIndex={-1}>
        <TenantPanelHeader title={selectedId ? nameOf(personById.get(selectedId)) + "'s leave schedule" : 'Company leave schedule'} subtitle="Plan ahead with a shared view of employee time off." />
        <LeaveSchedule people={people} leaves={visibleLeaves} holidays={calendarConfig?.holidays} leaveTypes={allLeaveTypes} selectedId={selectedId} onEmployeeChange={setSelectedId} month={month} onMonthChange={setMonth} selectedDate={selectedDate} onDateChange={setSelectedDate} loading={loading} />
      </section>

      {/* Leave Types Bezier Chart Section with Type Selector and Calendar Year */}
      <div className="leave-graphs">
        <section className="leave-panel">
          <TenantPanelHeader title={<>Leave types</>} subtitle={<>Monthly days breakdown across leave categories in {chartYear}.</>} /><div className="tenant-panel-tools"><div className="leave-chart-header-controls">
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
            </div></div>
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

      <section className="leave-panel"><TenantPanelHeader title={<>Leave requests</>} subtitle={<>Approve or reject pending requests from the live records.</>} /><div className="tenant-panel-tools"><select aria-label="Filter request status" value={queueStatus} onChange={event => setQueueStatus(event.target.value)}><option value="pending">Pending</option><option value="all">All requests</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div><div className="leave-request-list"><SectionSkeleton loading={loading}>{loading ? <p className="leave-empty">Loading requests...</p> : error ? <p className="leave-empty">Requests unavailable.</p> : !requests.length ? <p className="leave-empty">No requests match this filter.</p> : requests.map((leave, index) => <article key={`${leave.userid}-${leave.id || index}`}><div><strong>{nameOf(personById.get(leave.userid))}</strong><small>{leave.userid} / {leave.leave_type || 'Leave'} / {startOf(leave)} <ArrowRight size={11} /> {endOf(leave)}</small>{leave.reason && <p>{leave.reason}</p>}</div><span className={`leave-pill ${statusOf(leave)}`}>{leave.status || 'Pending'}</span>{statusOf(leave) === 'pending' && <div className="leave-review-actions"><Button type="button" onClick={() => setDecision({
  ...leave,
  status: 'Approved'
})} variant="outline" wrapContent={false}><Check size={14} />Approve</Button><Button type="button" onClick={() => setDecision({
  ...leave,
  status: 'Rejected'
})} variant="outline" wrapContent={false}><X size={14} />Reject</Button></div>}</article>)}</SectionSkeleton></div></section>
    </main><aside className="leave-side"><EmployeeDirectory employees={people} selectedId={selectedId} onSelect={person => setSelectedId(person.userid)} loading={loading} error={error} subtitle="Filter the calendar and charts by employee." pageSize={5} headerAction={selectedId && <Button type="button" className="leave-clear" onClick={() => setSelectedId('')} variant="outline" wrapContent={false}>Show all</Button>} /></aside></div>
    <Modal isOpen={!!decision} onClose={() => { if (!saving) { setDecision(null); setRemark(''); } }} title={decision?.status === 'Approved' ? 'Approve leave request' : 'Reject leave request'}><div className="leave-decision"><p>{decision && `${nameOf(personById.get(decision.userid))} / ${decision.leave_type || 'Leave'} / ${startOf(decision)} to ${endOf(decision)}`}</p>{decision?.status === 'Rejected' && <label>Reason for rejection<textarea value={remark} onChange={event => setRemark(event.target.value)} rows={3} required /></label>}<div><Button type="button" className="leave-button" onClick={() => setDecision(null)} disabled={saving} variant="outline" wrapContent={false}>Cancel</Button><Button type="button" className="leave-button is-primary" onClick={review} disabled={saving || decision?.status === 'Rejected' && !remark.trim()} variant="colored" wrapContent={false}>{saving ? 'Saving...' : `Confirm ${decision?.status?.toLowerCase()}`}</Button></div></div></Modal>
  </div>;
}
