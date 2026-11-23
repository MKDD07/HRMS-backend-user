import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { CloseButton } from '../ui/CloseButton';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { FormSelect } from '../ui/FormSelect';
import { Badge } from '../ui/Badge';
import { ViewTabs } from '../ui/ViewTabs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Send, Check, Trash2, GitBranch } from 'lucide-react';
import { workflowApi } from '../../lib/workflowApi';
import { companyRequest } from '../../lib/companyAuth';
import './WorkflowSettings.scss';

const requestTypes = { attendance: 'Attendance correction', leave: 'Leave', expense: 'Expense approval', other: 'Other request' };
const requestRoles = { administrator: 'Administrator', requester: 'Requester', approver: 'Approver', reviewer: 'Reviewer', cc: 'CC recipient' };
const dateLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
const attendanceTimezone = '+05:30';
const requestFields = {
  attendance: { date: 'Attendance date', check_in: 'Check-in', check_out: 'Check-out', timezone: 'Timezone' },
  leave: { start_date: 'Start date', end_date: 'End date', leave_type: 'Leave type', days: 'Days' },
};
const requestTypeOptions = Object.entries(requestTypes).map(([value, label]) => ({ value, label }));

function RequestStatus({ status }) {
  const submitted = status === 'Pending' || status === 'Blocked';
  const label = submitted ? 'Submitted' : status;
  const tone = { Submitted: 'warning', Approved: 'success', Rejected: 'danger' }[label] || 'neutral';
  return <Badge variant={tone} className="wf-request-status">{label}</Badge>;
}

function RequestTimeline({ status }) {
  const decided = status === 'Approved' || status === 'Rejected';
  const current = decided ? 2 : status ? 1 : 0;
  const stages = ['Created', 'Submitted', decided ? status : 'Decision'];

  return (
    <ol className="wf-request-timeline" aria-label="Request progress">
      {stages.map((label, index) => (
        <li key={label}
          aria-current={index === current ? 'step' : undefined}
          data-reached={index <= current || undefined}
          data-outcome={decided && index === current ? status.toLowerCase() : undefined}
        >
          <span className="wf-request-timeline__dot" aria-hidden="true" />
          {label}
        </li>
      ))}
    </ol>
  );
}

function WorkflowPerson({ person, caption, fallbackName = 'Employee' }) {
  const name = person?.name || fallbackName;
  return (
    <div className="wf-person">
      <span aria-hidden="true"><Avatar name={name} userid={person?.userId || person?.id || person?.userid} src={person?.profile_pic_url} size="sm" /></span>
      <div>
        <strong>{name}</strong>
        {(caption || person?.designation) && (
          <small>
            {caption && <span className="wf-person__role">{caption}</span>}
            {caption && person?.designation && <> &middot; </>}
            {person?.designation}
          </small>
        )}
      </div>
    </div>
  );
}

