import { SectionSkeleton } from '../../../components/ui/SectionSkeleton';
import { KpiCard } from './KpiCard';
import { TenantPanel } from '../../../components/ui/TenantPanel';
import { ProfileContentSkeleton } from './EmployeeProfileSkeleton';
import React, { useEffect, useRef, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DOSSIER_SECTIONS, normalizeDossier } from '../../../../shared/dossierFields.mjs';
import { talentApi } from '../../../lib/talentApi';
import { documentVaultApi } from '../../../lib/documentVaultApi';
import './DossierEditors.scss';

function SaveForm({ children, onSave, onCancel }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <form className="dossier-inline-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onSave(new FormData(e.currentTarget));}catch(err){setError(err.message);}finally{setBusy(false);}}}><fieldset disabled={busy}>{children}{error&&<p role="alert" className="people-error">{error}</p>}<div className="dossier-actions"><Button type="submit" size="sm" variant="colored" loading={busy}>Save changes</Button>{onCancel&&<Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>}</div></fieldset></form>;
}
const field=(key,title,type='text',required=false,value='')=><label key={key}>{title}<input name={key} type={type} step={type==='number'?'any':undefined} required={required} defaultValue={value??''}/></label>;
export function DossierOverview({ employee, loading = false, editing, onSave, onCancel }) {
  const values=normalizeDossier(employee);
  const layout = useRef({});
  useEffect(() => {
    if (!loading) layout.current = Object.fromEntries(DOSSIER_SECTIONS.map(section => [section.title, section.fields.filter(([key]) => values[key] !== '' && values[key] != null)]));
  }, [employee, loading]);
  const sections=DOSSIER_SECTIONS.map(section=>{
    const available = section.fields.filter(([key]) => values[key] !== '' && values[key] != null);
    const fields = loading ? layout.current[section.title] || (available.length ? available : section.fields.slice(0, 2)) : available;
    return <TenantPanel className="dossier-subsection" key={section.title} title={section.title} headingLevel={3}>
      {editing ? <div className="dossier-form-grid">{section.fields.map(([key,title,type,required])=>key==='status'?<label key={key}>{title}<select name={key} defaultValue={values[key]}><option value="">Not specified</option>{['Active','OnLeave','Probation','Inactive'].map(s=><option key={s}>{s}</option>)}</select></label>:field(key,title,type,required,values[key]))}</div> : <dl className="dossier-fields">
        {fields.map(([key,title])=><div key={key}><dt>{title}</dt><dd><SectionSkeleton loading={loading} mode="skeleton" label={`Loading ${title.toLowerCase()}`}><span>{loading ? 'Loading employee details' : String(values[key])}</span></SectionSkeleton></dd></div>)}
        {!fields.length && <div><dd><SectionSkeleton loading={loading} mode="skeleton"><span className="dossier-muted">Not provided</span></SectionSkeleton></dd></div>}
      </dl>}
    </TenantPanel>;
  });
  return editing?<SaveForm onSave={f=>onSave(Object.fromEntries(f))} onCancel={onCancel}><div className="dossier-overview-grid">{sections}</div></SaveForm>:<div className="dossier-overview-grid">{sections}</div>;
}
export function DossierKpis({ employee, onSave }) {
  const [edit,setEdit]=useState(null), rows=employee.kpi_records||[];
  return <>{edit&&<SaveForm key={edit.id} onCancel={()=>setEdit(null)} onSave={async f=>{const row={...edit,...Object.fromEntries(f),target:Number(f.get('target')),actual:Number(f.get('actual'))};await onSave({kpi_records:[...rows.filter(r=>r.id!==row.id),row]});setEdit(null);}}><div className="dossier-form-grid">{field('title','KPI', 'text',true,edit.title)}{field('period','Period','month',true,edit.period)}{field('unit','Unit','text',false,edit.unit)}{field('target','Target','number',true,edit.target)}{field('actual','Actual','number',true,edit.actual)}</div></SaveForm>}<div className="dossier-records">{rows.map(row => <KpiCard key={row.id} kpi={row} onEdit={setEdit} />)}{!rows.length&&!edit&&<p className="card overview-card dossier-empty dossier-empty-card">No KPIs added.</p>}</div>{!edit&&<div className="dossier-add-action"><Button size="sm" variant="colored" iconOnly icon={<Plus size={22} aria-hidden="true" />} aria-label="Add KPI" title="Add KPI" onClick={() => setEdit({
  id: crypto.randomUUID()
})} /></div>}</>;
}
export { ProfileGoals as DossierGoals } from './ProfileGoals';
export function DossierDocuments({ employee }) {
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[edit,setEdit]=useState(null);
  const reload=()=>documentVaultApi.employee(employee.userid).then(r=>setRows(r.data));
  useEffect(()=>{let active=true;documentVaultApi.employee(employee.userid).then(r=>{if(active)setRows(r.data);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[employee.userid]);
  async function download(row){try{const blob=await documentVaultApi.file(row),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=row.file_name||row.title;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e.message);}}
  return <>{error&&<p role="alert" className="people-error">{error}</p>}<SectionSkeleton loading={loading}>{loading?<ProfileContentSkeleton />:<>{edit&&<SaveForm key={edit.id||edit.document_id||'new'} onCancel={()=>setEdit(null)} onSave={async f=>{const values=Object.fromEntries([...f].filter(([k])=>k!=='file'));if(edit.id||edit.document_id)await documentVaultApi.update(edit.id||edit.document_id,values);else await documentVaultApi.upload(values,f.get('file'),employee.userid);await reload();setEdit(null);}}><div className="dossier-form-grid">{field('title','Title','text',true,edit.title)}{field('category','Category','text',false,(edit.category||edit.doc_type))}{field('document_number','Document number','text',false,edit.document_number)}{field('expiry_date','Expiry date','date',false,edit.expiry_date)}{field('description','Description','text',false,edit.description)}{!edit.id&&!edit.document_id&&<label>File (up to 10 MB)<input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.txt"/></label>}</div></SaveForm>}{rows.map(row=><article className="dossier-record" key={row.id||row.document_id}><h4>{row.title}</h4><p>{row.category} · {row.verified?'Verified':'Needs review'}{row.expiry_date&&` · Expires ${row.expiry_date}`}</p><div className="dossier-actions"><Button size="sm" variant="outline" iconOnly icon={Pencil} aria-label={`Edit ${row.title || 'record'}`} title="Edit record" onClick={() => setEdit(row)} /><Button size="sm" variant="outline" onClick={() => download(row)}>Download</Button></div></article>)}{!rows.length&&!error&&<p className="card overview-card dossier-empty dossier-empty-card">No documents uploaded.</p>}{!edit&&<div className="dossier-add-action"><Button size="sm" variant="colored" iconOnly icon={<Plus size={22} aria-hidden="true" />} aria-label="Upload document" title="Upload document" onClick={() => setEdit({})} /></div>}</>}</SectionSkeleton></>;
}
export { AttendanceRulesEditor as DossierRules } from '../../../components/employees/AttendanceRulesEditor';
