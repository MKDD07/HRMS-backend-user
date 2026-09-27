import React, { useEffect, useRef, useState } from 'react';
import { FolderLock, Plus, Search, FileText, Download, ShieldCheck, Eye, Users, Clock, LayoutGrid, List, ArrowUpRight, FolderOpen, RefreshCw, AlertCircle, Link, Check, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { documentVaultApi } from '../../lib/documentVaultApi';
import '../dashboard/DashboardPage.css';
import './DocumentsPage.css';

const POLICY_CATEGORIES = ['Code of Conduct', 'Benefits & Health', 'Security & Geofence', 'Tax & Payroll', 'Compliance'];
const DOCUMENT_CATEGORIES = ['ID Proof', 'Employment Contract', 'Tax Form', 'Education & Degree', 'Appraisal & Letter'];
const isTrue = value => value === true || value === 1 || value === '1';
const dateLabel = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not available';
const personName = person => [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.name || person?.userid || 'Employee';
const formatOf = doc => (doc.format || doc.file_name?.split('.').pop() || 'FILE').toUpperCase();
const fileUrl = doc => Boolean(doc.id || doc.document_id);
const fetchFile = (doc, signal) => documentVaultApi.file(doc, signal);
function FileIcon({ doc }) {
  return <span className={`vault-file-icon vault-file-icon--${formatOf(doc).toLowerCase()}`}><FileText size={24} /><small>{formatOf(doc)}</small></span>;
}

export function DocumentPreview({ doc, onClose, onDownload, downloading }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    setState({ loading: true });
    fetchFile(doc, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ url: objectUrl, type: blob.type });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ error: error.message || 'Unable to load this file.' });
    });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc]);
  const format = formatOf(doc);
  const image = /^image\/(png|jpeg|webp|gif)$/.test(state.type) || ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF'].includes(format);
  const pdf = state.type === 'application/pdf' || format === 'PDF';
  return <Modal isOpen onClose={onClose} title="Document preview" size="xl" className="vault-preview-modal">
    <div className="vault-preview-heading"><FileIcon doc={doc} /><div><h2>{doc.title}</h2><p>{doc.file_name || 'Attached document'} · {doc.file_size || 'Size not provided'}</p></div><Button icon={Download} disabled={!fileUrl(doc)} loading={downloading === doc.id} onClick={() => onDownload(doc)}>Download</Button></div>
    <div className="vault-preview-layout"><div className="vault-preview-canvas">
      {state.loading ? <div className="vault-empty" role="status"><RefreshCw className="vault-spin" /><h3>Loading document…</h3></div> : state.error ? <div className="vault-empty" role="alert"><AlertCircle /><h3>Preview unavailable</h3><p>{state.error}</p><p>Check your connection and sign-in, then try again.</p>{fileUrl(doc) && <Button variant="secondary" onClick={() => onDownload(doc)}>Retry download</Button>}</div> : image ? <img src={state.url} alt={doc.title} /> : pdf ? <iframe title={`Preview of ${doc.title}`} src={state.url} /> : <div className="vault-empty"><FileText /><h3>This format is available to download</h3><p>In-app previews support PDF and image files.</p><Button icon={Download} onClick={() => onDownload(doc)} loading={downloading === doc.id}>Download original</Button></div>}
    </div><aside className="vault-preview-details"><h3>Document details</h3><dl>{[['Category', doc.category || doc.doc_type], ['Version', doc.version ? `v${doc.version}` : null], ['Uploaded by', doc.uploaded_by], ['Added', dateLabel(doc.created_at)], ['Effective date', doc.effective_date ? dateLabel(doc.effective_date) : null], ['Reference', doc.document_number], ['Review status', doc.doc_type ? isTrue(doc.verified) ? 'Verified' : 'Needs review' : null], ['Acknowledgement', doc.category ? isTrue(doc.mandatory_acknowledgement) ? 'Required' : 'Optional' : null]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{doc.description && <><h3>About this document</h3><p>{doc.description}</p></>}{fileUrl(doc) && <Button variant="secondary" icon={Download} onClick={() => onDownload(doc)} loading={downloading === doc.id}>Download original</Button>}</aside></div>
  </Modal>;
}

export function AddDocument({ personnel, employee, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const categories = personnel ? DOCUMENT_CATEGORIES : POLICY_CATEGORIES;
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true); setError('');
    try {
      const result = await documentVaultApi.upload({ title: values.title, category: values.category, description: values.description, version: values.version, effective_date: values.effective_date, document_number: values.reference, mandatory_acknowledgement: values.mandatory === 'on' }, file, personnel ? employee.userid : undefined);
      onSave(result);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <Modal isOpen onClose={() => !saving && onClose()} title={personnel ? 'Upload employee document' : 'Upload company policy'} size="lg">
    <form className="vault-form" onSubmit={submit}>
      <p className="vault-form-hint">{personnel ? 'Upload an original file for ' + personName(employee) + '.' : 'Upload an original policy for your company.'} Files remain accessible only through your company account.</p>
      <label>Document title *<input name="title" required maxLength={200} disabled={saving} placeholder="Document title" /></label>
      <label className="vault-upload-field">Original file *<input name="file" type="file" required disabled={saving} accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.txt" onChange={event => setFile(event.target.files?.[0] || null)} /><small>PDF, images, Word, Excel, CSV or TXT. Maximum 10 MB.</small>{file && <small>{file.name} · {(file.size / 1024).toFixed(0)} KB</small>}</label>
      <label>Category<select name="category" disabled={saving}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
      {personnel ? <label>Document reference<input name="reference" disabled={saving} placeholder="Optional ID or reference number" /></label> : <div className="vault-form-grid"><label>Version<input name="version" required defaultValue="1.0" disabled={saving} /></label><label>Effective date<input name="effective_date" type="date" required disabled={saving} defaultValue={new Date().toISOString().slice(0, 10)} /></label></div>}
      <label>Description<textarea name="description" rows={3} maxLength={2000} disabled={saving} placeholder="Optional description" /></label>
      {!personnel && <label className="vault-checkbox"><input type="checkbox" name="mandatory" defaultChecked disabled={saving} />Require employee acknowledgement</label>}
      {personnel && <p className="vault-form-hint">New documents need review before an administrator marks them verified.</p>}
      {error && <p className="vault-error" role="alert">{error}</p>}
      <div className="vault-form-footer"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" icon={Plus} loading={saving}>{saving ? 'Uploading…' : 'Upload document'}</Button></div>
    </form>
  </Modal>;
}

export function DocumentsPage({ api, onShowToast }) {
  const [tab, setTab] = useState('policies');
  const [policies, setPolicies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [error, setError] = useState('');
  const [peopleError, setPeopleError] = useState('');
  const [docsError, setDocsError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState('list');
  const [preview, setPreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);
  const personnel = tab === 'personnel';
  const toast = (type, title, message) => onShowToast?.({ type, title, message });
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    Promise.resolve().then(() => api.getCompanyPolicies()).then(res => { if (!Array.isArray(res?.data) || res.success === false) throw new Error(); if (alive) setPolicies(res.data); }).catch(() => { if (alive) setError('Company policies could not be loaded.'); }).finally(() => { if (alive) setLoading(false); });
    setPeopleLoading(true); setPeopleError('');
    Promise.resolve().then(() => api.getAllUsers({ liveOnly: true })).then(res => { if (!Array.isArray(res?.data) || res.success === false) throw new Error(); if (alive) { setEmployees(res.data); setEmployee(current => res.data.find(p => p.userid === current?.userid) || res.data[0] || null); } }).catch(() => { if (alive) setPeopleError('Employee directory could not be loaded.'); }).finally(() => { if (alive) setPeopleLoading(false); });
    return () => { alive = false; };
  }, [api, refresh]);
  useEffect(() => {
    const id = ++request.current;
    setDocs([]); setDocsError('');
    if (!employee?.userid) { setDocsLoading(false); return; }
    setDocsLoading(true);
    Promise.resolve().then(() => api.getEmployeeDocuments(employee.userid)).then(res => { if (!Array.isArray(res?.data) || res.success === false) throw new Error(); if (request.current === id) setDocs(res.data); }).catch(() => { if (request.current === id) setDocsError('Employee documents could not be loaded.'); }).finally(() => { if (request.current === id) setDocsLoading(false); });
    return () => { request.current++; };
  }, [api, employee?.userid, refresh]);
  async function download(doc) {
    if (downloading) return;
    setDownloading(doc.id);
    try {
      const blob = await fetchFile(doc);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = doc.file_name || `${doc.title}.${formatOf(doc).toLowerCase()}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast('success', 'Download started', doc.file_name || doc.title);
    } catch (err) { toast('error', 'Download unavailable', `${err.message} Please retry from Preview.`); setPreview(doc); } finally { setDownloading(null); }
  }
  async function verify(doc) {
    setVerifying(doc.id);
    const owner = employee?.userid;
    try {
      const next = !isTrue(doc.verified);
      await documentVaultApi.verify(doc.id, next);
      setDocs(current => current.map(d => d.id === doc.id && d.userid === owner ? { ...d, verified: next } : d));
      toast('success', 'Review status updated', next ? 'Document marked as verified.' : 'Document marked for review.');
    } catch (err) { toast('error', 'Could not update document', err.message); } finally { setVerifying(null); }
  }
  function switchTab(next) { setTab(next); setCategory('All'); setStatus('All'); setSearch(''); }
  function clearFilters() { setSearch(''); setCategory('All'); setStatus('All'); }
  const records = personnel ? docs : policies;
  const busy = personnel ? docsLoading || peopleLoading : loading;
  const loadError = personnel ? docsError || peopleError : error;
  const categories = [...new Set([...(personnel ? DOCUMENT_CATEGORIES : POLICY_CATEGORIES), ...records.map(d => d.category || d.doc_type).filter(Boolean)])];
  const verified = docs.filter(d => isTrue(d.verified)).length;
  const mandatory = policies.filter(d => isTrue(d.mandatory_acknowledgement)).length;
  const filtered = records.filter(d => {
    const match = [d.title, d.description, d.file_name, d.document_number, d.uploaded_by].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase());
    const statusMatch = status === 'All' || (personnel ? status === 'Verified' ? isTrue(d.verified) : !isTrue(d.verified) : status === 'Required' ? isTrue(d.mandatory_acknowledgement) : !isTrue(d.mandatory_acknowledgement));
    return match && statusMatch && (category === 'All' || (d.category || d.doc_type) === category);
  }).sort((a, b) => sort === 'name' ? (a.title || '').localeCompare(b.title || '') : (Date.parse(b.created_at || b.effective_date) || 0) - (Date.parse(a.created_at || a.effective_date) || 0));
  const hasFilters = search || category !== 'All' || status !== 'All';
  return <div className="tenant-dashboard document-vault">
    <header className="tenant-header"><div><span className="tenant-eyebrow">WORKSPACE / COMPLIANCE</span><h1>Document Vault &amp; Compliance Repository<span>.</span></h1><p>Manage company policies and employee records in one place.</p></div><div className="vault-header-actions"><button className="tenant-button" onClick={() => setRefresh(v => v + 1)} disabled={busy}><RefreshCw size={15} className={busy ? 'vault-spin' : ''} />{busy ? 'Refreshing...' : 'Refresh data'}</button><button className="tenant-button vault-upload-button" onClick={() => setAdding(true)} disabled={personnel && (!employee || peopleLoading || !!peopleError)}><Plus size={15} />Upload {personnel ? 'document' : 'policy'}</button></div></header>
    <div className="tenant-context"><span>Company document repository<small>Policies &amp; personnel records</small></span><span className="vault-access-note"><FolderLock size={14} />Company account access</span></div>
    <section className="tenant-stats" aria-label="Document repository overview">
      {[{ icon: FolderOpen, label: 'Company policies', value: loading || error ? '—' : policies.length, detail: 'Across your organization', color: 'violet' }, { icon: ShieldCheck, label: 'Acknowledgement required', value: loading || error ? '—' : mandatory, detail: 'Policies requiring employee sign-off', color: 'green' }, { icon: Users, label: 'Employee directory', value: peopleLoading || peopleError ? '—' : employees.length, detail: 'Individual personnel vaults', color: 'blue' }, { icon: personnel ? Clock : FileText, label: personnel ? 'Awaiting review' : 'Policy categories', value: personnel ? busy || loadError ? '—' : docs.length - verified : loading || error ? '—' : new Set(policies.map(p => p.category).filter(Boolean)).size, detail: personnel ? 'For the selected employee' : 'Organized for easy discovery', color: 'amber' }].map(({ icon: Icon, ...stat }) => <div className="tenant-stat" key={stat.label}><div>{stat.label}<Icon size={17} /></div><strong>{stat.value}</strong><p>{stat.detail}</p></div>)}
    </section>
    <nav className="vault-tabs" aria-label="Document libraries">{[{ id: 'policies', label: 'Company policies', icon: FolderLock }, { id: 'personnel', label: 'Employee documents', icon: Users }].map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} aria-pressed={tab === id} onClick={() => switchTab(id)}><Icon size={16} />{label}{id === 'policies' && !loading && !error && <span>{policies.length}</span>}</button>)}</nav>
    <div className={`vault-workspace ${personnel ? 'vault-workspace--personnel' : ''}`}>
      {personnel ? <EmployeeDirectory employees={employees} selectedId={employee?.userid} onSelect={person => { setEmployee(person); clearFilters(); }} loading={peopleLoading} error={peopleError} onRefresh={() => setRefresh(v => v + 1)} subtitle="Choose an employee to view their documents." pageSize={8} /> : <aside className="vault-sidebar"><div className="vault-sidebar-label">BROWSE LIBRARY</div><button className={category === 'All' ? 'selected' : ''} onClick={() => setCategory('All')}><FolderOpen size={17} />All documents<span>{policies.length}</span></button><div className="vault-sidebar-label vault-category-label">CATEGORIES</div>{categories.map((cat, index) => <button key={cat} className={category === cat ? 'selected' : ''} onClick={() => setCategory(cat)}><i className={`vault-dot vault-dot--${index % 5}`} />{cat}<span>{policies.filter(p => p.category === cat).length}</span></button>)}</aside>}
      <main className="vault-library"><div className="vault-library-header"><div><h2>{personnel ? `${personName(employee)}’s documents` : category === 'All' ? 'Company policy library' : category}</h2><p>{personnel ? `${employee?.userid || 'Select an employee'} · ${verified} of ${docs.length} documents verified` : 'Guidelines and resources for a well-informed workplace.'}</p></div><span className="vault-count">{busy ? 'Loading…' : `${records.length} documents`}</span></div>
        <div className="vault-toolbar"><label className="vault-search"><Search size={17} /><input aria-label="Search documents" placeholder="Search documents, keywords, or file names…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</label><select aria-label="Filter by review or acknowledgement status" value={status} onChange={e => setStatus(e.target.value)}><option value="All">All statuses</option>{(personnel ? ['Needs review', 'Verified'] : ['Required', 'Optional']).map(s => <option key={s} value={s}>{personnel ? s : `${s} acknowledgement`}</option>)}</select>{personnel && <select aria-label="Document category" value={category} onChange={e => setCategory(e.target.value)}><option value="All">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select>}</div>
        <div className="vault-results-bar"><span aria-live="polite">{busy ? 'Loading documents…' : `Showing ${filtered.length} of ${records.length} documents`}{hasFilters && <button onClick={clearFilters}>Clear filters</button>}</span><div><select aria-label="Sort documents" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Newest first</option><option value="name">Name A–Z</option></select><div className="vault-view-toggle"><button aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={16} /></button><button aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} /></button></div></div></div>
        {busy ? <div className="vault-empty" role="status"><RefreshCw className="vault-spin" /><h3>Loading your documents…</h3></div> : loadError ? <div className="vault-empty" role="alert"><AlertCircle /><h3>{loadError}</h3><Button variant="secondary" onClick={() => setRefresh(v => v + 1)}>Try again</Button></div> : !filtered.length ? <div className="vault-empty"><FolderOpen size={36} /><h3>{hasFilters ? 'No matching documents' : 'Your library starts here'}</h3><p>{hasFilters ? 'Try another keyword, category, or status.' : 'Upload an original file to make it available for preview and download.'}</p><Button variant="secondary" disabled={!hasFilters && personnel && !employee} onClick={hasFilters ? clearFilters : () => setAdding(true)}>{hasFilters ? 'Clear filters' : 'Upload first document'}</Button></div> : <div className={`vault-documents vault-documents--${view}`}>{filtered.map(doc => <article className="vault-document" key={doc.id}>
          <div className="vault-document-top"><FileIcon doc={doc} /><span className={`vault-status ${personnel ? isTrue(doc.verified) ? 'verified' : 'review' : isTrue(doc.mandatory_acknowledgement) ? 'required' : 'reference'}`}>{personnel ? isTrue(doc.verified) ? <><Check size={12} />Verified</> : <><Clock size={12} />Needs review</> : isTrue(doc.mandatory_acknowledgement) ? 'Acknowledgement required' : 'Reference policy'}</span></div>
          <div className="vault-document-content"><span className="vault-document-category">{doc.category || doc.doc_type}</span><h3><button onClick={() => setPreview(doc)}>{doc.title}</button></h3><p>{doc.description || (personnel ? doc.document_number ? `Reference: ${doc.document_number}` : 'Employee record · Review the original document before verification.' : 'Open this policy to view the original document and its details.')}</p><div className="vault-file-meta"><span>{formatOf(doc)}</span><span>{doc.file_size || 'Size not provided'}</span>{doc.version && <span>v{doc.version}</span>}</div></div>
          <div className="vault-document-bottom"><div className="vault-document-date"><Clock size={13} /><span>{doc.effective_date ? 'Effective' : 'Added'} {dateLabel(doc.effective_date || doc.created_at)}</span></div><div className="vault-document-actions"><button className="vault-preview-button" onClick={() => setPreview(doc)}><Eye size={16} />Preview</button><button disabled={!fileUrl(doc) || !!downloading} title={fileUrl(doc) ? `Download ${doc.title}` : 'No file attached'} onClick={() => download(doc)}>{downloading === doc.id ? <RefreshCw size={16} className="vault-spin" /> : <Download size={16} />}Download</button></div>{personnel && <button className="vault-verify-button" disabled={!!verifying} onClick={() => verify(doc)}><ShieldCheck size={14} />{verifying === doc.id ? 'Updating…' : isTrue(doc.verified) ? 'Mark for review' : 'Mark as verified'}</button>}</div>
        </article>)}</div>}
        <footer className="vault-library-footer"><Eye size={14} />Preview PDF and image files. Download other formats to view them.</footer>
      </main>
    </div>
    {preview && <DocumentPreview doc={preview} onClose={() => setPreview(null)} onDownload={download} downloading={downloading} />}
    {adding && <AddDocument personnel={personnel} employee={employee} onClose={() => setAdding(false)} onSave={record => { if (personnel) setDocs(current => [record, ...current]); else setPolicies(current => [record, ...current]); clearFilters(); setAdding(false); toast('success', 'Added to vault', `${record.title} is now in the repository.`); }} />}
  </div>;
}

export default DocumentsPage;
