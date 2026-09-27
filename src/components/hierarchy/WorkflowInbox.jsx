import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Send, Check, X } from 'lucide-react';
import { workflowApi } from '../../lib/workflowApi';
import { companyRequest } from '../../lib/companyAuth';
import './WorkflowSettings.scss';
export function WorkflowInbox({ currentUser, people = [], initialKind = 'attendance' }) {
  const isAdmin = currentUser?.role === 'company_admin';
  const [view,setView] = useState('mine');
  const [offset,setOffset] = useState(0);
  const [items,setItems] = useState([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [draft,setDraft] = useState({kind:initialKind,requester:'',reason:'',date:'',check_in:'09:00',check_out:'18:00',timezone:'+05:30',start_date:'',end_date:'',leave_type:'Casual Leave'});
  const [showForm,setShowForm] = useState(false);
  const [selected,setSelected] = useState(null);
  const [remarks,setRemarks] = useState('');
  const [replacement,setReplacement] = useState('');
  const [outgoing,setOutgoing] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setItems(await (view === 'audit' ? workflowApi.audit(offset) : workflowApi.requests(view,offset))); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  },[view,offset]);
  useEffect(() => { load(); },[load]);
  const act = async operation => {
    setBusy(true);setError('');setNotice('');
    try { await operation(); setSelected(null);setRemarks('');setNotice('Saved successfully.'); await load(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  const submit = () => act(async () => {
    const {kind,requester,...payload} = draft;
    if (kind === 'leave') { await companyRequest('/apply-leave',{ token:localStorage.getItem('pulse_hrms_token'),method:'POST',body:JSON.stringify({userid:requester || currentUser.userid,...payload}) }); }
    else await workflowApi.submit({kind,requester:requester || currentUser.userid,payload});
    setShowForm(false);setDraft({...draft,reason:''});
  });
  return <div className="wf-inbox"><div className="wf-intro"><div><h2>Requests & approvals</h2><p>Review assigned requests, follow CC updates, or submit a new request.</p></div><button className="hm-button" onClick={() => setShowForm(value => !value)} disabled={busy}><Send size={14} />New request</button></div>
    <div className="wf-inbox-tabs">{[['mine','My requests'],['approvals','Needs my approval'],['following','Following / CC'],...(isAdmin ? [['all','Company requests'],['audit','Audit history']] : [])].map(([value,label]) => <button key={value} aria-pressed={view === value} onClick={() => {setView(value);setOffset(0);setSelected(null);}}>{label}</button>)}<button aria-label="Refresh requests" onClick={load} disabled={busy}><RefreshCw size={14} /></button></div>
    {error && <div className="wf-warning" role="alert">{error}</div>}{notice && <p className="wf-success" role="status">{notice}</p>}
    {showForm && <div className="wf-request-form"><h3>Submit request</h3><div className="wf-policy-fields"><label>Request type<select value={draft.kind} onChange={event => setDraft({...draft,kind:event.target.value})}><option value="leave">Leave</option><option value="attendance">Attendance correction</option><option value="expense">Expense approval</option><option value="other">Other request</option></select></label>{isAdmin && <label>Employee<select value={draft.requester} onChange={event => setDraft({...draft,requester:event.target.value})}><option value="">Select employee</option>{people.map(person => <option key={person.id || person.userid} value={person.id || person.userid}>{person.name || [person.first_name,person.last_name].filter(Boolean).join(' ')}</option>)}</select></label>}
      {draft.kind === 'attendance' && <><label>Attendance date<input type="date" value={draft.date} onChange={event => setDraft({...draft,date:event.target.value})} /></label><label>Correct check-in<input type="time" value={draft.check_in} onChange={event => setDraft({...draft,check_in:event.target.value})} /></label><label>Correct check-out<input type="time" value={draft.check_out} onChange={event => setDraft({...draft,check_out:event.target.value})} /></label><label>Timezone offset<input placeholder="+05:30" value={draft.timezone} onChange={event => setDraft({...draft,timezone:event.target.value})} /></label></>}
      {draft.kind === 'leave' && <><label>Leave type<input value={draft.leave_type} onChange={event => setDraft({...draft,leave_type:event.target.value})} /></label><label>Start date<input type="date" value={draft.start_date} onChange={event => setDraft({...draft,start_date:event.target.value})} /></label><label>End date<input type="date" value={draft.end_date} onChange={event => setDraft({...draft,end_date:event.target.value})} /></label></>}
    </div><label>Reason / details<textarea value={draft.reason} maxLength={2000} onChange={event => setDraft({...draft,reason:event.target.value})} /></label><button className="hm-button hm-button--primary" disabled={busy || !draft.reason.trim() || (isAdmin && !draft.requester)} onClick={submit}>Submit for approval</button></div>}
    <div className="hm-table-scroll"><table><thead><tr>{view === 'audit' ? <><th>When</th><th>Action</th><th>Actor / details</th></> : <><th>Request</th><th>Status</th><th>Your responsibility</th><th>Details</th></>}</tr></thead><tbody>{items.map(item => view === 'audit' ? <tr key={item.audit_id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.action}</td><td>{people.find(person => (person.id || person.userid) === item.actor_id)?.name || item.actor_id || 'Scheduled system action'}<details><summary>View audit details</summary><pre className="wf-audit-json">{JSON.stringify(JSON.parse(item.details),null,2)}</pre></details></td></tr> : <tr key={item.request_id}><td><strong>{item.payload.requesterName}</strong><small>{item.kind} · {new Date(item.created_at).toLocaleDateString()}</small></td><td><span className="hm-type">{item.status}</span>{item.route.blocked && <small>Needs an approver</small>}</td><td>{item.canApprove ? 'Action required' : item.role}</td><td><button onClick={() => {setSelected(item);setRemarks('');setReplacement('');setOutgoing('');}}>Open</button></td></tr>)}</tbody></table>{!items.length && <div className="hm-table-empty">{busy ? 'Loading…' : 'No requests in this view.'}</div>}</div>
    <div className="wf-pagination"><button className="hm-button" disabled={offset === 0 || busy} onClick={() => setOffset(value => Math.max(0,value-100))}>Previous</button><span>Page {offset/100+1}</span><button className="hm-button" disabled={items.length < 100 || busy} onClick={() => setOffset(value => value+100)}>Next</button></div>
    {selected && <section className="wf-request-detail"><div className="wf-intro"><h2>{selected.payload.requesterName} · {selected.kind}</h2><button className="wf-icon" aria-label="Close request details" onClick={() => setSelected(null)}><X size={16} /></button></div><p>{selected.payload.reason || 'CC summary — private request details are not shared.'}</p><dl>{Object.entries(selected.payload).filter(([key]) => !['reason','requesterName','employee_id'].includes(key)).map(([key,value]) => <div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{String(value)}</dd></div>)}</dl>
      {selected.route.blocked && <div className="wf-warning">{typeof selected.route.blocked === 'string' ? selected.route.blocked : 'Routing needs attention.'}</div>}<div className="wf-preview-people">{selected.route.participants.map(person => <div key={person.userId}><strong>{person.name}</strong><small>{person.role} · step {person.step} · {person.decision}</small></div>)}</div>
      {(selected.canApprove || isAdmin && ['Blocked','Pending'].includes(selected.status)) && <label>Remarks / reassignment reason<textarea value={remarks} maxLength={2000} onChange={event => setRemarks(event.target.value)} /></label>}
      {selected.canApprove && <div className="wf-actions"><button className="hm-button hm-button--primary" disabled={busy} onClick={() => act(() => workflowApi.decide(selected.request_id,'Approved',remarks))}><Check size={14} />Approve</button><button className="hm-button" disabled={busy || !remarks.trim()} onClick={() => act(() => workflowApi.decide(selected.request_id,'Rejected',remarks))}>Reject with reason</button></div>}
      {isAdmin && ['Pending','Blocked'].includes(selected.status) && <div className="wf-reassign"><h3>Reassign responsibility</h3><div className="wf-policy-fields">{selected.status === 'Pending' && <label>Replace approver<select value={outgoing} onChange={event => setOutgoing(event.target.value)}><option value="">Select current approver</option>{selected.route.participants.filter(person => person.role === 'approver' && person.decision === 'Pending').map(person => <option key={person.userId} value={person.userId}>{person.name}</option>)}</select></label>}<label>New approver<select value={replacement} onChange={event => setReplacement(event.target.value)}><option value="">Select employee</option>{people.filter(person => (person.id || person.userid) !== selected.requester_id).map(person => <option key={person.id || person.userid} value={person.id || person.userid}>{person.name || person.first_name}</option>)}</select></label></div><button className="hm-button" disabled={busy || !replacement || !remarks.trim() || selected.status === 'Pending' && !outgoing} onClick={() => act(() => workflowApi.reassign(selected.request_id,{userId:replacement,fromUserId:outgoing,reason:remarks}))}>Reassign with audit record</button></div>}
    </section>}
  </div>;
}
