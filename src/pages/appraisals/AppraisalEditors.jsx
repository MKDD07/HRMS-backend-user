import { ModalFrame } from '../../components/ui/Modal';
import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { BANDS, newReviewTemplate } from '../../../shared/appraisalModel.mjs';
export function ReviewDialog({title,onClose,children,busy=false}) {
  const ref=useRef(null);useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>previous?.focus?.();},[]);
  return <ModalFrame ref={ref} className="talent-dialog appraisal-dialog" aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><header><h2>{title}</h2><Button iconOnly icon={X} variant="fadeout" aria-label="Close" disabled={busy} onClick={onClose} /></header>{children}</ModalFrame>;
}
export const localInstant=value=>{if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const iso=value=>value?new Date(value).toISOString():'';
export function TemplateEditor({record,onClose,onSave}) {
  const [draft,setDraft]=useState(()=>structuredClone(record||newReviewTemplate())),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const section=(id,values)=>setDraft(old=>({...old,sections:old.sections.map(s=>s.id===id?{...s,...values}:s)}));
  async function save(e){e.preventDefault();setBusy(true);setError('');try{await onSave(draft);}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <ReviewDialog title={record?'Edit review template':'Create review template'} onClose={onClose} busy={busy}><form onSubmit={save}><div className="talent-editor-body">{error&&<p className="talent-alert" role="alert">{error}</p>}<label><span>Template name *</span><input required maxLength={120} value={draft.name} disabled={busy} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><p className="talent-hint">Rating scale: 1–5. Each section averages its questions, then contributes its percentage weight. Launched cycles retain a snapshot of their template.</p>
    {draft.sections.map((s,index)=><section key={s.id} className="talent-subform"><div className="talent-form-grid"><label><span>Section {index+1} *</span><input required maxLength={200} disabled={busy} value={s.name} onChange={e=>section(s.id,{name:e.target.value})}/></label><label><span>Weight % *</span><input type="number" min="0.01" max="100" step="0.01" required disabled={busy} value={s.weight} onChange={e=>section(s.id,{weight:Number(e.target.value)})}/></label></div>{s.questions.map((q,i)=><div className="appraisal-question-editor" key={q.id}><label><span>Question / KRA {i+1} *</span><input required maxLength={600} disabled={busy} value={q.text} onChange={e=>section(s.id,{questions:s.questions.map(old=>old.id===q.id?{...old,text:e.target.value}:old)})}/></label><Button variant="fadeout" iconOnly icon={X} aria-label={`Remove question ${i + 1}`} disabled={busy || s.questions.length === 1} onClick={() => section(s.id, {
  questions: s.questions.filter(old => old.id !== q.id)
})} /></div>)}<div className="talent-actions"><Button variant="outline" size="sm" icon={Plus} disabled={busy || s.questions.length >= 20} onClick={() => section(s.id, {
  questions: [...s.questions, {
    id: crypto.randomUUID(),
    text: ''
  }]
})}>Add question</Button><Button variant="fadeout" size="sm" disabled={busy || draft.sections.length === 1} onClick={() => setDraft({
  ...draft,
  sections: draft.sections.filter(old => old.id !== s.id)
})}>Remove section</Button></div></section>)}<div className="talent-actions"><Button variant="outline" disabled={busy || draft.sections.length >= 10} onClick={() => setDraft({
  ...draft,
  sections: [...draft.sections, {
    id: crypto.randomUUID(),
    name: '',
    weight: 10,
    questions: [{
      id: crypto.randomUUID(),
      text: ''
    }]
  }]
})}>Add section</Button><strong>Total weight: {draft.sections.reduce((sum,s)=>sum+s.weight,0)}%</strong></div>
    <section className="talent-subform"><h3>Rating bands and suggested increments</h3><p className="talent-hint">Suggestions require an HR decision at finalization. Distribution targets apply only when the cycle explicitly enables them.</p><div className="talent-table-scroll"><table><thead><tr><th>Band</th><th>Score</th><th>Increment %</th><th>Distribution %</th></tr></thead><tbody>{BANDS.map((band,i)=><tr key={band}><td>{band}</td><td>{['≥ 4.5','≥ 3.5 and < 4.5','≥ 2.5 and < 3.5','< 2.5'][i]}</td>{['increments','distribution'].map(key=><td key={key}><input aria-label={`${band} ${key}`} type="number" min="0" max="100" step="0.01" required disabled={busy} value={draft[key][band]} onChange={e=>setDraft({...draft,[key]:{...draft[key],[band]:Number(e.target.value)}})}/></td>)}</tr>)}</tbody></table></div></section>
  </div><footer><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save template</Button></footer></form></ReviewDialog>;
}
export function CycleEditor({record,templates,people,onClose,onSave}) {
  const [draft,setDraft]=useState(()=>record?structuredClone(record):{name:'',period:'Annual',start_date:`${new Date().getFullYear()}-01-01`,end_date:`${new Date().getFullYear()}-12-31`,template_id:templates[0]?.id||'',scope:{departments:[],designations:[],employees:[],exclude_probation:true,joined_before:''},deadlines:Object.fromEntries(['self','manager','peer','calibration','publish'].map((key,i)=>[key,new Date(Date.now()+(i+1)*7*86400000).toISOString()])),peer_enabled:false,enforce_distribution:false,reminder_hours:24,escalation_hours:48});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const change=(key,value)=>setDraft(old=>({...old,[key]:value}));
  async function save(e){e.preventDefault();setBusy(true);setError('');try{await onSave(draft);}catch(e){setError(e.message);}finally{setBusy(false);}}
  const scopes=[['departments','Departments',[...new Set(people.map(p=>p.department).filter(Boolean))].map(value=>({value,label:value}))],['designations','Designations',[...new Set(people.map(p=>p.designation).filter(Boolean))].map(value=>({value,label:value}))],['employees','Employees',people.map(p=>({value:p.user_id,label:p.name}))]];
  return <ReviewDialog title={record?'Edit review cycle':'Create review cycle'} onClose={onClose} busy={busy}><form onSubmit={save}><div className="talent-editor-body">{error&&<p className="talent-alert" role="alert">{error}</p>}<div className="talent-form-grid"><label><span>Cycle name *</span><input required maxLength={120} disabled={busy} value={draft.name} onChange={e=>change('name',e.target.value)}/></label><label><span>Period</span><select value={draft.period} disabled={busy} onChange={e=>change('period',e.target.value)}>{['Annual','Half-yearly','Quarterly'].map(v=><option key={v}>{v}</option>)}</select></label>{[['start_date','Review period starts'],['end_date','Review period ends']].map(([key,label])=><label key={key}><span>{label} *</span><input type="date" required disabled={busy} value={draft[key]} onChange={e=>change(key,e.target.value)}/></label>)}<label className="talent-full"><span>Review template *</span><select required disabled={busy} value={draft.template_id} onChange={e=>change('template_id',e.target.value)}><option value="">Select template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name} · revision {t.revision+1}</option>)}</select></label></div>
    <section className="talent-subform"><h3>Employee scope</h3><p className="talent-hint">Empty filters include everyone. When multiple filters are selected, employees must match all filters. Use Ctrl/Cmd to select multiple options.</p><div className="talent-form-grid">{scopes.map(([key,label,options])=><label key={key}><span>{label}</span><select multiple size={5} value={draft.scope[key]} disabled={busy} onChange={e=>change('scope',{...draft.scope,[key]:Array.from(e.target.selectedOptions,o=>o.value)})}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}<label><span>Joined on or before</span><input type="date" disabled={busy} value={draft.scope.joined_before} onChange={e=>change('scope',{...draft.scope,joined_before:e.target.value})}/></label></div><label className="appraisal-check"><input type="checkbox" checked={draft.scope.exclude_probation} disabled={busy} onChange={e=>change('scope',{...draft.scope,exclude_probation:e.target.checked})}/>Exclude probationers</label></section>
    <section className="talent-subform"><h3>Stages and deadlines</h3><label className="appraisal-check"><input type="checkbox" checked={draft.peer_enabled} disabled={busy} onChange={e=>change('peer_enabled',e.target.checked)}/>Include anonymous peer / 360 feedback (at least 3 peers per review)</label><div className="talent-form-grid">{[['self','Self-review'],['manager','Manager review'],...(draft.peer_enabled?[['peer','Peer / 360']]:[]),['calibration','Calibration and finalization'],['publish','Publish']].map(([key,label])=><label key={key}><span>{label} deadline *</span><input required type="datetime-local" disabled={busy} value={localInstant(draft.deadlines[key])} onChange={e=>change('deadlines',{...draft.deadlines,[key]:iso(e.target.value)})}/></label>)}{[['reminder_hours','Remind before deadline (hours)'],['escalation_hours','Escalate after deadline (hours)']].map(([key,label])=><label key={key}><span>{label}</span><input type="number" min="1" max="720" required disabled={busy} value={draft[key]} onChange={e=>change(key,Number(e.target.value))}/></label>)}</div><p className="talent-hint">Deadlines are entered in your local timezone and stored as exact timestamps. Overdue stages lock until HR reopens them.</p></section><label className="appraisal-check"><input type="checkbox" checked={draft.enforce_distribution} disabled={busy} onChange={e=>change('enforce_distribution',e.target.checked)}/>Require the template’s rating distribution before publishing</label>
    </div><footer><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save draft cycle</Button></footer></form></ReviewDialog>;
}