export function WorkflowInbox({ currentUser, people = [], initialKind = 'attendance', requestKind, initialDate = '', showHeading = !requestKind }) {
  const isAdmin = currentUser?.role === 'company_admin';
  const [view,setView] = useState('mine');
  const [offset,setOffset] = useState(0);
  const [items,setItems] = useState([]);
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [draft,setDraft] = useState({kind:requestKind || initialKind,requester:'',reason:'',date:initialDate,check_in:requestKind ? '' : '09:00',check_out:requestKind ? '' : '18:00',start_date:'',end_date:'',leave_type:''});
  const [showForm,setShowForm] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState(null);
  const [leaveTypesError, setLeaveTypesError] = useState(false);
  const [leaveTypesAttempt, setLeaveTypesAttempt] = useState(0);
  const [selected,setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [remarks,setRemarks] = useState('');
  const [replacement,setReplacement] = useState('');
  const [outgoing,setOutgoing] = useState('');
  const [preview, setPreview] = useState(null);
  const [requestProfiles, setRequestProfiles] = useState(null);
  const requesterId = draft.requester || currentUser?.userid || currentUser?.user_id;
  const { kind, start_date: start, end_date: end } = draft;
  useEffect(() => {
    if (!showForm || kind !== 'leave') return;
    let active = true;
    setLeaveTypes(null);
    setLeaveTypesError(false);
    workflowApi.leaveTypes().then(
      names => { if (active) setLeaveTypes([...new Set(names)].map(name => ({ value: name, label: name }))); },
      () => { if (active) setLeaveTypesError(true); }
    );
    return () => { active = false; };
  }, [showForm, kind, leaveTypesAttempt]);
  const leaveTypeAvailable = leaveTypes?.some(option => option.value === draft.leave_type);
  const previewStart = kind === 'leave' ? start : '';
  const previewEnd = kind === 'leave' ? end : '';
  const canPreview = showForm && requesterId && (!isAdmin || requestKind || draft.requester) && (
    kind !== 'leave' || (previewStart && previewEnd && previewEnd >= previewStart)
  );
  const previewKey = canPreview ? JSON.stringify([requesterId, kind, previewStart, previewEnd]) : '';
  const currentPreview = previewKey && preview?.key === previewKey ? preview : null;
  const previewRoute = currentPreview?.route;
  const selectedId = selected?.request_id;
  useEffect(() => {
    if (!previewKey) return;
    let active = true;
    workflowApi.requestPreview({ requester: requesterId, kind, start_date: previewStart, end_date: previewEnd }).then(
      route => { if (active) setPreview({ key: previewKey, route }); },
      failure => { if (active) setPreview({ key: previewKey, error: failure.message }); }
    );
    return () => { active = false; };
  }, [previewKey, requesterId, kind, previewStart, previewEnd]);
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    workflowApi.requestProfiles(selectedId).then(
      profiles => { if (active) setRequestProfiles({ id: selectedId, profiles }); },
      () => { /* The saved request and directory still provide names and initials. */ }
    );
    return () => { active = false; };
  }, [selectedId]);
  const personById = id => {
    const profile = requestProfiles?.id === selectedId && requestProfiles?.profiles.find(person => person.userId === id);
    return profile || people.find(person => (person.id || person.userid || person.user_id) === id);
  };
  const draftRequester = (!isAdmin || requestKind || draft.requester) && (personById(requesterId) || (!draft.requester ? currentUser : null));
  const detailRef = useRef(null);
  const detailTrigger = useRef(null);
  useEffect(() => { if (selected) detailRef.current?.focus(); }, [selected]);
  const tabs = [
    { id: 'mine', label: 'My requests' },
    { id: 'approvals', label: 'Needs my approval' },
    { id: 'following', label: 'Following / CC' },
    { id: 'all', label: 'Company requests', visible: isAdmin },
    { id: 'audit', label: 'Audit history', visible: isAdmin && !requestKind },
  ];
  function changeView(next) {
    if (next === view) return;
    setItems([]);
    setSelected(null);
    setNotice('');
    setBusy(true);
    setView(next);
    setOffset(0);
  }
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setItems(await (view === 'audit' ? workflowApi.audit(offset) : workflowApi.requests(view,offset,requestKind))); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  },[view,offset,requestKind]);
  useEffect(() => { load(); },[load]);
  const act = async operation => {
    setBusy(true);setError('');setNotice('');
    try { const message = await operation(); setSelected(null);setRemarks('');setNotice(typeof message === 'string' ? message : 'Saved successfully.'); await load(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  async function confirmDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setDeleteError('');
    try {
      await workflowApi.deleteRequest(deleteTarget.request_id);
      setDeleteTarget(null);
      setSelected(previous => previous?.request_id === deleteTarget.request_id ? null : previous);
      setItems(previous => previous.filter(item => item.request_id !== deleteTarget.request_id));
      setNotice('Request deleted.');
      if (items.length === 1 && offset > 0) setOffset(offset - 100);
      else await load();
    } catch (failure) {
      setDeleteError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const updateDraft = (field, value) => setDraft(previous => ({ ...previous, [field]: value }));
  const submit = event => {
    event.preventDefault();
    if (kind === 'leave' && !leaveTypeAvailable) return;
    act(async () => {
      const payload = { reason: draft.reason };
      for (const field of Object.keys(requestFields[kind] || {})) {
        if (field !== 'days') payload[field] = field === 'timezone' ? attendanceTimezone : draft[field];
      }
      const result = kind === 'leave'
        ? await companyRequest('/apply-leave',{ token:localStorage.getItem('pulse_hrms_token'),method:'POST',body:JSON.stringify({userid:requesterId,...payload}) })
        : await workflowApi.submit({kind,requester:requesterId,payload});
      setShowForm(false);
      setDraft(previous => ({...previous,reason:'', ...(requestKind ? { check_in:'', check_out:'' } : {})}));
      const status = kind === 'leave' ? result?.workflow?.status : result?.status;
      return status === 'Blocked'
        ? 'Request saved. An administrator needs to assign an approver.'
        : 'Request submitted for approval.';
    });
  };
  return <div className="wf-inbox">
    {showHeading && <div className="wf-intro"><div><h2>Requests & approvals</h2><p>Manage requests and approval activity.</p></div></div>}
    <div className="wf-inbox-toolbar">
      <ViewTabs label="Request views" tabs={tabs} value={view} onChange={changeView} disabled={busy} />
      <Button onClick={() => { setPreview(null); setShowForm(value => !value); }} disabled={busy} aria-expanded={showForm} variant={showForm ? 'outline' : 'colored'} icon={showForm ? undefined : Send}>
        {showForm ? 'Cancel request' : requestKind ? 'New correction' : 'New request'}
      </Button>
    </div>
    {error && <div className="wf-warning" role="alert">{error}</div>}{notice && <p className="wf-success" role="status">{notice}</p>}
    {showForm && (
      <form className="wf-request-form" onSubmit={submit}>
        <h3>{requestKind ? 'Correct a punch record' : 'New request'}</h3>
        <div className="workspace-grid wf-request-form__layout">
          <div className="wf-request-form__fields">
            {(!requestKind || isAdmin) && <div className="wf-request-form__row">
              {!requestKind && <FormSelect label="Request type" value={kind} options={requestTypeOptions} onChange={value => updateDraft('kind', value)} />}
              {isAdmin && <FormSelect
                label="Employee"
                value={draft.requester}
                required={!requestKind}
                placeholder="Select employee"
                options={[
                  ...(requestKind ? [{ value: '', label: 'My attendance' }] : []),
                  ...people.filter(person => person.status !== 'Inactive').map(person => ({
                    value: person.id || person.userid || person.user_id,
                    label: person.name || [person.first_name, person.last_name].filter(Boolean).join(' '),
                  })),
                ]}
                onChange={value => updateDraft('requester', value)}
              />}
            </div>}
            {(kind === 'attendance' || kind === 'leave') && <div className="wf-request-form__row">
              {kind === 'attendance' ? <>
                <FormField label="Attendance date"><input type="date" required value={draft.date} onChange={event => updateDraft('date', event.target.value)} /></FormField>
                <FormField label="Correct check-in"><input type="time" required value={draft.check_in} onChange={event => updateDraft('check_in', event.target.value)} /></FormField>
                <FormField label="Correct check-out"><input type="time" required value={draft.check_out} onChange={event => updateDraft('check_out', event.target.value)} /></FormField>
              </> : <>
                <FormSelect label="Leave type" required value={draft.leave_type} options={leaveTypes || []}
                  disabled={!leaveTypes?.length}
                  placeholder={leaveTypesError ? 'Leave types unavailable' : !leaveTypes ? 'Loading leave types…' : leaveTypes.length ? 'Select leave type' : 'No active leave types'}
                  onChange={value => updateDraft('leave_type', value)}
                />
                <FormField label="Start date"><input type="date" required max={end || undefined} value={start} onChange={event => updateDraft('start_date', event.target.value)} /></FormField>
                <FormField label="End date"><input type="date" required min={start || undefined} value={end} onChange={event => updateDraft('end_date', event.target.value)} /></FormField>
              </>}
            </div>}
            {kind === 'leave' && leaveTypesError && <p role="alert">Could not load leave types. <Button size="sm" variant="outline" onClick={() => setLeaveTypesAttempt(attempt => attempt + 1)}>Retry</Button></p>}
            <FormField label="Reason"><textarea value={draft.reason} required maxLength={2000} rows={2} onChange={event => updateDraft('reason', event.target.value)} /></FormField>
          </div>
          <div className="wf-approval-route" aria-live="polite">
            <h4><GitBranch size={16} aria-hidden="true" />Approval route</h4>
            {(previewRoute || draftRequester) && (
              <ol className="wf-approval-route__people" aria-label="People in this approval route">
                <li key={requesterId}><WorkflowPerson person={previewRoute?.requester || draftRequester} caption="Requester" /></li>
                {previewRoute?.approvers.map(person => (
                  <li key={person.userId}><WorkflowPerson person={person} caption={person.delegated ? 'Backup approver' : 'Approver'} /></li>
                ))}
              </ol>
            )}
            {previewRoute ? (
              previewRoute.blocked
                ? <p className="wf-approval-route__warning">{previewRoute.blocked}</p>
                : <RequestTimeline />
            ) : <p>{currentPreview?.error || (previewKey ? 'Finding the assigned approver…' : kind === 'leave' && (!isAdmin || draft.requester) ? 'Choose the leave dates to see the approver.' : 'Select an employee to see the approver.')}</p>}
          </div>
          <div className="wf-request-form__actions">
            <Button disabled={busy || !draft.reason.trim() || (isAdmin && !requestKind && !draft.requester) || (kind === 'leave' && !leaveTypeAvailable) || (kind === 'attendance' && (!draft.date || !draft.check_in || !draft.check_out || draft.check_out <= draft.check_in))} type="submit">
              Submit for approval
            </Button>
          </div>
        </div>
      </form>
    )}
    <div className="table-container wf-table-scroll">
      {items.length > 0 ? (
        <table className="table">
          <thead><tr>{view === 'audit' ? (
            <><th scope="col">When</th><th scope="col">Action</th><th scope="col">Actor / details</th></>
          ) : (
            <><th scope="col">Request</th><th scope="col">Status</th><th scope="col">Your role</th><th scope="col">Action</th></>
          )}</tr></thead>
          <tbody>{items.map(item => view === 'audit' ? (
            <tr key={item.audit_id}>
              <td>{new Date(item.created_at).toLocaleString()}</td>
              <td>{item.action}</td>
              <td>
                {people.find(person => (person.id || person.userid) === item.actor_id)?.name || item.actor_id || 'Scheduled system action'}
                <details><summary>View audit details</summary><pre className="wf-audit-json">{JSON.stringify(JSON.parse(item.details), null, 2)}</pre></details>
              </td>
            </tr>
          ) : (
            <tr key={item.request_id}>
              <td>
                <strong>{item.payload.requesterName}</strong>
                <small>{requestTypes[item.kind] || item.kind} &middot; {dateLabel.format(new Date(item.created_at))}</small>
              </td>
              <td>
                <RequestStatus status={item.status} />
                {item.route.blocked && <small>Needs an approver</small>}
              </td>
              <td>{item.canApprove ? 'Action required' : requestRoles[item.role] || item.role}</td>
              <td><div className="wf-request-row-actions">
                <Button size="sm" variant="fadeout" endIcon={ArrowUpRight} disabled={busy} aria-expanded={selected?.request_id === item.request_id} onClick={event => {
                  detailTrigger.current = event.currentTarget;
                  setSelected(item);
                  setRemarks('');
                  setReplacement('');
                  setOutgoing('');
                }}>
                  {item.canApprove ? 'Review' : isAdmin && item.status === 'Blocked' ? 'Assign approver' : 'View details'}
                </Button>
                {item.canDelete && <Button size="sm" variant="fadeout" icon={Trash2} iconOnly disabled={busy} aria-label={`Delete request for ${item.payload.requesterName}`} title="Delete request" onClick={() => { setDeleteError(''); setDeleteTarget(item); }} />}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      ) : <div className="wf-table-empty" role="status">{busy ? 'Loading requests...' : error ? 'Requests are unavailable.' : view === 'audit' ? 'No audit entries yet.' : 'No requests in this view.'}</div>}
    </div>
    {(offset > 0 || items.length === 100) && <div className="wf-pagination">
      <Button size="sm" variant="fadeout" disabled={offset === 0 || busy} onClick={() => setOffset(value => Math.max(0, value - 100))}>Previous</Button>
      <span>Page {offset / 100 + 1}</span>
      <Button size="sm" variant="fadeout" disabled={items.length < 100 || busy} onClick={() => setOffset(value => value + 100)}>Next</Button>
    </div>}
    {selected && <section className="wf-request-detail" ref={detailRef} tabIndex={-1} aria-label="Request details">
      <div className="wf-intro">
        <div>
          <h2>{requestTypes[selected.kind] || selected.kind}</h2>
          <RequestStatus status={selected.status} />
        </div>
        <CloseButton label="Close request details" onClick={() => { setSelected(null); detailTrigger.current?.focus(); }} />
      </div>
      <div className="wf-route-people">
        <WorkflowPerson person={personById(selected.requester_id)} fallbackName={selected.payload.requesterName} caption="Requester" />
        {selected.route.participants.map(person => (
          <WorkflowPerson key={person.userId} person={personById(person.userId)} fallbackName={person.name} caption={person.role === 'approver' ? `Approver, step ${person.step} / ${person.decision}` : requestRoles[person.role]} />
        ))}
      </div>
      <RequestTimeline key={selected.request_id} status={selected.status} />
      <p>{selected.payload.reason || 'Private details are hidden in this view.'}</p>
      <dl>{Object.entries(requestFields[selected.kind] || {}).filter(([key]) => selected.payload[key] != null && selected.payload[key] !== '').map(([key, label]) => (
        <div key={key}><dt>{label}</dt><dd>{String(selected.payload[key])}</dd></div>
      ))}</dl>
      {selected.route.blocked && <p className="wf-warning">{typeof selected.route.blocked === 'string' ? selected.route.blocked : 'Routing needs attention.'}</p>}
      {(selected.canApprove || isAdmin && ['Blocked','Pending'].includes(selected.status)) && <label>Remarks / reassignment reason<textarea value={remarks} maxLength={2000} onChange={event => setRemarks(event.target.value)} /></label>}
      {selected.canApprove && <div className="wf-actions"><Button disabled={busy} onClick={() => act(() => workflowApi.decide(selected.request_id, 'Approved', remarks))} variant="colored" type="submit" wrapContent={false}><Check size={14} />Approve</Button><Button disabled={busy || !remarks.trim()} onClick={() => act(() => workflowApi.decide(selected.request_id, 'Rejected', remarks))} variant="outline" type="submit" wrapContent={false}>Reject with reason</Button></div>}
      {isAdmin && ['Pending','Blocked'].includes(selected.status) && <div className="wf-reassign"><h3>Reassign responsibility</h3><div className="wf-policy-fields">{selected.status === 'Pending' && <label>Replace approver<select value={outgoing} onChange={event => setOutgoing(event.target.value)}><option value="">Select current approver</option>{selected.route.participants.filter(person => person.role === 'approver' && person.decision === 'Pending').map(person => <option key={person.userId} value={person.userId}>{person.name}</option>)}</select></label>}<label>New approver<select value={replacement} onChange={event => setReplacement(event.target.value)}><option value="">Select employee</option>{people.filter(person => (person.id || person.userid) !== selected.requester_id).map(person => <option key={person.id || person.userid} value={person.id || person.userid}>{person.name || person.first_name}</option>)}</select></label></div>{replacement && <WorkflowPerson person={personById(replacement)} caption="New approver" />}<Button disabled={busy || !replacement || !remarks.trim() || selected.status === 'Pending' && !outgoing} onClick={() => act(() => workflowApi.reassign(selected.request_id, {
  userId: replacement,
  fromUserId: outgoing,
  reason: remarks
}))} variant="outline" type="submit" wrapContent={false}>Reassign with audit record</Button></div>}
    </section>}
    <Modal
      isOpen={Boolean(deleteTarget)}
      onClose={() => setDeleteTarget(null)}
      busy={busy}
      title="Delete request?"
      footer={<>
        <Button variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</Button>
        <Button variant="danger" loading={busy} onClick={confirmDelete}>Delete request</Button>
      </>}
    >
      {deleteTarget && <p>The {requestTypes[deleteTarget.kind]?.toLowerCase() || 'request'} for <strong>{deleteTarget.payload.requesterName}</strong> will be permanently deleted.</p>}
      {deleteError && <p className="wf-warning" role="alert">{deleteError}</p>}
    </Modal>
  </div>;
}
