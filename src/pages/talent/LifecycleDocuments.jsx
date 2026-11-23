import { Users as MiUsers, FileClock as MiFileClock, FileCheck as MiFileCheck, Send as MiSend } from 'lucide-react';
import { AsterAssistant } from '../../components/ui/AsterAssistant';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { ModalFrame } from '../../components/ui/Modal';
import { TenantPanelHeader } from '../../components/ui/TenantPanel';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Printer, Download, X, FileText, Settings2, ArrowUpRight, Search, CheckCircle2, Clock3, Mail } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { profileImage } from '../employees/EmployeesPage/directoryData';
import { talentApi } from '../../lib/talentApi';
import { DOCUMENT_TYPES, documentText, markdownBlocks, defaultContent, mergeContent, probationEnd, documentHtml, documentFields, missingFields, employeeFields, reusableContent, paperCounts, hasBodyContent } from '../../../shared/lifecycleDocuments.mjs';
import { DocumentBlocks, letterFromHtml } from './DocumentBlocks';
import { ConfirmDialog, LetterSettings } from './LetterSettings';
import { printDocument, downloadWord } from '../../lib/documentExport';
import './LifecycleDocuments.scss';
import { departmentTheme } from '../../lib/departmentTheme';

const nameOf = p => [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.name || p?.userid || 'Employee';
const dateLabel = value => value ? new Date(value.slice(0,10) + 'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : 'Not set';
const emptyDoc = text => ({ type:'doc', content:[{type:'paragraph',content:text?[{type:'text',text}]:[]}] });
function customContent(brand) { return { mode:'custom', header:emptyDoc(brand.company_name || ''), body:emptyDoc(''), footer:emptyDoc(brand.signatory || ''), branding:brand }; }
function LetterInput({ field, disabled, onChange }) {
  const multiline=/purpose|details|terms|reason|assessment|recommendation|decision|objectives|tools|address/.test(field.key)||field.value.length>120;
  const props={value:field.value,disabled,onChange:e=>onChange(e.target.value),placeholder:`Enter ${field.label.toLowerCase()}`};
  return <label>{field.label}{multiline?<textarea {...props} rows={2}/>:<input {...props} type={/(_date|_deadline)$/.test(field.key)?'date':'text'}/>}</label>;
}

function TemplateNameDialog({ onSave, onClose, title }) {
  const ref=useRef(null), [name,setName]=useState(title), [busy,setBusy]=useState(false), [error,setError]=useState('');
  useEffect(()=>{ref.current.showModal();},[]);
  return <ModalFrame size="sm" ref={ref} className="letter-confirm" aria-labelledby="template-name-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await onSave(name.trim());onClose();}catch(err){setError(err.message);}finally{setBusy(false);}}}><h2 id="template-name-title">Save as company template</h2><p>It will appear beside the premade letters for everyone with access. Named employee fields are cleared; review any employee-specific text you wrote directly.</p><label>Template name<input autoFocus required maxLength={300} value={name} disabled={busy} onChange={e=>setName(e.target.value)} /></label>{error&&<p role="alert" className="talent-alert">{error}</p>}<div><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save template</Button></div></form></ModalFrame>;
}

function DocumentEditor({ record, template, page, people, plans, templates, branding, onClose, onSaved }) {
  const [draft,setDraft]=useState(record), [content,setContent]=useState(()=>{
    const parsed=JSON.parse(record.content);if(record.status==='Finalized'&&!template)return parsed;
    const companyValues=Object.fromEntries(['company_name','company_address','signatory','signatory_role'].filter(key=>branding[key]).map(key=>[key,branding[key]]));
    return {...mergeContent(parsed,companyValues),branding:Object.keys(branding).length?branding:parsed.branding||{}};
  });
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [preview,setPreview]=useState(false), [dirty,setDirty]=useState(()=>!record.id||(!(record.status==='Finalized'&&!template)&&JSON.stringify(content)!==record.content)), [confirmation,setConfirmation]=useState(null), [saveTemplate,setSaveTemplate]=useState(false);
  const dialog=useRef(null), wordInput=useRef(null);
  const [importNotice,setImportNotice]=useState('');
  useEffect(()=>{dialog.current.showModal();},[]);
  useEffect(()=>{const warn=e=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const final=!template&&draft.status==='Finalized', custom=content.mode==='custom', fields=documentFields(content), missing=missingFields(content);
  const employee=people.find(p=>p.userid===draft.employee_id), plan=plans.find(p=>p.employee_id===draft.employee_id&&p.status!=='Cancelled')||{};
  const brand=content.branding||{};
  function change(key,value){setDirty(true);setDraft(old=>({...old,[key]:value}));}
  const close=()=>{if(!busy)setConfirmation({ action:onClose, title:'Close this document?', message:dirty?'You have unsaved changes. Save your draft before leaving, or discard the changes.':'Your saved document will remain available in the employee workspace.', label:dirty?'Discard and close':'Close document' });};
  function choose(choice) {
    const apply=()=>{
      const saved=choice.startsWith('saved:')?templates.find(t=>t.id===choice.slice(6)):null;
      const entry=DOCUMENT_TYPES[page].find(t=>t[0]===choice.replace('builtin:',''));
      let next=saved?mergeContent(JSON.parse(saved.content),{}):entry?defaultContent(entry[1],entry[2]):customContent(branding);
      next={...next,branding,templateChoice:choice};
      if(!template&&next.mode!=='custom') next=mergeContent(next,{...employeeFields(employee,page==='onboarding'?plan:{},branding),...(page==='offboarding'?{notice_date:plan.start_date||'',last_working_date:plan.due_date||''}:{})});
      setContent(next);setDraft(old=>({...old,title:saved?.title||entry?.[1]||'Custom document',kind:saved?.kind||entry?.[0]||'custom'}));setDirty(true);setPreview(false);
    };
    if(dirty)setConfirmation({action:apply,title:'Replace this document?',message:'Changing the starting template replaces the current content. Save your draft first if you want to keep it.',label:'Replace content'});else apply();
  }
  async function save(status){setBusy(true);setError('');try{const saved=await talentApi.save(`${page}_${template?'templates':'documents'}`,{...draft,status,content:JSON.stringify(content)});setDraft(saved);setDirty(false);onSaved();}catch(err){setError(err.message);}finally{setBusy(false);}}
  async function send(){setBusy(true);setError('');try{const delivery=await talentApi.sendDocument(page,draft);setDraft(old=>({...old,delivery}));onSaved();}catch(err){setError(err.message);}finally{setBusy(false);}}
  async function exportDocument(word){try{if(word)await downloadWord(content,draft.title,!final);else await printDocument(content,draft.title,!final);}catch(err){setError(err.message);}}
  async function importWord(file) {
    if (!file || busy || final) return;
    if (!/\.docx$/i.test(file.name)) { setError('Choose a Word .docx file. Older .doc files are not supported.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Choose a Word file smaller than 10 MB.'); return; }
    setBusy(true);setError('');setImportNotice('');
    try {
      const [{default:mammoth},{default:DOMPurify}]=await Promise.all([import('mammoth/mammoth.browser.js'),import('dompurify')]);
      const result=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},{externalFileAccess:false});
      const body=letterFromHtml(DOMPurify.sanitize(result.value,{USE_PROFILES:{html:true}}));
      if (!hasBodyContent({body})) throw new Error('This file has no supported letter content.');
      const apply=()=>{
        setContent({...customContent(branding),body,templateChoice:'custom'});
        setDraft(old=>({...old,title:file.name.replace(/\.docx$/i,''),kind:'custom'}));
        setDirty(true);setPreview(false);
        setImportNotice('Word file imported. Review formatting, images and tables before saving. Word headers, footers and exact page layout are not preserved.'+(result.messages.length?' Some Word formatting could not be imported.':''));
      };
      setConfirmation({action:apply,title:'Replace this letter with the Word file?',message:'The imported file replaces the current letter content. Save any changes you want to keep before importing.',label:'Import Word file'});
    } catch(err) { setError('Could not import Word file. '+err.message); }
    finally { setBusy(false); }
  }
  const selection=content.templateChoice||(custom?'custom':`builtin:${draft.kind}`);
  return <ModalFrame size="xl" ref={dialog} className="lifecycle-editor" aria-labelledby="document-editor-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
    <header><div><small>{template?'COMPANY TEMPLATE':`${draft.status.toUpperCase()} DOCUMENT`}</small><h2 id="document-editor-title">{draft.title}</h2><p>{employee?nameOf(employee):'Reusable company paper'}</p></div><div className="lifecycle-editor-actions">{!final&&<div className="letter-import"><input ref={wordInput} type="file" hidden accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e=>{const file=e.target.files[0];e.target.value='';importWord(file);}}/><Button variant="outline" disabled={busy} onClick={() => wordInput.current.click()}>{busy?'Please wait...':'Import Word (.docx)'}</Button></div>}<div className="lifecycle-tools"><Button variant="outline" onClick={() => setPreview(!preview)}>{preview?'Edit document':'Preview paper'}</Button><Button variant="outline" icon={Printer} onClick={() => exportDocument(false)}>Print</Button><Button variant="outline" icon={Download} onClick={() => exportDocument(true)}>Word</Button>{!final&&<Button variant="outline" disabled={busy} onClick={() => {
  setContent(old => ({
    ...old,
    ...(custom ? {} : mergeContent(old, {
      company_name: branding.company_name || '',
      company_address: branding.company_address || '',
      signatory: branding.signatory || '',
      signatory_role: branding.signatory_role || ''
    })),
    branding
  }));
  setDirty(true);
}}>Apply company letterhead</Button>}</div><Button iconOnly icon={X} aria-label="Close document" disabled={busy} onClick={close} /></div></header>
    <div className="lifecycle-editor-body">{error&&<p role="alert" className="talent-alert">{error}</p>}
      <div className="letter-input-grid"><label>Start from<select value={selection} disabled={final||busy} onChange={e=>choose(e.target.value)}><option value="custom">Custom document — blank editor</option><optgroup label="Premade letters">{DOCUMENT_TYPES[page].map(([kind,title])=><option key={kind} value={`builtin:${kind}`}>{title}</option>)}</optgroup><optgroup label="Company templates">{templates.filter(t=>t.status==='Published').map(t=><option key={t.id} value={`saved:${t.id}`}>{t.title}</option>)}</optgroup></select></label><label>Document title<input value={draft.title} maxLength={300} disabled={final||busy} onChange={e=>change('title',e.target.value)}/></label></div>
      <div className={`letter-editor-layout${!final&&!custom?' has-details':''}`}><div className="letter-editor-main">{!final && <AsterAssistant page={page} disabled={busy} context={documentText(content).slice(0,15000)} onApply={result => { setDirty(true); setPreview(false); setDraft(old => ({ ...old, title: result.title || old.title, kind: "custom" })); setContent(old => ({ ...old, mode: "custom", body: { type: "doc", content: markdownBlocks(result.text) } })); }}/>}
      {importNotice&&<p role="status" className="lifecycle-hint">{importNotice}</p>}
      {!final&&custom&&<p className="lifecycle-hint">Build your own document with the element tools below. You can also edit HTML source and save this document as a company template.</p>}
      {preview?<iframe className="lifecycle-preview" title="Document print preview" sandbox="" srcDoc={documentHtml(content,draft.title,!final)}/>:<fieldset disabled={busy} className="letter-paper">{brand.logo&&<img className="letter-paper-logo" src={brand.logo.src} width={brand.logo.width} height={brand.logo.height} alt="Company logo"/>}{['header','body','footer'].map(key=><React.Fragment key={key}>{key==='footer'&&brand.signature&&<img className="letter-paper-signature" src={brand.signature.src} width={brand.signature.width} height={brand.signature.height} alt="Authorized signature"/>}<DocumentBlocks label={key[0].toUpperCase()+key.slice(1)} content={content[key]} custom={custom} readOnly={final||busy} onError={setError} onChange={value=>{setDirty(true);setContent(old=>({...old,[key]:value}));}}/></React.Fragment>)}</fieldset>}
      {final&&<div className="lifecycle-delivery"><strong>Email recipient: {employee?.email||'No email recorded'}</strong><p>The finalized document will be sent as a formatted email.</p>{draft.delivery&&<p>Accepted by email provider · {draft.delivery.recipient} · {new Date(draft.delivery.at).toLocaleString()}</p>}</div>}
      </div>
      {!final&&!custom&&<details className="letter-details" open><summary><h3>Letter details</h3><span>{missing.length?missing.length+' fields to complete':'All fields completed'}</span></summary><p>Fill in these details. They update the letter below automatically.</p><div className="letter-input-grid">{fields.map(field=><LetterInput key={field.key} field={field} disabled={busy} onChange={value=>{setDirty(true);setContent(old=>mergeContent(old,{[field.key]:value}));}}/>)}</div></details>}
      </div>
    </div><footer><Button variant="outline" disabled={busy} onClick={close}>Close</Button><Button variant="outline" disabled={busy} onClick={() => setSaveTemplate(true)}>Save as template</Button>{!final&&<><Button variant="outline" loading={busy} onClick={() => save('Draft')}>Save draft</Button><Button disabled={busy || !draft.title.trim() || !template && (missing.length > 0 || !draft.employee_id || !hasBodyContent(content))} onClick={() => save(template ? 'Published' : 'Finalized')}>{template?'Publish template':'Finalize document'}</Button></>}{final&&<Button icon={Mail} disabled={busy || !!draft.delivery || !employee?.email} onClick={send}>{draft.delivery?'Email accepted':'Send email'}</Button>}</footer>
    {confirmation&&<ConfirmDialog title={confirmation.title} message={confirmation.message} confirmLabel={confirmation.label} onCancel={()=>setConfirmation(null)} onConfirm={()=>{const action=confirmation.action;setConfirmation(null);action();}}/>}
    {saveTemplate&&<TemplateNameDialog title={draft.title} onClose={()=>setSaveTemplate(false)} onSave={async title=>{await talentApi.save(page+'_templates',{title,kind:draft.kind||'custom',status:'Published',content:JSON.stringify(reusableContent(content))});onSaved();}}/>}
  </ModalFrame>;
}

function EmployeePanel({ employee, plans, documents, onClose, onCreate, onEdit, onVersion, onEditPlan }) {
  const ref=useRef(null), closeTimer=useRef(null), [closing,setClosing]=useState(false);
  useEffect(()=>{ref.current.showModal();return()=>clearTimeout(closeTimer.current);},[]);
  function closePanel(afterClose) {
    if (closeTimer.current !== null) return;
    const finish=()=>{onClose();if(typeof afterClose==='function')afterClose();};
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
    setClosing(true);
    closeTimer.current=window.setTimeout(finish,220);
  }
  const counts=paperCounts(documents);
  return <ModalFrame size="drawer" ref={ref} className={`employee-paper-panel${closing?' is-closing':''}`} aria-labelledby="employee-paper-title" onCancel={e=>{e.preventDefault();closePanel();}} onClick={e=>{if(e.target===e.currentTarget)closePanel();}}><header><Avatar src={profileImage(employee)} name={nameOf(employee)} userid={employee.userid} size="lg"/><div><small>EMPLOYEE DOCUMENTS</small><h2 id="employee-paper-title">{nameOf(employee)}</h2><p>{employee.designation||'Role not set'} · {employee.department||'Department not set'}</p></div><Button iconOnly icon={X} aria-label="Close employee documents" onClick={() => closePanel()} /></header><div className="employee-panel-body"><div className="employee-contact"><span>{employee.employee_code||employee.userid}</span><span>{employee.email||'No email recorded'}</span></div><div className="paper-counts"><span><Clock3 size={16}/>{counts.pending} pending</span><span><CheckCircle2 size={16}/>{counts.ready} ready to send</span><span><Mail size={16}/>{counts.sent} sent</span></div><TenantPanelHeader title={<>All documents <small>{documents.length}</small></>} headingLevel={3} actions={[{ "icon": Plus, "onClick": onCreate, label: <>Create document</> }]} /><p className="lifecycle-hint">Sent means accepted by the email provider. Open a paper to see its recipient and sending time.</p><div className="employee-paper-list">{documents.map(doc=><article key={doc.id}><span className="paper-icon"><FileText size={21}/></span><div><h4>{doc.title}</h4><p>{doc.delivery?'Email accepted':doc.status==='Finalized'?'Ready to send':'Draft · needs review'}</p></div><Button variant="outline" size="sm" onClick={() => onEdit(doc)}>{doc.status==='Finalized'?'View / send':'Open'}</Button>{doc.status==='Finalized'&&<Button variant="fadeout" size="sm" onClick={() => onVersion(doc)}>New version</Button>}</article>)}{!documents.length&&<div className="letter-empty"><FileText/><h3>No documents yet</h3><p>Create a paper from a premade or company template.</p></div>}</div><h3 className="employee-plan-heading">Plans & checklists</h3>{plans.map(plan=><article className="employee-plan-item" key={plan.id}><div><strong>{plan.title}</strong><p>{plan.status} · {plan.checklist?.filter(task=>task.done).length||0}/{plan.checklist?.length||0} tasks completed</p><p>{dateLabel(plan.start_date)} → {dateLabel(plan.due_date)}</p></div><Button variant="outline" size="sm" onClick={() => closePanel(() => onEditPlan(plan))}>Edit plan</Button></article>)}</div></ModalFrame>;
}

export function LifecycleDocuments({ page, people, plans, onEditPlan }) {
  const [documents,setDocuments]=useState([]),[templates,setTemplates]=useState([]),[settings,setSettings]=useState(null),[view,setView]=useState('people');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[editor,setEditor]=useState(null),[selected,setSelected]=useState(''),[showSettings,setShowSettings]=useState(false),[search,setSearch]=useState(''),[filter,setFilter]=useState('active');
  const request=useRef(0), branding=settings?JSON.parse(settings.content).branding||{}:{};
  const load=useCallback(async(generate=false)=>{const id=++request.current;setLoading(true);setError('');try{if(generate)await talentApi.generateDocuments(page);const[docs,temps,config]=await Promise.all([talentApi.list(page+'_documents'),talentApi.list(page+'_templates'),talentApi.list('letter_settings')]);if(request.current===id){setDocuments(docs);setTemplates(temps);setSettings(config[0]||null);}}catch(err){if(request.current===id)setError(err.message);}finally{if(request.current===id)setLoading(false);}},[page]);
  useEffect(()=>{load(true);return()=>{request.current++;};},[load,plans]);
  function create(template=false,source,choice='builtin:'+DOCUMENT_TYPES[page][0][0]){
    const person=people.find(p=>p.userid===selected),plan=plans.find(p=>p.employee_id===selected&&p.status!=='Cancelled')||{};
    const saved=choice.startsWith('saved:')?templates.find(t=>t.id===choice.slice(6)):null,entry=DOCUMENT_TYPES[page].find(t=>t[0]===choice.replace('builtin:',''));
    let content=source?JSON.parse(source.content):saved?reusableContent(JSON.parse(saved.content)):entry?defaultContent(entry[1],entry[2]):customContent(branding);
    if(!source){content={...content,branding,templateChoice:choice};if(!template&&content.mode!=='custom')content=mergeContent(content,{...employeeFields(person,page==='onboarding'?plan:{},branding),...(page==='offboarding'?{notice_date:plan.start_date||'',last_working_date:plan.due_date||''}:{})});}
    setEditor({template,record:{title:source?source.title+' (new version)':saved?.title||entry?.[1]||'Custom document',kind:source?.kind||saved?.kind||entry?.[0]||'custom',employee_id:source?.employee_id||selected,status:'Draft',content:JSON.stringify(content)}});
  }
  const participantIds=new Set(plans.map(p=>p.employee_id));
  const participants=[...participantIds].map(id=>people.find(p=>p.userid===id)||{userid:id,name:'Employee '+id});
  const visible=participants.filter(p=>{const employeePlans=plans.filter(plan=>plan.employee_id===p.userid);return (filter==='all'||employeePlans.some(plan=>!['Completed','Cancelled'].includes(plan.status)))&&[nameOf(p),p.designation,p.department,p.employee_code,p.email].join(' ').toLowerCase().includes(search.toLowerCase());});
  const employee=participants.find(p=>p.userid===selected),totals=paperCounts(documents);
  return <section className="lifecycle-workspace">
    <header><div><small>PEOPLE & PAPERWORK</small><h2>{page==='onboarding'?'A great start, one person at a time.':'Every exit, thoughtfully organized.'}</h2><p>Employee plans, company papers and signatures in one workspace.</p></div><div className="lifecycle-tools"><Button variant="outline" icon={Settings2} onClick={() => setShowSettings(true)} disabled={loading}>Letter settings</Button></div></header>
    <MetricOverview as="div" loading={loading}><MetricCard loading={loading} label={page==='onboarding'?'People joining':'People exiting'} icon={MiUsers} value={participants.filter(p=>plans.some(plan=>plan.employee_id===p.userid&&!['Completed','Cancelled'].includes(plan.status))).length} caption="Active plans" /><MetricCard loading={loading} label="Pending papers" icon={MiFileClock} value={loading?'—':totals.pending} caption="Drafts and papers awaiting send" /><MetricCard loading={loading} label="Ready to send" icon={MiFileCheck} value={loading?'—':totals.ready} caption="Finalized and reviewed" /><MetricCard loading={loading} label="Sent papers" icon={MiSend} value={loading?'—':totals.sent} caption="Accepted by email provider" /></MetricOverview>
    {error&&<p role="alert" className="talent-alert">{error} <Button variant="outline" size="sm" onClick={() => load(true)}>Retry</Button></p>}
    <div className="lifecycle-tabs">{[['people',page==='onboarding'?'Onboarding plans':'Exit plans'],['templates','Template library'],...(page==='onboarding'?[['probation','Probation reviews']]:[])].map(([key,label])=><Button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)} variant={view === key ? "colored" : "fadeout"} wrapContent={false}>{label}</Button>)}</div>
    {view==='people'&&<><div className="employee-card-filters"><label><Search size={17}/><input aria-label="Search employees" placeholder="Search name, role or department" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filter employee plans" value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Active plans</option><option value="all">All plans</option></select><span>{visible.length} {visible.length===1?'person':'people'}</span></div><div className="employee-plan-cards">{visible.map(person=>{const employeePlans=plans.filter(plan=>plan.employee_id===person.userid),plan=employeePlans.find(p=>!['Completed','Cancelled'].includes(p.status))||employeePlans[0],docs=documents.filter(doc=>doc.employee_id===person.userid),counts=paperCounts(docs);return <Button type="button" key={person.userid} className="employee-plan-card" style={departmentTheme(person.department || 'General')} onClick={() => setSelected(person.userid)} variant="outline" wrapContent={false} layout="column"><div className="employee-card-top"><div className="employee-photo-block"><Avatar src={profileImage(person)} userid={person.userid} name={nameOf(person)} size="lg"/></div><div className="employee-card-identity"><small>{person.employee_code ? 'ID: ' + person.employee_code : 'EMPLOYEE'}</small><h3>{nameOf(person)}</h3><p>{person.designation||'Role not set'}</p><span>{person.department||'Department not set'}</span></div><ArrowUpRight size={17}/></div><span className="employee-plan-state">{plan.status}</span><dl><div><dt>{page==='onboarding'?'Joining date':'Last working day'}</dt><dd>{dateLabel(page==='onboarding'?plan.start_date:plan.due_date)}</dd></div><div><dt>{page==='onboarding'?'Probation ends':'Coordinator'}</dt><dd>{page==='onboarding'?dateLabel(probationEnd(person,plan)):nameOf(people.find(p=>p.userid===plan.owner_id))}</dd></div></dl><div className="employee-card-progress"><span>Checklist</span><span>{plan.checklist?.filter(task=>task.done).length||0} / {plan.checklist?.length||0}</span><progress value={plan.checklist?.filter(task=>task.done).length||0} max={plan.checklist?.length||1} aria-label={`${nameOf(person)} checklist progress`}/></div><div className="employee-card-papers"><span><Clock3 size={15}/>{loading?'—':counts.pending} pending</span><span><Mail size={15}/>{loading?'—':counts.sent} sent</span><small>View papers</small></div></Button>;})}</div>{!visible.length&&<div className="letter-empty"><FileText/><h3>{participants.length?'No matching employees':'No employee plans yet'}</h3><p>{participants.length?'Try another name or choose All plans.':'Create a plan above. Each employee will appear here with their documents.'}</p></div>}</>}
    {view==='templates'&&<><TenantPanelHeader title={<>Premade & company templates</>} subtitle={<>Choose a starting point, edit the content, then publish it for your company.</>} headingLevel={3} actions={[{ "icon": Plus, "onClick": ()=>create(true,null,'custom'), label: <>Custom template</> }]} /><div className="letter-template-grid">{DOCUMENT_TYPES[page].map(([kind,title])=><Button type="button" key={kind} onClick={() => create(true, null, 'builtin:' + kind)} variant="outline" wrapContent={false} layout="row"><span className="paper-icon"><FileText/></span><small>PREMADE LETTER</small><h3>{title}</h3><p>Labeled inputs · editable document</p><span>Customize template <ArrowUpRight size={16}/></span></Button>)}{templates.map(item=><article key={item.id}><span className="paper-icon"><FileText/></span><small>COMPANY TEMPLATE · {item.status}</small><h3>{item.title}</h3><p>{JSON.parse(item.content).mode==='custom'?'Custom document':'Premade variation'}</p><Button variant="outline" size="sm" onClick={() => setEditor({
  record: item,
  template: true
})}>Edit template</Button></article>)}</div></>}
    {view==='probation'&&<><p className="lifecycle-hint">Reviews are generated 14 days before probation ends. Edit the employee plan to set a duration or override the end date.</p><div className="lifecycle-table"><table><thead><tr><th>Employee</th><th>Joining date</th><th>Probation ends</th><th>Actions</th></tr></thead><tbody>{plans.filter(p=>p.status!=='Cancelled').map(plan=>{const person=people.find(p=>p.userid===plan.employee_id)||{};return <tr key={plan.id}><td>{nameOf(person)}</td><td>{dateLabel(plan.start_date)}</td><td>{dateLabel(probationEnd(person,plan))}</td><td><Button variant="outline" size="sm" onClick={() => setSelected(plan.employee_id)}>View papers</Button><Button variant="fadeout" size="sm" onClick={() => onEditPlan(plan)}>Edit dates</Button></td></tr>;})}</tbody></table></div></>}
    {employee&&<EmployeePanel employee={employee} plans={plans.filter(plan=>plan.employee_id===selected)} documents={documents.filter(doc=>doc.employee_id===selected)} onClose={()=>setSelected('')} onCreate={()=>create()} onEdit={record=>setEditor({record,template:false})} onVersion={record=>create(false,record)} onEditPlan={onEditPlan}/>}
    {editor&&<DocumentEditor key={editor.record.id||'new'} {...editor} page={page} people={people} plans={plans} templates={templates} branding={branding} onClose={()=>setEditor(null)} onSaved={()=>load()}/>}
    {showSettings&&<LetterSettings record={settings} onClose={()=>setShowSettings(false)} onSaved={saved=>setSettings(saved)}/>}
  </section>;
}
