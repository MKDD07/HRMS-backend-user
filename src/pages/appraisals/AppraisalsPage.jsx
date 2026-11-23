import { TenantPanel } from '../../components/ui/TenantPanel';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { UniversalSearch } from '../../components/ui/UniversalSearch';
import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { CalendarDays as MiCalendarDays, ClipboardClock as MiClipboardClock, FileCheck as MiFileCheck, CheckCheck as MiCheckCheck } from 'lucide-react';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { TenantHeader } from '../../components/ui/TenantHeader';
import React,{useCallback,useEffect,useState} from 'react';
import { Plus, Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { appraisalApi } from '../../lib/appraisalApi';
import { downloadTalentCsv } from '../../lib/talentApi';
import { BANDS, bandFor, distributionTargets } from '../../../shared/appraisalModel.mjs';
import { TemplateEditor, CycleEditor, ReviewDialog, localInstant } from './AppraisalEditors';
import { AppraisalReview } from './AppraisalReview';
import '../talent/TalentWorkspace.scss';
import './AppraisalsPage.scss';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { Avatar } from '../../components/ui/Avatar';

import { ArrowUpRight, Users } from 'lucide-react';
export function AppraisalsPage({onShowToast}) {
  const [context,setContext]=useState(null),[cycles,setCycles]=useState([]),[templates,setTemplates]=useState([]),[reviews,setReviews]=useState([]),[roles,setRoles]=useState([]),[audit,setAudit]=useState([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tab,setTab]=useState('reviews'),[cycleId,setCycleId]=useState(''),[search,setSearch]=useState(''),[view,setView]=useState('all'),[version,setVersion]=useState(0);
  const [editor,setEditor]=useState(null),[selected,setSelected]=useState(''),[scope,setScope]=useState(null),[newDeadline,setNewDeadline]=useState(new Date(Date.now()+7*86400000).toISOString()),[reason,setReason]=useState(''),[auditOffset,setAuditOffset]=useState(0);
  const [auditLoading,setAuditLoading]=useState(false);
  const [employeeId,setEmployeeId]=useState('');
  const reload=useCallback(()=>setVersion(v=>v+1),[]);
  useEffect(()=>{let alive=true;setLoading(true);setError('');(async()=>{const ctx=await appraisalApi.get('context');const values=await Promise.all([appraisalApi.get('cycles'),appraisalApi.get('reviews'+(cycleId?'?cycle='+encodeURIComponent(cycleId):'')),ctx.hr?appraisalApi.get('templates'):Promise.resolve([]),ctx.admin?appraisalApi.get('roles'):Promise.resolve([])]);if(alive){setContext(ctx);setCycles(values[0]);setReviews(values[1]);setTemplates(values[2]);setRoles(values[3]);}})().catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[cycleId,version]);
  useEffect(()=>{if(tab!=='audit'||!context?.hr)return;let alive=true;setAuditLoading(true);appraisalApi.get('audit?offset='+auditOffset).then(v=>{if(alive)setAudit(v);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setAuditLoading(false);});return()=>{alive=false;};},[tab,auditOffset,version,context?.hr]);
  async function run(fn){setBusy(true);setError('');try{await fn();reload();onShowToast?.({type:'success',title:'Appraisal updated',message:'Changes saved.'});}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function saveTemplate(value){await appraisalApi.post('templates'+(value.id?'/'+value.id:''),value);setEditor(null);reload();}
  async function saveCycle(value){await appraisalApi.post('cycles'+(value.id?'/'+value.id:''),value);setEditor(null);reload();}
  const cycle=cycles.find(c=>c.id===cycleId),filtered=reviews.filter(r=>(!employeeId || r.employee_id === employeeId)&&(view==='all'||view==='mine'&&r.access.own||view==='team'&&r.access.manager||view==='peer'&&r.access.peer)&&`${r.employee_name} ${r.manager_name} ${r.status}`.toLowerCase().includes(search.toLowerCase()));
  const target=cycle?.template_snapshot?distributionTargets(reviews.length,cycle.template_snapshot.distribution):null;
  const directoryPeople = (context?.directory || []).map(person => ({ ...person, userid: person.user_id }));
  const employee = directoryPeople.find(person => person.userid === employeeId);
  const directory = <EmployeeDirectory className="appraisal-directory" employees={directoryPeople} selectedId={employeeId} onSelect={person => { setEmployeeId(person.userid); setSelected(''); setTab('reviews'); setSearch(''); setView('all'); }} loading={loading && !context} error={error && !context ? error : ''} onRefresh={reload} pageSize={6} subtitle="Choose an employee to explore their reviews and progress." renderMeta={person => { const assigned = reviews.filter(review => review.employee_id === person.userid); return <span className="appraisal-directory-meta">{assigned.length} review{assigned.length === 1 ? '' : 's'} / {assigned.filter(review => !['Published','Closed'].includes(review.status)).length} in progress</span>; }} headerAction={employeeId && <Button variant="fadeout" size="sm" onClick={() => setEmployeeId('')}>All</Button>} />;
  if(selected&&context)return <div className="talent-workspace appraisal-workspace"><div className="workspace-grid appraisal-layout"><main className="appraisal-main"><AppraisalReview key={selected} id={selected} context={context} onBack={()=>setSelected('')} onChanged={reload}/></main>{directory}</div></div>;
  return <div className="talent-workspace appraisal-workspace"><TenantHeader
        settings={{
          subheading: "GROWTH & PERFORMANCE",
          heading: "Appraisal Reviews",
          paragraph: (context?.hr?'Manage review cycles, calibration, outcomes, and publication.':'Complete your review, review your direct reports, and view published outcomes.'),
          buttons: [
            { id: 'action1', label: "New cycle", variant: "colored" },
            { id: 'action2', label: "New template", variant: "colored" }
          ]
        }}
        actions={{
          action1: { "icon": Plus, "disabled": loading||busy||!templates.length, "onClick": ()=>setEditor({kind:'cycle'}), visible: !!(context?.hr&&tab==='cycles') },
          action2: { "icon": Plus, "disabled": loading||busy, "onClick": ()=>setEditor({kind:'template'}), visible: !!(context?.admin&&tab==='templates') }
        }}
      />
    {error&&<div className="talent-alert" role="alert">{error}<Button variant="outline" onClick={reload}>Retry</Button></div>}

    <ViewTabs value={tab} label="Appraisal sections" onChange={value => {setTab(value);setError('');}} tabs={[{id:'reviews',label:'Reviews'},...(context?.hr?[{id:'cycles',label:'Review cycles'},{id:'calibration',label:'Calibration'},{id:'templates',label:'Templates'},{id:'audit',label:'Audit trail'}]:[]),...(context?.admin?[{id:'access',label:'HR access'}]:[])]} />
    <MetricOverview loading={loading}>{[['Cycles',cycles.length],['Pending reviews',reviews.filter(r=>!['Finalize','Published','Closed'].includes(r.status)).length],['Ready to publish',reviews.filter(r=>r.status==='Finalize').length],['Acknowledged',reviews.filter(r=>r.acknowledged_at).length]].map(([label,value], index)=><MetricCard key={label} label={label} icon={[MiCalendarDays, MiClipboardClock, MiFileCheck, MiCheckCheck][index]} value={loading||error?'—':value} caption={['Available review cycles','Feedback still in progress','Finalized and awaiting publication','Published outcomes acknowledged'][index]} />)}</MetricOverview>
    <div className={'workspace-grid appraisal-layout' + (!['reviews','calibration'].includes(tab) ? ' appraisal-layout--full' : '')}><main className="appraisal-main">
    {employee && ['reviews','calibration'].includes(tab) && <TenantPanel className="appraisal-panel" title={employee.name || [employee.first_name,employee.last_name].filter(Boolean).join(' ')} subtitle={[employee.designation,employee.department].filter(Boolean).join(' / ')} icon={Users} controls={<Button variant="fadeout" size="sm" onClick={() => setEmployeeId('')}>All employees</Button>} />}
    <SectionSkeleton loading={loading && !context}>{loading && !context?<TenantPanel className="appraisal-panel talent-empty" role="status" title="Appraisal reviews">Loading appraisal workspace…</TenantPanel>:error&&!context?null:<>
      {['reviews','calibration'].includes(tab)&&<TenantPanel className="appraisal-panel" title="Appraisal reviews"><div className="talent-toolbar"><div className="talent-actions"><label><span>Cycle</span><select aria-label="Filter cycle" value={cycleId} onChange={e=>setCycleId(e.target.value)}><option value="">All cycles</option>{cycles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label><span>Reviews</span><select aria-label="Review assignment" value={view} onChange={e=>setView(e.target.value)}><option value="all">All accessible reviews</option><option value="mine">My reviews</option><option value="team">Direct reports</option><option value="peer">Peer assignments</option></select></label></div><Button variant="outline" icon={Download} disabled={!filtered.length} onClick={() => downloadTalentCsv('appraisal-reviews.csv', ['Employee', 'Manager', 'Stage', 'Self score', 'Manager score', 'Final score', 'Acknowledged'], filtered.map(r => [r.employee_name, r.manager_name, r.status, r.scores?.self_score ?? '', r.scores?.manager_score ?? '', r.scores?.final_score ?? '', r.acknowledged_at || '']))}>Export CSV</Button></div><div className="talent-filters"><UniversalSearch scope="appraisals" variant="outlined" value={search} onChange={setSearch} label="Search appraisals" placeholder="Search employee, manager or stage..." showKeyboardHint={false} /></div>
      {tab==='calibration'&&<div className="talent-editor-body"><h2>Rating distribution</h2><p className="talent-hint">Compare evidence and ratings across employees. Any adjustment needs an HR reason. {cycle?.enforce_distribution?'This cycle requires the exact target distribution before publishing.':'Distribution targets are advisory unless enabled for the cycle.'}</p><MetricOverview aria-label="Rating distribution">{BANDS.map(b=><MetricCard key={b} label={b} icon={MiFileCheck} value={reviews.filter(r=>r.scores?.final_score!=null&&bandFor(r.scores.final_score)===b).length} caption={target ? target[b]+' target reviews' : 'Reviews in this rating band'} />)}</MetricOverview>{!cycle&&<p>Select one cycle to see its target distribution.</p>}</div>}
      <SectionSkeleton loading={loading}>{!filtered.length?<div className="talent-empty"><h3>No reviews in this view</h3><p>{context?.hr?'Create a template and launch a scoped cycle to generate reviews.':'Your reviews and peer assignments appear here after HR launches a cycle.'}</p></div>:<div className="talent-table-scroll"><table><thead><tr><th>Employee</th><th>Manager</th><th>Stage</th><th>Self</th><th>Manager</th><th>Final</th><th>Deadline</th><th>Action</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><div className="appraisal-employee-cell"><Avatar name={r.employee_name} userid={r.employee_id} size="sm"/><div><strong>{r.employee_name}</strong><small>{cycles.find(c => c.id === r.cycle_id)?.name}</small></div></div></td><td>{r.manager_name}{r.manager_changed&&<small>Reassignment needed</small>}</td><td><StatusBadge status={r.status} />{r.acknowledged_at&&<small>Acknowledged</small>}</td>{['self_score','manager_score','final_score'].map(k=><td key={k}>{r.scores?.[k]!=null?Number(r.scores[k]).toFixed(2):'—'}</td>)}<td>{r.deadline?new Date(r.deadline).toLocaleString():'—'}</td><td><Button variant="fadeout" size="sm" icon={ArrowUpRight} aria-label={`Open review for ${r.employee_name}`} onClick={() => setSelected(r.id)}>Review</Button></td></tr>)}</tbody></table></div>}</SectionSkeleton></TenantPanel>}
      {tab==='cycles'&&context?.hr&&<TenantPanel className="appraisal-panel" title={<>Review cycles</>}>{!templates.length&&<div className="talent-empty">A company administrator must create a template before you can set up a cycle.</div>}<SectionSkeleton loading={loading}>{!cycles.length?<div className="talent-empty">No cycles yet. Create a draft to configure scope and deadlines.</div>:<div className="talent-table-scroll"><table><thead><tr><th>Cycle</th><th>Period</th><th>Dates</th><th>Status</th><th>Actions</th></tr></thead><tbody>{cycles.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small>{c.peer_enabled?'Includes peer / 360':'Self and manager reviews'}</small></td><td>{c.period}</td><td>{c.start_date} – {c.end_date}</td><td><StatusBadge status={c.status} /></td><td><div className="talent-actions">{c.status==='Draft'&&<><Button variant="fadeout" size="sm" onClick={() => setEditor({
  kind: 'cycle',
  record: c
})}>Edit</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => run(async () => setScope({
  cycle: c,
  people: await appraisalApi.get(`cycles/${c.id}/scope`)
}))}>Preview scope & launch</Button></>}{c.status==='Launched'&&<><Button size="sm" disabled={busy} onClick={() => run(() => appraisalApi.post(`cycles/${c.id}/publish`, {
  revision: c.revision
}))}>Publish finalized results</Button><Button variant="outline" size="sm" onClick={() => {
  setEditor({
    kind: 'publication',
    record: c
  });
  setReason('');
}}>Extend publish deadline</Button></>}{c.status==='Published'&&<Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => appraisalApi.post(`cycles/${c.id}/close`, {
  revision: c.revision
}))}>Close & archive</Button>}<Button variant="fadeout" size="sm" onClick={() => {
  setCycleId(c.id);
  setTab('reviews');
}}>Reviews</Button></div></td></tr>)}</tbody></table></div>}</SectionSkeleton></TenantPanel>}
      {tab==='templates'&&context?.hr&&<TenantPanel className="appraisal-panel" title={<>Review templates</>}><SectionSkeleton loading={loading}>{templates.length?<div className="talent-table-scroll"><table><thead><tr><th>Template</th><th>Sections</th><th>Scale</th><th>Revision</th><th>Action</th></tr></thead><tbody>{templates.map(t=><tr key={t.id}><td>{t.name}</td><td>{t.sections.map(s=>`${s.name} (${s.weight}%)`).join(', ')}</td><td>1–5</td><td>{t.revision+1}</td><td>{context.admin?<Button variant="outline" size="sm" onClick={() => setEditor({
  kind: 'template',
  record: t
})}>Edit</Button>:'Admin-managed'}</td></tr>)}</tbody></table></div>:<div className="talent-empty">No templates yet. Create competencies and goal sections with weights totaling 100%.</div>}</SectionSkeleton></TenantPanel>}
      {tab==='access'&&context?.admin&&<TenantPanel className="appraisal-panel" title={<>HR access</>}><div className="talent-editor-body"><p className="talent-hint">Employees can access their own reviews. Managers can review only assigned direct reports. Grant HR access for cycle management, calibration, publishing, and audit. Company administrators manage templates and these permissions.</p></div><div className="talent-table-scroll"><table><thead><tr><th>Employee</th><th>Department</th><th>Appraisal access</th><th>Action</th></tr></thead><tbody>{context.directory.filter(p=>p.user_id!==context.user_id).map(p=>{const hr=roles.some(r=>r.user_id===p.user_id);return <tr key={p.user_id}><td>{p.name}</td><td>{p.department}</td><td><StatusBadge status={hr ? 'HR' : 'Employee / reporting manager'} variant={hr ? 'info' : 'neutral'} /></td><td><Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => appraisalApi.post('roles', {
  user_id: p.user_id,
  role: hr ? 'employee' : 'hr'
}))}>{hr?'Remove HR access':'Grant HR access'}</Button></td></tr>;})}</tbody></table></div></TenantPanel>}
      {tab==='audit'&&context?.hr&&<TenantPanel className="appraisal-panel" title={<>Audit trail</>} controls={<><div className="talent-actions"><Button variant="outline" disabled={auditLoading || !auditOffset} onClick={() => setAuditOffset(Math.max(0, auditOffset - 100))}>Previous</Button><Button variant="outline" disabled={auditLoading || audit.length < 100} onClick={() => setAuditOffset(auditOffset + 100)}>Next</Button></div></>}><div className="talent-editor-body appraisal-audit"><SectionSkeleton loading={auditLoading}>{audit.length?audit.map(a=><details key={a.id}><summary>{new Date(a.created_at).toLocaleString()} · {a.action} · {context.directory.find(p=>p.user_id===a.actor_id)?.name||a.actor_id}</summary><p>{a.entity_type} / {a.entity_id}</p><pre>{JSON.stringify({before:a.before_data?JSON.parse(a.before_data):null,after:a.after_data?JSON.parse(a.after_data):null},null,2)}</pre></details>):<p>No audit events yet.</p>}</SectionSkeleton></div></TenantPanel>}
    </>}</SectionSkeleton>
    </main>{['reviews','calibration'].includes(tab) && directory}</div>
    {editor?.kind==='template'&&<TemplateEditor record={editor.record} onClose={()=>setEditor(null)} onSave={saveTemplate}/>}
    {editor?.kind==='cycle'&&<CycleEditor record={editor.record} templates={templates} people={context.directory} onClose={()=>setEditor(null)} onSave={saveCycle}/>}
    {editor?.kind==='publication'&&<ReviewDialog title="Reopen publication deadline" busy={busy} onClose={()=>setEditor(null)}><div className="talent-editor-body"><label><span>New publication deadline</span><input type="datetime-local" value={localInstant(newDeadline)} onChange={e=>setNewDeadline(e.target.value?new Date(e.target.value).toISOString():'')}/></label><label><span>Reason</span><textarea maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}</div><footer><Button disabled={busy} onClick={() => run(async () => {
  await appraisalApi.post(`cycles/${editor.record.id}/reopen-publication`, {
    revision: editor.record.revision,
    deadline: newDeadline,
    reason
  });
  setEditor(null);
})}>Save deadline</Button></footer></ReviewDialog>}
    {scope&&<ReviewDialog title={`Launch ${scope.cycle.name}`} busy={busy} onClose={()=>setScope(null)}><div className="talent-editor-body"><p>{scope.people.length} eligible employee(s). Launching creates reviews and sends in-app notifications to employees and managers.</p><div className="talent-table-scroll"><table><thead><tr><th>Employee</th><th>Department</th><th>Manager</th><th>Ready</th></tr></thead><tbody>{scope.people.map(p=><tr key={p.user_id}><td>{p.name}</td><td>{p.department}</td><td>{context.directory.find(m=>m.user_id===p.manager_id)?.name||'Missing / ambiguous'}</td><td><StatusBadge status={p.ready ? 'Ready' : 'Manager required'} variant={p.ready ? 'success' : 'warning'} /></td></tr>)}</tbody></table></div>{error&&<p role="alert">{error}</p>}</div><footer><Button variant="outline" disabled={busy} onClick={() => setScope(null)}>Cancel</Button><Button disabled={busy || !scope.people.length || scope.people.some(p => !p.ready)} onClick={() => run(async () => {
  await appraisalApi.post(`cycles/${scope.cycle.id}/launch`, {
    revision: scope.cycle.revision
  });
  setScope(null);
})}>Launch cycle</Button></footer></ReviewDialog>}
  </div>;
}
