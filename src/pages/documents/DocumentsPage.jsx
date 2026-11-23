import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import { Badge } from '../../components/ui/Badge';
import { UniversalSearch } from '../../components/ui/UniversalSearch';
import { PolicyDepartmentPicker } from './PolicyDepartmentPicker';
import { CompanyPolicyGenerator } from './CompanyPolicyGenerator';
import { DocumentWorkspace } from './DocumentWorkspace';
import { DocumentAssistantSettings } from './DocumentAssistantSettings';
import { documentReview } from '../../../shared/documentReview.mjs';
import { VaultAiComposer } from './VaultAiComposer';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { ViewTabs } from '../../components/ui/ViewTabs';
import { TenantHeader } from '../../components/ui/TenantHeader';

import React, { useEffect, useRef, useState } from 'react';
import { FolderLock, Plus, Search, FileText, Download, ShieldCheck, Eye, Users, Clock, FolderOpen, RefreshCw, AlertCircle, Link, Check, X, UploadCloud, Edit3, Power, History, ShieldAlert, Tag, Trash2, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TenantPanel, TenantPanelHeader } from '../../components/ui/TenantPanel';
import { EmployeeDirectory } from '../../components/employees/EmployeeDirectory';
import { documentVaultApi } from '../../lib/documentVaultApi';
import '../dashboard/DashboardPage.scss';
import './DocumentsPage.scss';

