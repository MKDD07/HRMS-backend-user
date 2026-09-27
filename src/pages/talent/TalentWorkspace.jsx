import { DeleteAssetList } from './DeleteAssetList';
import { AssetPhotos, AssetHeaderPhoto, AssetPhotoThumbnails, uploadAssetPhoto } from './AssetPhotos';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Search, Download, X, Briefcase, ArrowUpRight } from 'lucide-react';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { Button } from '../../components/ui/Button';
import { TALENT_COLLECTIONS, TALENT_PAGES, recordProgress, fieldIsVisible } from '../../../shared/talentModel.mjs';
import { talentApi, downloadTalentCsv } from '../../lib/talentApi';
import './TalentWorkspace.scss';

const personName = person => [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || person.username || person.userid || person.user_id;
const personId = person => person.userid || person.user_id;
const dateLabel = value => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
const todayKey = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const isFinished = record => ['Completed', 'Cancelled', 'Closed', 'Rejected', 'Withdrawn', 'Hired', 'Retired', 'Archived', 'Returned'].includes(record.status);
function initialRecord(config) {
  return { ...Object.fromEntries(config.fields.map(field => [field.key, field.default ?? field.options?.[0] ?? ''])),
    ...(config.assetTypes ? { types: [''] } : {}),
    ...(config.checklist ? { checklist: config.checklist.map(title => ({ title, done: false })) } : {}),
    ...(config.keyResults ? { key_results: [{ title: '', current: 0, target: 100 }] } : {}) };
}
function Status({ value }) {
  const tone = ['Completed', 'Hired', 'Open', 'Published', 'Available', 'On track'].includes(value) ? 'success' : ['At risk', 'Rejected', 'Damaged'].includes(value) ? 'danger' : ['In progress', 'Interview', 'Offered', 'Assigned', 'Issued', 'Received'].includes(value) ? 'active' : 'neutral';
  return <span className={`talent-status talent-status--${tone}`}>{value}</span>;
}
function RecordEditor({ collection, record, defaults, employeeId, people, data, financialAdmin, onClose, onSaved }) {
  const config = TALENT_COLLECTIONS[collection];
  const [draft, setDraft] = useState(() => structuredClone(record ? { ...initialRecord(config), ...record } : { ...initialRecord(config), ...defaults, ...(employeeId && config.fields.some(field => field.key === 'employee_id') ? { employee_id: employeeId, ...(collection === 'asset_issues' ? { status: 'Issued', issue_date: todayKey() } : {}) } : {}) }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState({});
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  useEffect(() => {
    if (collection === 'assets' && draft.list_id && draft.category !== 'Other') setDraft(current => ({ ...current, category: 'Other', custom_type: '' }));
  }, [collection, draft.list_id, draft.category]);
  const change = (key, value) => setDraft(current => ({ ...current, [key]: value, ...(collection === 'assets' && key === 'list_id' ? { category: value ? 'Other' : 'Laptop', custom_type: '' } : {}) }));
  const listTypes = (data.asset_lists || []).find(list => list.id === draft.list_id)?.types || [];
  const fields = config.fields.filter(field => fieldIsVisible(field, draft) && (!field.adminOnly || financialAdmin) && !(collection === 'assets' && draft.list_id && field.key === 'category')).map(field => collection === 'assets' && draft.list_id && field.key === 'custom_type' ? { ...field, label: 'Asset type', ...(listTypes.length ? { options: listTypes } : {}) } : field);
  async function save(event) {
    event.preventDefault(); if (busy) return;
    const normalizedName = draft.title?.trim().toLowerCase();
    if (['assets', 'asset_lists'].includes(collection) && ((collection === 'asset_lists' && normalizedName === 'it assets list') || (data[collection] || []).some(item => item.id !== draft.id && item.title?.trim().toLowerCase() === normalizedName && (collection !== 'assets' || (item.list_id || '') === (draft.list_id || ''))))) {
      setError('This name already exists. Choose a different name.'); return;
    }
    setBusy(true); setError('');
    try { let saved = await talentApi.save(collection, Object.fromEntries(Object.entries(draft).filter(([key]) => financialAdmin || !config.fields.some(field => field.key === key && field.adminOnly))));
      setDraft(saved);
      for (const [stage, files] of Object.entries(pendingPhotos)) {
        for (const file of files) {
          saved = await uploadAssetPhoto(collection, saved, stage, file);
          setDraft(saved);
          setPendingPhotos(current => ({ ...current, [stage]: (current[stage] || []).filter(item => item !== file) }));
        }
      }
      onSaved(saved); }
    catch (error) { setError(error.message + (Object.values(pendingPhotos).some(files => files.length) ? ' Record details may already be saved. Retry Save to upload remaining photos.' : '')); } finally { setBusy(false); }
  }
  const items = config.checklist ? draft.checklist : draft.key_results;
  const itemKey = config.checklist ? 'checklist' : 'key_results';
  return <dialog className="talent-dialog" ref={dialog} aria-labelledby="talent-editor-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={save}>
      <header><div className="asset-editor-heading">{collection === "assets" && <AssetHeaderPhoto record={draft} file={pendingPhotos.purchase?.[0]} />}<div><span className="talent-eyebrow"></span><h2 id="talent-editor-title">{record ? 'Edit' : 'Create'} {config.singular}</h2></div></div><Button variant="fadeout" iconOnly icon={X} aria-label="Close editor" disabled={busy} onClick={onClose} /></header>
      <div className="talent-editor-body">
        {error && <div className="talent-alert" role="alert">{error}</div>}
        <div className="talent-form-grid">{fields.map(field => {
          const options = field.type === 'employee' ? people.map(person => ({ value: personId(person), label: personName(person) })) : field.type === 'reference' ? (data[field.collection] || []).filter(item => field.collection !== 'assets' || item.id === draft.asset_id || (item.status === 'Available' && !(data.asset_issues || []).some(issue => issue.asset_id === item.id && issue.status !== 'Returned'))).map(item => ({ value: item.id, label: field.collection === 'assets' ? `${item.title} / ${item.serial_number}` : item.title })) : field.options?.map(value => ({ value, label: value }));
          return <React.Fragment key={field.key}>{field.section && <h3 className="talent-full talent-form-section">{field.section}</h3>}<label className={field.type === 'textarea' ? 'talent-full' : ''}><span>{field.label}{field.required && ' *'}</span>
            {options ? <select required={field.required} value={draft[field.key]} disabled={busy || (!!record && collection === 'asset_issues' && ['asset_id', 'employee_id'].includes(field.key))} onChange={event => change(field.key, event.target.value)}><option value="">{field.key === 'list_id' ? 'IT assets list (default)' : `Select ${field.label.toLowerCase()}`}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea rows={3} maxLength={5000} value={draft[field.key]} disabled={busy} onChange={event => change(field.key, event.target.value)} /> : <input type={field.type} required={field.required} min={field.min} max={field.max} step={field.key === 'positions' ? 1 : 'any'} maxLength={300} value={draft[field.key]} disabled={busy} onChange={event => change(field.key, event.target.value)} />}
          </label></React.Fragment>;
        })}</div>
        {['assets', 'asset_issues'].includes(collection) && <AssetPhotos collection={collection} record={draft} pending={pendingPhotos} busy={busy} onFiles={(stage, files) => setPendingPhotos(current => ({ ...current, [stage]: [...(current[stage] || []), ...files] }))} onRemove={(stage, index) => setPendingPhotos(current => ({ ...current, [stage]: current[stage].filter((_, i) => i !== index) }))} />}
        {config.assetTypes && <section className="talent-subform"><div className="talent-section-heading"><h3>Asset types (maximum 5)</h3><Button variant="outline" size="sm" icon={Plus} disabled={busy || draft.types.length >= 5} onClick={() => change('types', [...draft.types, ''])}>Add type</Button></div>
          {draft.types.map((type, index) => <div className="talent-task-row" key={index}><label className="talent-task-title"><span>Type {index + 1} *</span><input required maxLength={300} value={type} disabled={busy} onChange={event => change('types', draft.types.map((old, i) => i === index ? event.target.value : old))} /></label><Button variant="fadeout" iconOnly icon={X} aria-label={'Remove type ' + (index + 1)} disabled={busy || draft.types.length === 1} onClick={() => change('types', draft.types.filter((_, i) => i !== index))} /></div>)}
        </section>}
        {collection === 'assets' && <p className="talent-hint">Add inventory here. Use Individual issued to hand an asset to an employee.</p>}
        {collection === 'asset_issues' && <p className="talent-hint">Record employee receipt with the received date and acknowledgement note. Choose Returned and record the return date, condition, and notes when the asset comes back.</p>}
        {items && <section className="talent-subform"><div className="talent-section-heading"><h3>{config.checklist ? 'Checklist' : 'Measurable key results'}</h3><Button variant="outline" size="sm" icon={Plus} disabled={busy || items.length >= (config.checklist ? 50 : 20)} onClick={() => change(itemKey, [...items, config.checklist ? { title: '', done: false } : { title: '', current: 0, target: 100 }])}>Add {config.checklist ? 'task' : 'result'}</Button></div>
          {items.map((item, index) => <div className="talent-task-row" key={index}>
            {config.checklist && <input type="checkbox" checked={item.done} aria-label={`Complete task ${index + 1}`} disabled={busy} onChange={event => change(itemKey, items.map((old, i) => i === index ? { ...old, done: event.target.checked } : old))} />}
            <label className="talent-task-title"><span>{config.checklist ? 'Task' : 'Key result'} {index + 1}</span><input value={item.title} required maxLength={300} disabled={busy} onChange={event => change(itemKey, items.map((old, i) => i === index ? { ...old, title: event.target.value } : old))} /></label>
            {!config.checklist && ['current', 'target'].map(key => <label key={key}><span>{key === 'current' ? 'Current' : 'Target'}</span><input type="number" min={key === 'target' ? 0.01 : 0} max={1000000000} step="any" required disabled={busy} value={item[key]} onChange={event => change(itemKey, items.map((old, i) => i === index ? { ...old, [key]: event.target.value } : old))} /></label>)}
            <Button variant="fadeout" iconOnly icon={X} aria-label={`Remove ${config.checklist ? 'task' : 'key result'} ${index + 1}`} disabled={busy || items.length === 1} onClick={() => change(itemKey, items.filter((_, i) => i !== index))} />
          </div>)}
        </section>}
        {draft.history?.length > 0 && <details className="talent-history"><summary>Record history ({draft.history.length})</summary>{draft.history.slice().reverse().map((event, index) => <p key={index}>{new Date(event.at).toLocaleString()}  {event.status}</p>)}</details>}
      </div>
      <footer><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save {config.singular}</Button></footer>
    </form>
  </dialog>;
}
function AssetRecordsTable({ collection, records, data, names, financialAdmin, onEdit, onReturn, onReissue }) {
  const inventory = collection === 'assets';
  return <div className="talent-table-scroll"><table><thead><tr>
    <th className="asset-photo-column">Photo</th><th>Asset</th>{inventory ? <><th>Type / model</th><th>Availability</th>{financialAdmin && <><th>Purchased</th><th>Price</th></>}</> : <><th>Employee</th><th>Issued</th><th>Received</th><th>Returned</th><th>Acknowledgement</th><th>Notes</th><th>Status</th></>}
    {inventory && <th>Issued to</th>}<th><span className="talent-sr-only">Actions</span></th>
  </tr></thead><tbody>{records.map(record => {
    const asset = inventory ? record : (data.assets || []).find(item => item.id === record.asset_id);
    const issued = inventory && (data.asset_issues || []).find(issue => issue.asset_id === record.id && issue.status !== 'Returned');
    return <tr key={record.id}><td className="asset-photo-column"><AssetPhotoThumbnails collection={collection} record={record} /></td><td><strong>{asset?.title || record.title}</strong><small>{asset?.serial_number}</small></td>
      {inventory ? <><td>{record.category === 'Other' ? record.custom_type : record.category}<small>{[record.brand, record.model].filter(Boolean).join(' / ')}</small></td><td><Status value={issued ? 'Issued' : record.status} /></td>{financialAdmin && <><td>{dateLabel(record.purchase_date)}</td><td>{record.purchase_price === '' || record.purchase_price == null ? 'Not recorded' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: record.currency || 'INR' }).format(record.purchase_price)}</td></>}</> : <><td>{names.get(record.employee_id) || record.employee_id}</td><td>{dateLabel(record.issue_date)}</td><td>{dateLabel(record.received_date)}</td><td>{dateLabel(record.return_date)}</td><td className="talent-acknowledgement">{record.acknowledgement_note || 'Awaiting acknowledgement'}</td><td>{record.notes || '?'}</td><td><Status value={record.status} /></td></>}
      {inventory && <td>{issued ? names.get(issued.employee_id) || issued.employee_id : "Unassigned"}</td>}<td><Button variant="fadeout" size="sm" onClick={() => onEdit(record)}>Open</Button>{!inventory && record.status !== "Returned" && <Button variant="outline" size="sm" onClick={() => onReturn(record)}>Return</Button>}{!inventory && record.status === "Returned" && asset?.status === "Available" && !(data.asset_issues || []).some(issue => issue.asset_id === record.asset_id && issue.status !== "Returned") && <Button variant="outline" size="sm" onClick={() => onReissue(record)}>Issue again</Button>}</td>
    </tr>;
  })}</tbody></table></div>;
}
export function TalentWorkspace({ module, onShowToast, currentUser }) {
  const page = TALENT_PAGES[module];
  const financialAdmin = currentUser?.role === 'company_admin';
  const [collection, setCollection] = useState(page.collections[0]);
  const hasDirectory = ['performance', 'learning'].includes(module) || (module === 'assets' && collection === 'asset_issues');
  const [assetList, setAssetList] = useState('');
  const [deletingList, setDeletingList] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [data, setData] = useState({}), [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [status, setStatus] = useState('');
  const [editor, setEditor] = useState(null), [view, setView] = useState('list');
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current; setLoading(true); setError('');
    try {
      const values = await Promise.all([...page.collections.map(key => talentApi.list(key)), talentApi.people()]);
      if (id !== requestId.current) return;
      setData(Object.fromEntries(page.collections.map((key, index) => [key, values[index]]))); setPeople(values.at(-1).map(person => ({ ...person, userid: personId(person) })));
      setSelectedEmployee(current => values.at(-1).some(person => personId(person) === current) ? current : '');
    } catch (error) { if (id === requestId.current) setError(error.message); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [page]);
  useEffect(() => { load(); return () => { requestId.current++; }; }, [load]);
  const sourceConfig = TALENT_COLLECTIONS[collection];
  const config = { ...sourceConfig, fields: sourceConfig.fields.filter(field => !field.adminOnly || financialAdmin) };
  const records = (data[collection] || []).filter(record => {
    if (collection === 'assets' && (record.list_id || '') !== assetList) return false;
    if (!hasDirectory || !selectedEmployee) return true;
    if (collection === 'assets') return (data.asset_issues || []).some(issue => issue.employee_id === selectedEmployee && issue.asset_id === record.id && issue.status !== 'Returned');
    if (collection === 'courses') return (data.enrollments || []).some(assignment => assignment.employee_id === selectedEmployee && assignment.course_id === record.id);
    return record.employee_id === selectedEmployee;
  });
  const employeeRecords = person => (data[module === 'learning' ? 'enrollments' : module === 'performance' ? 'goals' : 'asset_issues'] || []).filter(record => record.employee_id === person.userid);
  const directoryMeta = person => {
    const assigned = employeeRecords(person);
    if (module === 'assets') { const active = assigned.filter(issue => issue.status !== 'Returned'); return active.length ? `${active.length} issued / ${active.filter(issue => issue.status === 'Issued').length} awaiting receipt` : 'No assets issued'; }
    const open = assigned.filter(record => !isFinished(record));
    const pastDue = open.filter(record => record.due_date && record.due_date < todayKey()).length;
    return `${assigned.length} ${module === 'learning' ? 'learning assignment(s)' : 'objective(s)'} / ${open.length} open${pastDue ? ` / ${pastDue} overdue` : ''}`;
  };
  const selectEmployee = person => {
    setSelectedEmployee(person.userid); setSearch(''); setStatus('');
    if (module === 'learning') setCollection('enrollments');
    if (module === 'assets') setCollection('asset_issues');
  };
  const names = useMemo(() => new Map(people.map(person => [personId(person), personName(person)])), [people]);
  const availableAssets = (data.assets || []).filter(asset => asset.status === 'Available' && !(data.asset_issues || []).some(issue => issue.asset_id === asset.id && issue.status !== 'Returned'));
  const recordStatus = record => collection === 'assets' && (data.asset_issues || []).some(issue => issue.asset_id === record.id && issue.status !== 'Returned') ? 'Issued' : record.status;
  const statusOptions = [...config.fields.find(field => field.key === 'status').options, ...(collection === 'assets' ? ['Issued'] : [])];
  const filtered = records.filter(record => (!status || recordStatus(record) === status) && [record.title, record.email, record.department, record.serial_number, record.category, record.custom_type, names.get(record.employee_id), ...(collection === 'assets' ? (data.asset_issues || []).filter(issue => issue.asset_id === record.id && issue.status !== 'Returned').map(issue => names.get(issue.employee_id) || issue.employee_id) : [])].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()));
  const overdue = records.filter(record => record.due_date && record.due_date < todayKey() && !isFinished(record)).length;
  const summaryCards = module === 'assets'
    ? (collection === 'assets' ? [['Inventory', records.length, 'Registered equipment'], ['Available', records.filter(record => recordStatus(record) === 'Available').length, 'Ready to issue'], ['Issued', records.filter(record => recordStatus(record) === 'Issued').length, 'With employees'], ['Maintenance / retired', records.filter(record => ['Maintenance', 'Retired'].includes(record.status)).length, 'Unavailable for issue']]
      : [['Handovers', records.length, 'Issue and return records'], ['Awaiting receipt', records.filter(record => record.status === 'Issued').length, 'Sent to employees'], ['Received', records.filter(record => record.status === 'Received').length, 'Receipt recorded'], ['Returned', records.filter(record => record.status === 'Returned').length, 'Back with the company']])
    : [[config.label, records.length, 'Total records'], ['Active', records.filter(record => !isFinished(record)).length, 'Currently tracked'], ['Completed / closed', records.filter(isFinished).length, 'Finished or withdrawn'], ['Past due', overdue, 'Open records past their due date']];
  const progress = record => recordProgress(record, config);
  const context = record => names.get(record.employee_id) || (data.jobs || []).find(job => job.id === record.job_id)?.title || record.department || record.provider || record.category || 'Unassigned';
  const exportRows = () => downloadTalentCsv(`${collection}-${todayKey()}.csv`, config.fields.map(field => field.label), filtered.map(record => config.fields.map(field => field.type === 'employee' ? names.get(record[field.key]) || '' : field.type === 'reference' ? (data[field.collection] || []).find(item => item.id === record[field.key])?.title || '' : record[field.key])));
  return <div className="talent-workspace">
    <header className="talent-page-heading"><div><span className="talent-eyebrow">TALENT & OPERATIONS</span><h1>{page.title}</h1><p>{page.description}</p></div><div className="talent-actions"><Button variant="outline" iconOnly icon={RefreshCw} aria-label="Refresh records" loading={loading} onClick={load} /><Button icon={Plus} disabled={loading || !!error} onClick={() => setEditor({ record: null })}>{collection === "asset_issues" ? "Issue asset" : "New " + config.singular}</Button></div></header>
    {error && <div role="alert" className="talent-alert">{error} <Button variant="outline" size="sm" onClick={load}>Retry</Button></div>}
    {module === 'assets' && <div className="talent-tabs" aria-label="Assets views">{['assets', 'asset_issues'].map(key => <button type="button" key={key} aria-pressed={collection === key} onClick={() => { setCollection(key); setSelectedEmployee(''); setStatus(''); setSearch(''); }}>{TALENT_COLLECTIONS[key].label}</button>)}</div>}
    <div className={hasDirectory ? 'talent-directory-layout' : ''}>
    <div className="talent-records-main">
    {hasDirectory && <div className="talent-employee-context" aria-live="polite"><div><span className="talent-eyebrow">{selectedEmployee ? 'EMPLOYEE WORKSPACE' : 'COMPANY WORKSPACE'}</span><h2>{selectedEmployee ? names.get(selectedEmployee) : 'All employees'}</h2><p>{selectedEmployee ? (collection === 'assets' ? 'Inventory currently issued to this employee. New inventory is added without an employee assignment.' : collection === 'courses' ? 'Courses assigned to this employee. Open Learning assignments to track progress.' : 'Showing records for this employee. New assignments will use this selection.') : 'Select an employee on the right to review their assignments and outstanding work.'}</p></div>{selectedEmployee && <Button variant="outline" size="sm" onClick={() => setSelectedEmployee('')}>Show all</Button>}</div>}
    <section className="talent-stats" aria-label="Overview">{summaryCards.map(([label, value, description]) => <div key={label}><span>{label}</span><strong>{loading || error ? '-' : value}</strong><small>{description}</small></div>)}</section>
    {collection === 'asset_issues' && !loading && !error && <section className="talent-panel"><div className="talent-toolbar"><h2>Available to issue</h2><span>{availableAssets.length} available</span></div>{availableAssets.length ? <div className="talent-table-scroll"><table><thead><tr><th>Product</th><th>Type</th><th>Asset list</th><th>Action</th></tr></thead><tbody>{availableAssets.map(asset => <tr key={asset.id}><td><strong>{asset.title}</strong><small>{asset.serial_number}</small></td><td>{asset.category === 'Other' ? asset.custom_type : asset.category}</td><td>{(data.asset_lists || []).find(list => list.id === asset.list_id)?.title || 'IT assets list'}</td><td><Button variant="outline" size="sm" onClick={() => setEditor({ record: null, defaults: { asset_id: asset.id, status: 'Issued', issue_date: todayKey() } })}>Issue</Button></td></tr>)}</tbody></table></div> : <div className="talent-empty">No products available to issue. Add inventory or return an issued asset.</div>}</section>}
    <section className="talent-panel">
      <div className="talent-toolbar"><div className="talent-tabs" aria-label="Record types">{(module === 'assets' ? [] : page.collections).map(key => <button type="button" key={key} aria-pressed={collection === key} onClick={() => { setCollection(key); setStatus(''); setSearch(''); setView('list'); }}>{TALENT_COLLECTIONS[key].label}</button>)}{module === 'assets' && (collection === 'assets' ? <><button type="button" aria-pressed={!assetList} onClick={() => { setAssetList(''); setSearch(''); setStatus(''); }}>IT assets list</button>{(data.asset_lists || []).map(list => <button type="button" key={list.id} aria-pressed={assetList === list.id} onClick={() => { setAssetList(list.id); setSearch(''); setStatus(''); }}>{list.title}</button>)}<Button variant="outline" size="sm" icon={Plus} disabled={loading || !!error} onClick={() => setEditor({ collection: 'asset_lists', record: null })}>Add asset list</Button>{assetList && <Button variant="outline" size="sm" disabled={loading || !!error} onClick={() => setDeletingList(data.asset_lists.find(list => list.id === assetList))}>Delete list</Button>}</> : <h2>Individual issued / returns</h2>)}</div><Button variant="outline" size="sm" icon={Download} disabled={loading || !!error || !filtered.length} onClick={exportRows}>Export CSV</Button></div>
      <div className="talent-filters"><label className="talent-search"><Search size={16} aria-hidden="true" /><input aria-label={`Search ${config.label.toLowerCase()}`} placeholder={`Search ${config.label.toLowerCase()}`} value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{statusOptions.map(value => <option key={value}>{value}</option>)}</select>{collection === 'candidates' && <Button variant="outline" size="sm" onClick={() => setView(view === 'list' ? 'pipeline' : 'list')}>{view === 'list' ? 'Pipeline view' : 'List view'}</Button>}</div>
      {loading ? <div className="talent-empty" role="status">Loading your company records</div> : error ? <div className="talent-empty">Records could not be loaded. Retry to continue.</div> : !filtered.length ? <div className="talent-empty"><Briefcase size={28} /><h3>{search || status ? 'No matching records' : `No ${config.label.toLowerCase()} yet`}</h3><p>{search || status ? 'Try another search or status.' : `Create your first ${config.singular} to get started.`}</p></div> : module === 'assets' ? <AssetRecordsTable key={[collection, assetList, selectedEmployee].join(":")} collection={collection} records={filtered} data={data} names={names} financialAdmin={financialAdmin} onEdit={record => setEditor({ record })} onReissue={record => setEditor({ record: null, defaults: { asset_id: record.asset_id, status: 'Issued', issue_date: todayKey(), employee_id: '' } })} onReturn={record => setEditor({ record: { ...record, status: 'Returned', return_date: todayKey(), return_condition: record.return_condition || 'Good' } })} /> : view === 'pipeline' ? <div className="talent-pipeline">{config.fields.find(field => field.key === 'status').options.map(stage => <section key={stage}><h3>{stage}<span>{filtered.filter(record => record.status === stage).length}</span></h3>{filtered.filter(record => record.status === stage).map(record => <button type="button" className="talent-candidate" key={record.id} onClick={() => setEditor({ record })}><strong>{record.title}</strong><small>{context(record)}</small><span>{record.email}</span></button>)}</section>)}</div> : <div className="talent-table-scroll"><table><thead><tr><th>{config.singular}</th><th>{collection === 'candidates' ? 'Job opening' : 'Employee / details'}</th><th>Status</th><th>{config.checklist || config.keyResults || collection === 'enrollments' ? 'Progress' : 'Details'}</th><th>Date</th><th><span className="talent-sr-only">Actions</span></th></tr></thead><tbody>{filtered.map(record => <tr key={record.id}><td><strong>{record.title}</strong><small>{record.email || record.serial_number || record.location || ''}</small></td><td>{context(record)}</td><td><Status value={record.status} /></td><td>{config.checklist || config.keyResults || collection === 'enrollments' ? <div className="talent-progress"><progress value={progress(record)} max="100" aria-label={`${record.title} progress`} /><span>{progress(record)}%</span></div> : collection === 'jobs' ? `${record.positions} position(s)` : collection === 'courses' ? `${record.hours || 0} hours` : record.condition || ''}</td><td>{dateLabel(record.due_date || record.interview_date || record.issue_date || record.created_at)}</td><td><Button variant="fadeout" size="sm" icon={ArrowUpRight} onClick={() => setEditor({ record })} aria-label={`Edit ${record.title}`}>Open</Button></td></tr>)}</tbody></table></div>}
      <footer className="talent-table-footer">{!loading && !error && `${filtered.length} of ${records.length} records`}</footer>
    </section>
    </div>
    {hasDirectory && <EmployeeDirectory employees={people} selectedId={selectedEmployee} onSelect={selectEmployee}
      loading={loading} error={error} onRefresh={load} pageSize={6}
      subtitle={module === 'assets' ? 'Select an employee to review their assigned equipment.' : module === 'performance' ? 'Select an employee to review objectives and outstanding goals.' : 'Select an employee to review assigned learning and progress.'}
      renderMeta={directoryMeta}
      headerAction={selectedEmployee && <Button variant="fadeout" size="sm" onClick={() => setSelectedEmployee('')}>All</Button>} />}
    </div>
    {deletingList && <DeleteAssetList list={deletingList} onClose={() => setDeletingList(null)} onDeleted={result => { setDeletingList(null); setAssetList(''); setSearch(''); setStatus(''); load(); onShowToast?.({ type: result.cleanupPending ? 'warning' : 'success', title: 'List deleted', message: result.cleanupPending ? 'List deleted. Some stored photos could not be removed.' : 'List and its contents deleted.' }); }} />}
    {editor && <RecordEditor financialAdmin={financialAdmin} employeeId={hasDirectory ? selectedEmployee : ''} defaults={editor.defaults || (collection === 'assets' ? { list_id: assetList } : { issue_date: todayKey() })} collection={editor.collection || collection} record={editor.record} people={people} data={data} onClose={() => { setEditor(null); load(); }} onSaved={record => { const savedCollection = editor.collection || collection; setData(current => ({ ...current, [savedCollection]: current[savedCollection]?.some(item => item.id === record.id) ? current[savedCollection].map(item => item.id === record.id ? record : item) : [record, ...(current[savedCollection] || [])] })); if (savedCollection === 'asset_lists') { setAssetList(record.id); setSearch(''); setStatus(''); } setEditor(null); onShowToast?.({ type: 'success', title: 'Saved', message: `${TALENT_COLLECTIONS[editor.collection || collection].singular} saved.` }); }} />}
  </div>;
}
