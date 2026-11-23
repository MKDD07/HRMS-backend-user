import { Button } from '../ui/Button';
import { SalaryPolicyLibrary } from './SalaryPolicyLibrary';
import '../../pages/payroll/PayrollTheme.scss';
import { ModalFrame } from '../ui/Modal';
import { ViewTabs } from '../ui/ViewTabs';
import React, { useEffect, useRef, useState } from 'react';
import { Save, Eye, Copy, FileText, Layers, Users, ZoomIn, X } from 'lucide-react';
import { TenantHeader } from '../ui/TenantHeader';
import { EmployeeDirectory } from '../employees/EmployeeDirectory';
import { PAYSLIP_DESIGNS, PAY_MONTHS, newPayslipTemplate, normalizeSalary, validateTemplate } from '../../lib/payslipModel';
import { createPayslipDocument } from '../../lib/payslipDocument';
import { payslipApi } from '../../lib/payslipApi';
import './PayslipStudio.scss';

export function PayslipStudio({ api }) {
  const [tab, setTab] = useState('structures'), [configuration, setConfiguration] = useState({ templates: [], groups: [], assignments: [], storage: null });
  const [employees, setEmployees] = useState([]), [person, setPerson] = useState(null), [peopleLoading, setPeopleLoading] = useState(true), [peopleError, setPeopleError] = useState('');
  const [template, setTemplate] = useState(newPayslipTemplate()), [group, setGroup] = useState({ name: '', type: '', template_id: '' });
  const [assignment, setAssignment] = useState({ group_id: '', template_id: '', auto_generate: true });
  const [month, setMonth] = useState(PAY_MONTHS[new Date().getMonth()]), [year, setYear] = useState(String(new Date().getFullYear()));
  const [multi, setMulti] = useState(false), [selectedIds, setSelectedIds] = useState([]);
  const [salary, setSalary] = useState(normalizeSalary({}));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [preview, setPreview] = useState('');
  const previewDialog = useRef(null);
  useEffect(() => { if (preview) previewDialog.current?.showModal(); }, [preview]);
  async function loadConfiguration() { const data = await payslipApi.configuration(); setConfiguration(data); return data; }
  useEffect(() => { loadConfiguration().catch(err => setError(err.message)); }, []);
  useEffect(() => { let active = true; setPeopleLoading(true); api.getAllUsers({ liveOnly: true }).then(result => { if (active) { setEmployees(result.data || []); setPerson(current => current || result.data?.[0] || null); } }).catch(err => { if (active) setPeopleError(err.message); }).finally(() => { if (active) setPeopleLoading(false); }); return () => { active = false; }; }, [api]);
  useEffect(() => { setAssignment(configuration.assignments.find(item => item.id === person?.userid) || { group_id: '', template_id: '', auto_generate: true }); }, [person?.userid, configuration.assignments]);
  useEffect(() => {
    if (!person) return;
    let active = true;
    setSalary(normalizeSalary({}));
    payslipApi.records(person.userid).then(records => { const saved = records.find(record => record.month === month && record.year === String(year)); if (active && saved) setSalary(saved.salary); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [person?.userid, month, year]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function run(action) { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  const change = (key, value) => setTemplate(current => ({ ...current, [key]: value }));
  const effectiveGroup = configuration.groups.find(item => item.id === assignment.group_id);
  const effectiveTemplate = configuration.templates.find(item => item.id === (assignment.template_id || effectiveGroup?.template_id));
  async function uploadImage(event, key) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 500000) throw new Error('Choose a PNG or JPEG smaller than 500 KB.');
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Cannot read this image.')); reader.readAsDataURL(file); });
      change(key, data);
    } catch (err) { setError(err.message); } finally { event.target.value = ''; }
  }
  function previewTemplate(value = template) {
    try {
      const valid = validateTemplate({ ...value, name: value.name || 'Design example', company_name: value.company_name || 'Your company', title: value.title || 'Salary payslip' });
      const pdf = createPayslipDocument({ employee: person || { userid: 'PREVIEW', first_name: 'Preview' }, salaryRecord: salary, template: valid, month, year });
      setPreview(URL.createObjectURL(pdf.output('blob'))); setError('');
    } catch (err) { setError(err.message); }
  }
  return <div className="payslip-studio payroll-console">
    <TenantHeader settings={{ heading: "Salary Structure & Payslip Studio", paragraph: "Define reusable salary rules and components, design payslips, and assign payroll groups. Process employee salaries in Payroll.", subheading: (['HRMS', 'Payroll & CTC', 'Edit Salary & Structure']).join(' / ') }} />

    {configuration.storage?.localDevelopment && <p className="ps-notice">Local admin development session. Production requires your verified authentication service.</p>}
    {error && <div role="alert" className="ps-error">{error} <Button type="button" onClick={() => run(loadConfiguration)} variant="outline" wrapContent={false}>Retry connection</Button></div>}{notice && <p role="status" className="ps-notice">{notice}</p>}
    <div className={tab==='structures' ? 'employee-workspace ps-workspace ps-workspace--library' : 'employee-workspace ps-workspace'}><div className="employee-workspace-content ps-content">
      <ViewTabs label="Payroll setup" value={tab} onChange={setTab} tabs={[{id:'structures',label:'Structures & components',icon:Layers},{id:'templates',label:'Payslip designs',icon:FileText},{id:'groups',label:'Groups & employee assignment',icon:Users}]}/>


      {tab === 'structures' && <SalaryPolicyLibrary configuration={configuration} onSaved={loadConfiguration}/>}
      {tab === 'templates' && <>
        <section className="ps-panel"><header><div><h3>Saved-salary preview period</h3><p>Choose an employee and period to preview the design. Salary amounts are managed in Payroll.</p></div></header><div className="payroll-panel-body payroll-fields"><label>Month<select value={month} onChange={e=>setMonth(e.target.value)}>{PAY_MONTHS.map(m=><option key={m}>{m}</option>)}</select></label><label>Year<input type="number" min="1900" max="2200" value={year} onChange={e=>setYear(e.target.value)}/></label></div></section>
        <section className="ps-panel"><header><div><span className="ps-eyebrow">01 / CHOOSE A DESIGN</span><h3>Three foundations. Your company identity.</h3><p>Save up to five variants per design. Issued PDFs retain their original template revision.</p></div></header><div className="ps-designs">{PAYSLIP_DESIGNS.map(design => <Button type="button" key={design.id} aria-pressed={template.design === design.id} onClick={() => {
  const next = {
    ...template,
    design: design.id,
    id: undefined,
    version: undefined
  };
  setTemplate(next);
  previewTemplate(next);
}} variant={template.design === design.id ? "colored" : "fadeout"} wrapContent={false} layout="row"><div className={'ps-mini ps-mini-' + design.id}><i /><b /><span /><span /><hr /><span /><span /><b /></div><strong>{design.name}</strong><small>{design.description}</small><span className="ps-enlarge"><ZoomIn size={14} /> View example</span><em>{configuration.templates.filter(item => item.design === design.id).length} / 5 variants</em></Button>)}</div></section>
        <section className="ps-panel"><header><div><span className="ps-eyebrow">02 / CUSTOMIZE & SAVE</span><h3>{template.id ? 'Edit ' + template.name : 'Company identity & template'}</h3><p>Company details, logo and signature are stored with each saved variant.</p></div><select aria-label="Edit saved template" value={template.id || ''} onChange={e => { setTemplate(configuration.templates.find(item => item.id === e.target.value) || newPayslipTemplate(template.design)); setPreview(''); }}><option value="">New variant</option>{configuration.templates.map(item => <option key={item.id} value={item.id}>{item.name} / {item.design} / v{item.version}</option>)}</select></header>
          <form onSubmit={e => { e.preventDefault(); run(async () => { const saved = await payslipApi.saveTemplate(template); setTemplate(saved); await loadConfiguration(); setNotice('Template saved to the database.'); }); }}><fieldset disabled={busy}>
            <div className="ps-form-grid">{[['name', 'Variant name'], ['company_name', 'Company name'], ['title', 'Document title'], ['registration', 'Registration / tax identifiers']].map(([key, label]) => <label key={key}>{label}<input required={key !== 'registration'} maxLength={120} value={template[key]} onChange={e => change(key, e.target.value)} /></label>)}<label className="ps-wide">Company address<textarea rows={2} maxLength={600} value={template.address} onChange={e => change('address', e.target.value)} /></label><label>Accent color<input type="color" value={template.accent} onChange={e => change('accent', e.target.value)} /></label><label>Authorized signatory<input maxLength={120} value={template.signatory} onChange={e => change('signatory', e.target.value)} /></label><label>Signatory designation<input maxLength={120} value={template.signatory_title} onChange={e => change('signatory_title', e.target.value)} /></label>
            {['logo', 'signature'].map(key => <label key={key} className="ps-image-field">{key === 'logo' ? 'Company logo' : 'Signature image'}<input type="file" accept="image/png,image/jpeg" onChange={e => uploadImage(e, key)} />{template[key] && <><img src={template[key]} alt={key + ' preview'} /><Button type="button" className="ps-button" onClick={() => change(key, '')} variant="outline" wrapContent={false}>Remove image</Button></>}<small>PNG or JPEG, up to 500 KB</small></label>)}
            <label className="ps-wide">Statement note<textarea maxLength={600} rows={3} value={template.note} onChange={e => change('note', e.target.value)} /><small>Auto-fill: {'{{employee_name}}'}, {'{{employee_id}}'}, {'{{month}}'}, {'{{year}}'}</small></label><label className="ps-wide">Footer text<textarea maxLength={200} rows={2} value={template.footer} onChange={e => change('footer', e.target.value)} /></label></div>
            <div className="ps-actions"><Button type="button" className="ps-button" onClick={() => previewTemplate()} variant="outline" wrapContent={false}><Eye size={14} />Preview PDF</Button>{template.id && <Button type="button" className="ps-button" onClick={() => setTemplate(({
  id,
  version,
  ...rest
}) => ({
  ...rest,
  name: rest.name + ' copy'
}))} variant="outline" wrapContent={false}><Copy size={14} />Duplicate variant</Button>}<Button className="ps-button ps-primary" type="submit" variant="colored" wrapContent={false}><Save size={14} />{busy ? 'Saving...' : 'Save template'}</Button></div></fieldset></form>
        </section>

      </>}
      {tab === 'groups' && <section className="ps-panel"><header><div><span className="ps-eyebrow">PAYROLL GROUPS</span><h3>Create a group or employment type</h3><p>For example, permanent employees, contractors, interns or your own category.</p></div></header><form onSubmit={e => { e.preventDefault(); run(async () => { await payslipApi.saveGroup(group); await loadConfiguration(); setGroup({ name: '', type: '', template_id: '' }); setNotice('Payroll group saved.'); }); }}><fieldset disabled={busy}><div className="ps-form-grid"><label>Group name<input required value={group.name} onChange={e => setGroup({ ...group, name: e.target.value })} /></label><label>Group type<input required list="payroll-group-types" value={group.type} onChange={e => setGroup({ ...group, type: e.target.value })} /><datalist id="payroll-group-types"><option value="Permanent" /><option value="Contractor" /><option value="Intern" /><option value="Consultant" /></datalist></label><label className="ps-wide">Default payslip template<select value={group.template_id} onChange={e => setGroup({ ...group, template_id: e.target.value })}><option value="">Assign template later</option>{configuration.templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><div className="ps-actions">{group.id && <Button type="button" className="ps-button" onClick={() => setGroup({
  name: '',
  type: '',
  template_id: ''
})} variant="outline" wrapContent={false}>Cancel edit</Button>}<Button className="ps-button ps-primary" type="submit" variant="colored" wrapContent={false}><Save size={14} />{group.id ? 'Update group' : 'Create group'}</Button></div></fieldset></form><div className="ps-group-list">{configuration.groups.map(item => <Button type="button" key={item.id} onClick={() => setGroup(item)} variant="outline" wrapContent={false} layout="row"><strong>{item.name}</strong><span>{item.type} / {configuration.templates.find(t => t.id === item.template_id)?.name}</span><small>Edit group</small></Button>)}</div></section>}
      {(tab === 'groups') && <section className="ps-panel"><header><div><span className="ps-eyebrow">PERSONAL ASSIGNMENT</span><h3>{multi && tab === 'groups' ? selectedIds.length + ' selected people' : person ? person.first_name + ' ' + (person.last_name || '') : 'Select an employee'}</h3><p>An individual override takes precedence over the group template.</p></div></header><form onSubmit={e => { e.preventDefault(); run(async () => { const targets = multi && tab === 'groups' ? selectedIds : [person.userid]; if (!targets.length) throw new Error('Select at least one employee.'); let count = 0; for (const userid of targets) { try { await payslipApi.assign({ ...assignment, userid }); count++; } catch (error) { await loadConfiguration(); throw new Error(count + ' assignments saved. ' + error.message); } } await loadConfiguration(); setNotice('Assignment saved for ' + count + ' people.'); }); }}><fieldset disabled={busy || !person}><div className="ps-form-grid"><label>Payroll group<select value={assignment.group_id} onChange={e => setAssignment({ ...assignment, group_id: e.target.value })}><option value="">No group</option>{configuration.groups.map(item => <option key={item.id} value={item.id}>{item.name} / {item.type}</option>)}</select></label><label>Individual template override<select value={assignment.template_id} onChange={e => setAssignment({ ...assignment, template_id: e.target.value })}><option value="">Use group template</option>{configuration.templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="ps-check ps-wide"><input type="checkbox" checked={assignment.auto_generate} onChange={e => setAssignment({ ...assignment, auto_generate: e.target.checked })} />Automatically generate and upload when salary is saved</label></div><div className="ps-actions"><span>Effective template: {effectiveTemplate?.name || 'Not assigned'}</span><Button className="ps-button ps-primary" type="submit" variant="colored" wrapContent={false}>Save assignment</Button></div></fieldset></form></section>}

    </div>{tab!=='structures'&&<EmployeeDirectory employees={employees} selectedId={person?.userid} onSelect={setPerson} loading={peopleLoading} error={peopleError} subtitle="Select a person for template previews, assignment and saved-salary previews." multi={tab === 'groups' && multi} selectedIds={selectedIds} onToggle={id => setSelectedIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id])} onSelectAll={setSelectedIds} onClearAll={() => setSelectedIds([])} headerExtra={tab === 'groups' ? <Button type="button" className="ps-button" onClick={() => {
  setMulti(!multi);
  setSelectedIds(person ? [person.userid] : []);
}} variant="outline" wrapContent={false}>{multi ? 'Select one person' : 'Assign multiple people'}</Button> : null} />}</div>
    <ModalFrame size="xl" ref={previewDialog} className="ps-preview-modal" onCancel={() => setPreview('')} onClose={() => setPreview('')} aria-labelledby="ps-preview-title">
      <header><div><span className="ps-eyebrow">DESIGN PREVIEW / NOT ISSUED</span><h3 id="ps-preview-title">{PAYSLIP_DESIGNS.find(item => item.id === template.design)?.name} payslip example</h3><p>Uses the saved salary for the selected employee. Blank company details show preview placeholders.</p></div><Button autoFocus type="button" className="ps-button" aria-label="Close preview" onClick={() => previewDialog.current.close()} variant="outline" wrapContent={false} iconOnly={true} size="sm"><X size={18} /></Button></header>
      {preview && <iframe title="Payslip PDF example" src={preview} className="ps-pdf-preview" />}
    </ModalFrame>
  </div>;
}