const DEFAULT_POLICY_CATEGORIES = ['Code of Conduct', 'Benefits & Health', 'Security & Geofence', 'Tax & Payroll', 'Compliance'];
const DEFAULT_DOCUMENT_CATEGORIES = ['ID Proof', 'Employment Contract', 'Tax Form', 'Education & Degree', 'Appraisal & Letter'];
const isTrue = value => value === true || value === 1 || value === '1';
const dateLabel = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not available';
const personName = person => [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.name || person?.userid || 'Employee';
const formatOf = doc => (doc.format || doc.file_name?.split('.').pop() || 'FILE').toUpperCase();
const fileUrl = doc => Boolean(doc.id || doc.document_id);
const fetchFile = (doc, signal) => documentVaultApi.file(doc, signal);
function FileIcon({ doc }) {
  return <span className={`vault-file-icon vault-file-icon--${formatOf(doc).toLowerCase()}`}><FileText size={24} /><small>{formatOf(doc)}</small></span>;
}

export function AddCategoryModal({ personnel, onClose, onSave }) {
  const [name, setName] = useState('');
  const [targetScope, setTargetScope] = useState(personnel ? 'personnel' : 'policy');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter a category name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await documentVaultApi.logAudit({
        action: 'CATEGORY_CREATED',
        target: cleanName,
        detail: `New ${targetScope === 'personnel' ? 'Personnel' : 'Policy'} category added: "${cleanName}"`
      });
      onSave({ name: cleanName, targetScope });
    } catch (err) {
      setError(err.message || 'Could not save category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title="Add Document Category" size="md">
      <form className="vault-form" onSubmit={submit}>
        <div className="vault-form-note">
          <Tag size={18} />
          <div>
            <strong>Create New Category</strong>
            <p>New categories are instantly available across policies and employee document forms.</p>
          </div>
        </div>

        <label>
          Category name *
          <input
            required
            maxLength={60}
            disabled={saving}
            placeholder="e.g. Health & Safety, NDA & IP, Compliance 2026…"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </label>

        <label>
          Applies to
          <select value={targetScope} onChange={e => setTargetScope(e.target.value)} disabled={saving}>
            <option value="policy">Company Policies &amp; Handbooks</option>
            <option value="personnel">Employee Personnel Records</option>
            <option value="both">Both (Policies &amp; Employee Vaults)</option>
          </select>
        </label>

        {error && <p className="vault-error" role="alert">{error}</p>}

        <div className="vault-form-footer">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" icon={Plus} loading={saving}>
            {saving ? 'Creating…' : 'Add Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function EditDocumentModal({ doc, personnel, availableCategories, onClose, onSave }) {
  const [scope,setScope]=useState(doc.applicable_departments||[]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState(doc.title || '');
  const [category, setCategory] = useState(doc.category || doc.doc_type || 'Compliance');
  const [description, setDescription] = useState(doc.description || '');
  const [version, setVersion] = useState(doc.version || '1.0');
  const [effectiveDate, setEffectiveDate] = useState(doc.effective_date ? String(doc.effective_date).slice(0, 10) : '');
  const [expiryDate, setExpiryDate] = useState(doc.expiry_date ? String(doc.expiry_date).slice(0, 10) : '');
  const [mandatory, setMandatory] = useState(isTrue(doc.mandatory_acknowledgement));
  const [isActive, setIsActive] = useState(doc.is_active !== false && doc.active !== false && doc.status !== 'disabled');

  const categories = availableCategories || (personnel ? DEFAULT_DOCUMENT_CATEGORIES : DEFAULT_POLICY_CATEGORIES);

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const updates = {
        ...(!personnel ? {applicable_departments:scope} : {}),
        title,
        category,
        description,
        version,
        effective_date: effectiveDate || null,
        expiry_date: expiryDate || null,
        mandatory_acknowledgement: mandatory,
        is_active: isActive,
        active: isActive,
        status: isActive ? 'active' : 'disabled'
      };
      const res = await documentVaultApi.update(doc.id, updates);
      onSave({ ...doc, ...updates, ...(res?.data || res) });
    } catch (err) {
      setError(err.message || 'Could not update document.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title={`Edit ${personnel ? 'Document' : 'Policy'} Details`} size="lg">
      <form className="vault-form" onSubmit={submit}>
        <div className="vault-form-note">
          <Edit3 size={18} />
          <div>
            <strong>Real-time Document Configuration</strong>
            <p>Changes are saved instantly and logged into the Document Compliance Audit Trail.</p>
          </div>
        </div>

        {!personnel&&<PolicyDepartmentPicker value={scope} onChange={setScope} disabled={saving}/>}
        <label>
          Document title *
          <input required maxLength={200} disabled={saving} value={title} onChange={e => setTitle(e.target.value)} />
        </label>

        <label>
          Category
          <select disabled={saving} value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        {!personnel && (
          <div className="vault-form-grid">
            <label>
              Version
              <input required disabled={saving} value={version} onChange={e => setVersion(e.target.value)} />
            </label>
            <label>
              Effective date
              <input type="date" disabled={saving} value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
            </label>
          </div>
        )}

        <label>
          Expiry date (optional)
          <input type="date" disabled={saving} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
        </label>

        <label>
          Description
          <textarea rows={3} maxLength={2000} disabled={saving} value={description} onChange={e => setDescription(e.target.value)} />
        </label>

        <div className="vault-edit-toggles">
          {!personnel && (
            <label className="vault-checkbox">
              <input type="checkbox" checked={mandatory} disabled={saving} onChange={e => setMandatory(e.target.checked)} />
              <span>Require employee acknowledgement (Mandatory)</span>
            </label>
          )}

          <label className="vault-checkbox">
            <input type="checkbox" checked={isActive} disabled={saving} onChange={e => setIsActive(e.target.checked)} />
            <span>Enable document status (Active in repository)</span>
          </label>
        </div>

        {error && <p className="vault-error" role="alert">{error}</p>}

        <div className="vault-form-footer">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" icon={Check} loading={saving}>
            {saving ? 'Saving changes…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AddDocument({ personnel, employee, availableCategories, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [scope,setScope]=useState([]);
  const categories = availableCategories || (personnel ? DEFAULT_DOCUMENT_CATEGORIES : DEFAULT_POLICY_CATEGORIES);
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true); setError('');
    try {
      const result = await documentVaultApi.upload({ origin: "human", ...(!personnel ? {applicable_departments:JSON.stringify(scope)} : {}), title: values.title, category: values.category, description: values.description, version: values.version, effective_date: values.effective_date, expiry_date: values.expiry_date, document_number: values.reference, mandatory_acknowledgement: values.mandatory === 'on' }, file, personnel ? employee.userid : undefined);
      onSave(result);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <Modal isOpen onClose={() => !saving && onClose()} title={personnel ? 'Upload employee document' : 'Upload company policy'} size="lg">
    <form className="vault-form" onSubmit={submit}>
      <p className="vault-form-hint">{personnel ? 'Upload an original file for ' + personName(employee) + '.' : 'Upload an original policy for your company.'} Files remain accessible only through your company account.</p>
      {!personnel&&<PolicyDepartmentPicker value={scope} onChange={setScope} disabled={saving}/>}
      <label>Document title *<input name="title" required maxLength={200} disabled={saving} placeholder="Document title" /></label>
      <div className="vault-upload-field">
        <label htmlFor="vault-file-input" className={`vault-dropzone ${file ? 'has-file' : ''}`}>
          <input
            id="vault-file-input"
            name="file"
            type="file"
            required
            disabled={saving}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.txt"
            onChange={event => setFile(event.target.files?.[0] || null)}
          />
          <div className="vault-dropzone-icon">
            <UploadCloud size={22} />
          </div>
          <div className="vault-dropzone-content">
            {file ? (
              <>
                <div className="vault-dropzone-selected">
                  <strong>{file.name}</strong>
                  <span>{(file.size / 1024).toFixed(0)} KB</span>
                </div>
                <span className="vault-dropzone-change">Click to replace document</span>
              </>
            ) : (
              <>
                <div className="vault-dropzone-cta">
                  <span className="vault-browse-pill">Browse file</span>
                  <span>or drag and drop here</span>
                </div>
                <small>PDF, PNG, JPG, WEBP, DOCX, XLSX, CSV, TXT (Max 10 MB)</small>
              </>
            )}
          </div>
        </label>
      </div>
      <label>Category<select name="category" disabled={saving}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
      {personnel ? <label>Document reference<input name="reference" disabled={saving} placeholder="Optional ID or reference number" /></label> : <div className="vault-form-grid"><label>Version<input name="version" required defaultValue="1.0" disabled={saving} /></label><label>Effective date<input name="effective_date" type="date" required disabled={saving} defaultValue={new Date().toISOString().slice(0, 10)} /></label></div>}
      <label>Expiry date (optional)<input name="expiry_date" type="date" disabled={saving} /></label>
      <label>Description<textarea name="description" rows={3} maxLength={2000} disabled={saving} placeholder="Optional description" /></label>
      {!personnel && <label className="vault-checkbox"><input type="checkbox" name="mandatory" defaultChecked disabled={saving} />Require employee acknowledgement</label>}
      {personnel && <p className="vault-form-hint">New documents need review before an administrator marks them verified.</p>}
      {error && <p className="vault-error" role="alert">{error}</p>}
      <div className="vault-form-footer"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" icon={Plus} loading={saving}>{saving ? 'Uploading…' : 'Upload document'}</Button></div>
    </form>
  </Modal>;
}

export function DocumentsPage({ api, onShowToast, aiRequest, onAiStarted, location }) {
  const [assistantSettings, setAssistantSettings] = useState(false);
  const [policyView, setPolicyView] = useState('library');
  const [policyJob,setPolicyJob]=useState(null);
  const generationView=useRef(null);
  const handlePolicyJob=value=>{setPolicyJob(value);if(value&&['queued','generating','waiting','saving'].includes(value.runState)&&generationView.current!==value.id){generationView.current=value.id;setPolicyView('ai');setSearch('');setCategory('All');setStatus('All');setPolicyDepartment('All');}};
  const [aiPolicyCategories,setAiPolicyCategories]=useState([]),[policyDepartments,setPolicyDepartments]=useState([]),[policyDepartment,setPolicyDepartment]=useState('All');
  const [employeeView,setEmployeeView]=useState('uploaded');
  const [reviewing, setReviewing] = useState(null), [deleting, setDeleting] = useState(null), [reviewBusy, setReviewBusy] = useState(false), [reviewError, setReviewError] = useState('');
  const [tab, setTab] = useState('policies');
  const [policies, setPolicies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [docs, setDocs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [customPolicyCategories, setCustomPolicyCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('vault_policy_categories');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [customDocCategories, setCustomDocCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('vault_doc_categories');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState('');
  const [peopleError, setPeopleError] = useState('');
  const [docsError, setDocsError] = useState('');
  const [logsError, setLogsError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState('recent');
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { const saved = () => setRefresh(value => value + 1); window.addEventListener('aster-vault-saved', saved); return () => window.removeEventListener('aster-vault-saved', saved); }, []);
  const request = useRef(0);
  const located = useRef(null);
  useEffect(() => { if (!location?.id || located.current === location.id) return; if (location.userid) { const person = employees.find(item => item.userid === location.userid); if(!person)return; setEmployee(person); setTab('personnel'); } else { if(location.documentId) { const doc=policies.find(item=>item.id===location.documentId); if(!doc)return; setPreview(doc); } setTab('policies'); setPolicyView(location.policyView || 'library'); } setSearch(''); setCategory('All'); setStatus('All'); located.current=location.id; }, [location,employees,policies]);
  const personnel = tab === 'personnel';
  const isLogsTab = tab === 'logs';
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

  useEffect(() => {
    if (tab === 'logs') {
      let alive = true;
      setLogsLoading(true);
      setLogsError('');
      documentVaultApi.logs()
        .then(res => {
          if (alive) setLogs(Array.isArray(res?.data) ? res.data : []);
        })
        .catch(err => {
          if (alive) setLogsError(err.message || 'Audit logs could not be retrieved.');
        })
        .finally(() => {
          if (alive) setLogsLoading(false);
        });
      return () => { alive = false; };
    }
  }, [tab, refresh]);

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
      await documentVaultApi.verify(doc.id, next, doc.title);
      setDocs(current => current.map(d => d.id === doc.id && d.userid === owner ? { ...d, verified: next } : d));
      toast('success', 'Review status updated', next ? 'Document marked as verified.' : 'Document marked for review.');
    } catch (err) { toast('error', 'Could not update document', err.message); } finally { setVerifying(null); }
  }

  async function toggleActive(doc) {
    if (toggling) return;
    setToggling(doc.id);
    const isCurrentlyActive = doc.is_active !== false && doc.active !== false && doc.status !== 'disabled';
    const nextActive = !isCurrentlyActive;
    try {
      await documentVaultApi.toggleStatus(doc.id, nextActive, doc.title);
      const updatedPatch = {
        is_active: nextActive,
        active: nextActive,
        status: nextActive ? 'active' : 'disabled'
      };
      if (personnel) {
        setDocs(current => current.map(d => d.id === doc.id ? { ...d, ...updatedPatch } : d));
      } else {
        setPolicies(current => current.map(d => d.id === doc.id ? { ...d, ...updatedPatch } : d));
      }
      toast('success', nextActive ? 'Document enabled' : 'Document disabled', `Status changed to ${nextActive ? 'Active' : 'Disabled'}.`);
    } catch (err) {
      toast('error', 'Status update failed', err.message);
    } finally {
      setToggling(null);
    }
  }

  function handleSaveEdit(updated) {
    if (personnel) {
      setDocs(current => current.map(d => d.id === updated.id ? { ...d, ...updated } : d));
    } else {
      setPolicies(current => current.map(d => d.id === updated.id ? { ...d, ...updated } : d));
    }
    setEditing(null);
    toast('success', 'Document updated', `${updated.title} was saved in real-time.`);
  }

  function handleSaveCategory({ name, targetScope }) {
    if (targetScope === 'policy' || targetScope === 'both') {
      setCustomPolicyCategories(prev => {
        const next = prev.includes(name) ? prev : [...prev, name];
        try { localStorage.setItem('vault_policy_categories', JSON.stringify(next)); } catch {}
        return next;
      });
    }
    if (targetScope === 'personnel' || targetScope === 'both') {
      setCustomDocCategories(prev => {
        const next = prev.includes(name) ? prev : [...prev, name];
        try { localStorage.setItem('vault_doc_categories', JSON.stringify(next)); } catch {}
        return next;
      });
    }
    setCategory(name);
    setAddingCategory(false);
    toast('success', 'Category added', `Category "${name}" is now available.`);
  }

  function switchTab(next) { setTab(next); setCategory('All'); setStatus('All'); setSearch(''); }
  function clearFilters() { setSearch(''); setCategory('All'); setStatus('All'); setPolicyDepartment('All'); }

  const approvedPolicies = policies.filter(doc => !documentReview(doc).draft);
  const humanDrafts = policies.filter(doc => documentReview(doc).draft && documentReview(doc).origin === 'human');
  const aiDrafts = policies.filter(doc => documentReview(doc).draft && documentReview(doc).origin === 'ai');
  const policyRecords = policyView === 'human' ? humanDrafts : policyView === 'ai' ? aiDrafts : approvedPolicies;
  const uploadedDocs=docs.filter(doc=>doc.delivery!=='company'), sharedDocs=docs.filter(doc=>doc.delivery==='company');
  const records = personnel ? employeeView==='company'?sharedDocs:uploadedDocs : policyRecords;
  const busy = personnel ? docsLoading || peopleLoading : (isLogsTab ? logsLoading : loading);
  const loadError = personnel ? docsError || peopleError : (isLogsTab ? logsError : error);
  const baseCategories = personnel
    ? [...DEFAULT_DOCUMENT_CATEGORIES, ...customDocCategories]
    : [...DEFAULT_POLICY_CATEGORIES, ...customPolicyCategories, ...aiPolicyCategories];
  const categories = [...new Set([...baseCategories, ...records.map(d => d.category || d.doc_type).filter(Boolean)])];
  const verified = docs.filter(d => isTrue(d.verified)).length;
  const mandatory = approvedPolicies.filter(d => isTrue(d.mandatory_acknowledgement)).length;

  const filtered = records.filter(d => {
    const match = [d.title, d.description, d.file_name, d.document_number, d.uploaded_by].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase());
    const statusMatch = status === 'All' || (personnel ? employeeView==='company' ? status==='Draft' ? d.draft : !d.draft : status === 'Verified' ? isTrue(d.verified) : !isTrue(d.verified) : status === 'Required' ? isTrue(d.mandatory_acknowledgement) : !isTrue(d.mandatory_acknowledgement));
    const departmentMatch=personnel||policyDepartment==='All'||!d.applicable_departments?.length||d.applicable_departments.includes(policyDepartment);
    return match && statusMatch && departmentMatch && (category === 'All' || (d.category || d.doc_type) === category);
  }).sort((a, b) => sort === 'name' ? (a.title || '').localeCompare(b.title || '') : (Date.parse(b.created_at || b.effective_date) || 0) - (Date.parse(a.created_at || a.effective_date) || 0));

  const filteredLogs = logs.filter(log => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      (log.action || '').toLowerCase().includes(term) ||
      (log.target || '').toLowerCase().includes(term) ||
      (log.user || '').toLowerCase().includes(term) ||
      (log.ip || '').toLowerCase().includes(term) ||
      (log.detail || '').toLowerCase().includes(term)
    );
  });

  const hasFilters = (!personnel && policyDepartment!=='All') || search || category !== 'All' || status !== 'All';
  const pendingItem=policyJob?.items.find(item=>!policies.some(doc=>doc.id===(item.savedId||`policy-${policyJob.id}-${item.id}`)));
  const showPending=!personnel&&policyView==='ai'&&pendingItem&&['queued','generating','waiting','saving','complete'].includes(policyJob?.runState)&&(!search||pendingItem.title.toLowerCase().includes(search.toLowerCase()))&&(category==='All'||category===pendingItem.category)&&(policyDepartment==='All'||!policyJob.departments?.length||policyJob.departments.includes(policyDepartment));

  if (preview) return <div className="tenant-dashboard document-vault"><DocumentWorkspace key={preview.id} doc={preview} onClose={()=>setPreview(null)} onDownload={download} onSaved={()=>setRefresh(value=>value+1)}/></div>;
  return <div className="tenant-dashboard document-vault">
    <TenantHeader
      settings={{
        subheading: "WORKSPACE / COMPLIANCE",
        heading: "Document Vault & Compliance Repository",
        paragraph: "Company policies, employee records, and document activity in one place.",
        buttons: isLogsTab ? [] : [
          { id: 'assistantSettings', label: 'Document assistant settings', variant: 'outline' },
          { id: 'addCategory', label: 'Add category', variant: 'secondary' },
          { id: 'upload', label: 'Upload ' + (personnel ? 'document' : 'policy'), variant: 'colored' }
        ],
        refresh: true
      }}
      actions={{
        refresh: { onClick: () => setRefresh(v => v + 1), loading: busy },
        assistantSettings: { icon: Sparkles, onClick: () => setAssistantSettings(true) },
        addCategory: { icon: Tag, onClick: () => setAddingCategory(true) },
        upload: { icon: Plus, disabled: personnel && (!employee || peopleLoading || !!peopleError), onClick: () => setAdding(true) }
      }}
    />

    {aiRequest && <VaultAiComposer request={aiRequest} references={[...new Map([...policies,...docs].map(doc => [doc.id,doc])).values()]} onStarted={onAiStarted} onSaved={() => setRefresh(v => v + 1)}/>}
    <MetricOverview loading={loading} aria-label="Document repository overview">
      {[
        { icon: FolderOpen, label: 'Company policies', value: loading || error ? '—' : policies.length, detail: 'Across your organization', color: 'violet' },
        { icon: ShieldCheck, label: 'Acknowledgement required', value: loading || error ? '—' : mandatory, detail: 'Policies requiring employee sign-off', color: 'green' },
        { icon: Users, label: 'Employee directory', value: peopleLoading || peopleError ? '—' : employees.length, detail: 'Individual personnel vaults', color: 'blue' },
        { icon: History, label: 'Audit trail events', value: logsLoading ? '...' : logs.length, detail: 'Recorded document activity', color: 'amber' }
      ].map(({ icon: Icon, ...stat }) => (
        <MetricCard key={stat.label} loading={stat.label === 'Employee directory' ? peopleLoading : stat.label === 'Audit trail events' ? logsLoading : loading} label={stat.label} icon={Icon} value={stat.value} caption={stat.detail} />
      ))}
    </MetricOverview>

    <ViewTabs label="Document libraries" value={tab} onChange={switchTab} tabs={[{id:'policies',label:'Company policies',icon:FolderLock,count:!loading&&!error?policies.length:null},{id:'personnel',label:'Employee documents',icon:Users},{id:'logs',label:'Audit trail',icon:History,count:logs.length||null}]}/>

    {isLogsTab ? (
      <div className="workspace-grid vault-workspace vault-workspace--logs">
        <TenantPanel className="vault-library vault-library--full" title="Document activity"
            subtitle="Uploads, reviews, and changes to your document repository."
          >
          <div className="vault-library-body">
            <div className="vault-toolbar">
              <UniversalSearch className="vault-search" scope="vault-audit" variant="outlined" label="Search audit logs" placeholder="Search document activity..." value={search} onChange={setSearch} showKeyboardHint={false} />
            </div>

            <div className="vault-results-bar">
              <span aria-live="polite">
                <SectionSkeleton loading={logsLoading}>{logsLoading ? 'Loading audit records…' : `Showing ${filteredLogs.length} of ${logs.length} audit entries`}</SectionSkeleton>
                {search && <Button onClick={() => setSearch('')} variant="outline" type="submit" wrapContent={false}>Clear search</Button>}
              </span>
            </div>

            <SectionSkeleton loading={logsLoading}>{logsLoading ? (
              <div className="vault-empty" role="status"><RefreshCw className="vault-spin" /><h3>Loading audit logs…</h3></div>
            ) : logsError ? (
              <div className="vault-empty" role="alert"><AlertCircle /><h3>{logsError}</h3><Button variant="secondary" onClick={() => setRefresh(v => v + 1)}>Try again</Button></div>
            ) : !filteredLogs.length ? (
              <div className="vault-empty">
                <ShieldAlert size={36} />
                <h3>{search ? 'No matching audit logs' : 'No audit records yet'}</h3>
                <p>{search ? 'Try adjusting your search criteria.' : 'Any document modification, enable/disable toggle, upload, or review action will appear here in real-time.'}</p>
              </div>
            ) : (
              <div className="vault-audit-table-wrap">
                <table className="vault-audit-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action Event</th>
                      <th>Target Document</th>
                      <th>Actor / User</th>
                      <th>IP &amp; Device</th>
                      <th>Activity Details</th>
                      <th>Risk / Integrity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(log => {
                      const isStatusChange = log.action === 'STATUS_TOGGLE';
                      const isSuspicious = log.action === 'DELETE' || log.action === 'ARCHIVE';
                      return (
                        <tr key={log.id}>
                          <td className="vault-audit-time">
                            <Clock size={13} />
                            {new Date(log.timestamp).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit', second: '2-digit'
                            })}
                          </td>
                          <td>
                            <Badge variant={isSuspicious ? 'warning' : 'info'}>{log.action?.replaceAll('_', ' ')}</Badge>
                          </td>
                          <td className="vault-audit-target">
                            <strong>{log.target || log.document_id || 'System'}</strong>
                          </td>
                          <td className="vault-audit-user">
                            <span>{log.user || 'Admin'}</span>
                          </td>
                          <td className="vault-audit-ip">
                            <code>{log.ip || 'Not recorded'}</code>
                          </td>
                          <td className="vault-audit-detail">
                            {log.detail || '—'}
                          </td>
                          <td>
                            <Badge variant={isSuspicious ? 'warning' : isStatusChange ? 'info' : 'neutral'}>{isSuspicious ? 'Review' : isStatusChange ? 'Status changed' : 'Recorded'}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}</SectionSkeleton>

            <footer className="vault-library-footer">
              <ShieldCheck size={14} /> Document changes are recorded for review and accountability.
            </footer>
          </div>
        </TenantPanel>
      </div>
    ) : (
      <div className={`vault-workspace workspace-grid ${personnel ? 'vault-workspace--personnel' : ''}`}>
        {personnel ? (
          <EmployeeDirectory
            employees={employees}
            selectedId={employee?.userid}
            onSelect={person => { setEmployee(person); clearFilters(); }}
            loading={peopleLoading}
            error={peopleError}
            onRefresh={() => setRefresh(v => v + 1)}
            subtitle="Choose an employee to view their documents."
            pageSize={8}
          />
        ) : (
          <TenantPanel className="vault-sidebar" title="Categories" subtitle="Browse company policies" icon={FolderOpen}>
            
            
            <Button className={category === 'All' ? 'selected' : ''} onClick={() => setCategory('All')} variant={category === 'All' ? "colored" : "fadeout"} type="button" layout="row" wrapContent={false}>
              <FolderOpen size={17} />All documents<span>{policyRecords.length}</span>
            </Button>
            <div className="vault-sidebar-label vault-category-label">
              <span>CATEGORIES</span>
              <Button type="button" className="vault-add-cat-btn" title="Create new category" onClick={() => setAddingCategory(true)} variant="outline" wrapContent={false}>
                <Plus size={13} /> Add
              </Button>
            </div>
            {categories.map((cat, index) => (
              <Button key={cat} className={category === cat ? 'selected' : ''} onClick={() => setCategory(cat)} variant={category === cat ? "colored" : "fadeout"} type="button" layout="row" wrapContent={false}>
                <i className={`vault-dot vault-dot--${index % 5}`} />
                {cat}
                <span>{policyRecords.filter(p => p.category === cat).length}</span>
              </Button>
            ))}
          </TenantPanel>
        )}

        <TenantPanel className="vault-library" controls={!personnel&&<CompanyPolicyGenerator onJob={handlePolicyJob} onCategories={setAiPolicyCategories} onDepartments={setPolicyDepartments} onSaved={record=>{setPolicies(old=>[record,...old.filter(doc=>doc.id!==record.id)]);setPolicyView('ai');}}/>}
            title={personnel ? `${personName(employee)}’s documents` : category === 'All' ? (policyView === 'human' ? 'Human policy drafts' : policyView === 'ai' ? 'AI policy drafts' : 'Company policy library') : category}
            subtitle={personnel ? (employee ? `${personName(employee)} · ${verified} of ${docs.length} documents verified` : 'Select an employee') : 'Drafts require approval before appearing in the company library.'}
          >
          <div className="vault-library-body">
            {personnel && <ViewTabs label="Employee document sources" value={employeeView} onChange={value=>{setEmployeeView(value);clearFilters();}} tabs={[{id:'uploaded',label:'Uploaded documents',icon:UploadCloud,count:uploadedDocs.length},{id:'company',label:'Shared by company',icon:FolderLock,count:sharedDocs.length}]}/>}
            {!personnel && <ViewTabs label="Policy review stages" value={policyView} onChange={value => { setPolicyView(value); clearFilters(); }} tabs={[{ id:"library",label:"Finalized",icon:ShieldCheck,count:approvedPolicies.length },{ id:"human",label:"Human drafts",icon:Edit3,count:humanDrafts.length },{ id:"ai",label:"AI drafts",icon:Sparkles,count:aiDrafts.length }]}/>}
            <div className="vault-toolbar">
              {!personnel&&<select aria-label="Filter policies by department" value={policyDepartment} onChange={event=>setPolicyDepartment(event.target.value)}><option value="All">All departments</option>{policyDepartments.map(name=><option key={name} value={name}>{name}</option>)}</select>}
<UniversalSearch className="vault-search" scope="vault-documents" variant="outlined" label="Search documents" placeholder="Search documents..." value={search} onChange={setSearch} showKeyboardHint={false} />
              <select aria-label="Filter by review or acknowledgement status" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="All">All statuses</option>
                {(personnel ? employeeView==='company' ? ['Draft','Approved'] : ['Needs review', 'Verified'] : ['Required', 'Optional']).map(s => (
                  <option key={s} value={s}>{personnel ? s : `${s} acknowledgement`}</option>
                ))}
              </select>
              {personnel && (
                <select aria-label="Document category" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="All">All categories</option>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              )}
            </div>

            <div className="vault-results-bar">
              <span aria-live="polite">
                <SectionSkeleton loading={busy}>{busy ? 'Loading documents…' : `Showing ${filtered.length} of ${records.length} documents`}</SectionSkeleton>
                {hasFilters && <Button onClick={clearFilters} variant="outline" type="submit" wrapContent={false}>Clear filters</Button>}
              </span>
              <div>
                <select aria-label="Sort documents" value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="recent">Newest first</option>
                  <option value="name">Name A–Z</option>
                </select>
              </div>
            </div>

            <SectionSkeleton loading={busy}>{busy ? (
              <div className="vault-empty" role="status"><RefreshCw className="vault-spin" /><h3>Loading your documents…</h3></div>
            ) : loadError ? (
              <div className="vault-empty" role="alert"><AlertCircle /><h3>{loadError}</h3><Button variant="secondary" onClick={() => setRefresh(v => v + 1)}>Try again</Button></div>
            ) : !filtered.length&&!showPending ? (
              <div className="vault-empty">
                <FolderOpen size={36} />
                <h3>{hasFilters ? 'No matching documents' : 'Your library starts here'}</h3>
                <p>{hasFilters ? 'Try another keyword, category, or status.' : 'Upload an original file to make it available for preview and download.'}</p>
                <Button variant="secondary" disabled={!hasFilters && personnel && !employee} onClick={hasFilters ? clearFilters : () => setAdding(true)}>
                  {hasFilters ? 'Clear filters' : 'Upload first document'}
                </Button>
              </div>
            ) : (
              <div className="workspace-grid vault-documents">
                {showPending&&<article key={pendingItem.savedId||`policy-${policyJob.id}-${pendingItem.id}`} className="card vault-document vault-document--generating" aria-busy="true" aria-label={`Generating ${pendingItem.title}`}><div className="vault-document-top"><FileIcon doc={{format:'DOCX'}}/><span className="vault-status"><Sparkles size={12}/> AI draft</span></div><span className="vault-category">{pendingItem.category}</span><h3>{pendingItem.title}</h3><div className="vault-generation-lines" aria-hidden="true"><i/><i/><i/></div><div className="vault-generation-status" role="status"><Sparkles size={16}/><span>Please wait<span className="vault-generation-dots" aria-hidden="true">...</span><small>Creating your document</small></span></div><div className="vault-generation-lines vault-generation-lines--footer" aria-hidden="true"><i/><i/></div></article>}
                {filtered.map(doc => {
                  const isDocActive = doc.is_active !== false && doc.active !== false && doc.status !== 'disabled';
                  return (
                    <TenantPanel className="vault-document" key={doc.id} title={doc.title} subtitle={doc.category || doc.doc_type || 'General'} icon={FileText} headingLevel={3}
                      controls={<Badge variant={!isDocActive ? 'danger' : doc.draft || (personnel && !isTrue(doc.verified) && doc.delivery!=='company') ? 'warning' : 'success'}>{!isDocActive ? 'Disabled' : doc.draft ? 'Draft' : personnel ? doc.delivery==='company' ? 'Shared' : isTrue(doc.verified) ? 'Verified' : 'Needs review' : 'Published'}</Badge>}>
                      <div className="vault-document-content">
                        {!personnel && <p className="vault-document-scope">{doc.applicable_departments?.length ? doc.applicable_departments.join(', ') : 'All departments'}</p>}
                        <p>{doc.description || (personnel ? doc.document_number ? `Reference: ${doc.document_number}` : 'Employee record · Review the original document before verification.' : 'Open this policy to view the original document and its details.')}</p>
                        <div className="vault-file-meta">
                          <span>{formatOf(doc)}</span>
                          <span>{doc.file_size || 'Size not provided'}</span>
                          {doc.draft ? <span>Draft - Pending review</span> : doc.version && <span>v{doc.version}</span>}
                          {!personnel && <Badge variant={isTrue(doc.mandatory_acknowledgement) ? 'warning' : 'neutral'}>{isTrue(doc.mandatory_acknowledgement) ? 'Sign-off required' : 'Reference'}</Badge>}
                        </div>
                      </div>

                      <div className="vault-document-bottom">
                        <div className="vault-document-date">
                          <Clock size={13} />
                          <span>{doc.effective_date ? 'Effective' : 'Added'} {dateLabel(doc.effective_date || doc.created_at)}</span>
                        </div>
                        <div className="vault-document-actions">
                          <Button iconOnly icon={Trash2} variant="fadeout" size="sm" title="Delete document" aria-label={`Delete ${doc.title}`} onClick={() => { setDeleting(doc); setReviewError(""); }}/>{(!personnel || doc.delivery==='company') && doc.draft && <Button className="vault-approve-button" size="sm" icon={ShieldCheck} variant="colored" onClick={() => { setReviewing(doc); setReviewError(""); }}>Approve</Button>}<Button className="vault-action-btn vault-action-btn--edit" iconOnly aria-label={`Edit ${doc.title}`} title="Edit document" onClick={() => setEditing(doc)} variant="fadeout" type="button" wrapContent={false}>
                            <Edit3 size={15} />
                          </Button>
                          <Button className={`vault-action-btn vault-action-btn--toggle ${isDocActive ? 'is-active' : 'is-disabled'}`} iconOnly aria-label={isDocActive ? 'Disable document' : 'Enable document'} aria-pressed={isDocActive} title={isDocActive ? 'Disable document' : 'Enable document'} disabled={toggling === doc.id} onClick={() => toggleActive(doc)} variant={isDocActive ? "colored" : "fadeout"} type="button" wrapContent={false}>
                            <Power size={14} />
                          </Button>
                          <Button className="vault-preview-button" iconOnly aria-label={`Preview ${doc.title}`} title="Preview" onClick={() => setPreview(doc)} variant="fadeout" type="button" wrapContent={false} ><Eye size={15} /></Button>
                          <Button iconOnly aria-label={`Download ${doc.title}`} disabled={!fileUrl(doc) || !!downloading} title={fileUrl(doc) ? `Download ${doc.title}` : 'No file attached'} onClick={() => download(doc)} variant="fadeout" type="button" wrapContent={false}>
                            {downloading === doc.id ? <RefreshCw size={15} className="vault-spin" /> : <Download size={15} />}
                          </Button>
                        </div>
                        {personnel && doc.delivery!=='company' && (
                          <Button className="vault-verify-button" disabled={!!verifying} onClick={() => verify(doc)} variant="fadeout" type="button" wrapContent={false}>
                            <ShieldCheck size={14} />
                            {verifying === doc.id ? 'Updating…' : isTrue(doc.verified) ? 'Mark for review' : 'Mark as verified'}
                          </Button>
                        )}
                      </div>
                    </TenantPanel>
                  );
                })}
              </div>
            )}</SectionSkeleton>
            <footer className="vault-library-footer"><Eye size={14} />Preview PDF and image files. Download other formats to view them.</footer>
          </div>
        </TenantPanel>
      </div>
    )}

    {(reviewing || deleting) && <Modal isOpen onClose={() => { if (!reviewBusy) { setReviewing(null); setDeleting(null); } }} title={deleting ? "Delete document from vault?" : "Approve policy draft?"} size="md"><p>{deleting ? `Remove ?${deleting.title}? from the vault? The original file is retained in storage.` : `Approve ?${reviewing.title}? for ${reviewing.delivery==='company' ? 'the named employee only' : 'the company policy library'}? Review its contents before approval.`}</p>{reviewError && <p role="alert" className="vault-error">{reviewError}</p>}<div className="vault-form-footer"><Button variant="outline" disabled={reviewBusy} onClick={() => { setReviewing(null); setDeleting(null); }}>Cancel</Button><Button variant={deleting ? "danger" : "colored"} loading={reviewBusy} onClick={async () => { setReviewBusy(true); setReviewError(""); try { if (deleting) { await documentVaultApi.archive(deleting.id); setPolicies(old => old.filter(doc => doc.id !== deleting.id)); setDocs(old => old.filter(doc => doc.id !== deleting.id)); setDeleting(null); } else { const result = await documentVaultApi.approve(reviewing.id); setPolicies(old => old.map(doc => doc.id === reviewing.id ? result : doc)); setDocs(old=>old.map(doc=>doc.id===reviewing.id?result:doc)); setReviewing(null); setPolicyView("library"); clearFilters(); } setRefresh(value => value + 1); } catch(error) { setReviewError(error.message); } finally { setReviewBusy(false); } }}>{deleting ? "Delete from vault" : "Approve & publish"}</Button></div></Modal>}
    {assistantSettings && <DocumentAssistantSettings onClose={() => setAssistantSettings(false)}/>}
    
    {editing && <EditDocumentModal doc={editing} personnel={personnel} availableCategories={categories} onClose={() => setEditing(null)} onSave={handleSaveEdit} />}
    {adding && (
      <AddDocument
        personnel={personnel}
        employee={employee}
        availableCategories={categories}
        onClose={() => setAdding(false)}
        onSave={record => {
          if (personnel) { setDocs(current => [record, ...current]); setEmployeeView("uploaded"); }
          else setPolicies(current => [record, ...current]);
          clearFilters();
          if (!personnel) setPolicyView("human");
          setAdding(false);
          toast('success', 'Added to vault', `${record.title} is now in the repository.`);
        }}
      />
    )}
    {addingCategory && (
      <AddCategoryModal
        personnel={personnel}
        onClose={() => setAddingCategory(false)}
        onSave={handleSaveCategory}
      />
    )}
  </div>;
}

export default DocumentsPage;

