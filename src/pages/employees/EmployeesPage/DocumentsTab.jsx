import React, { useState } from 'react';
import { CheckCircle2, Download, FileText, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { getStoredDocuments, saveStoredDocuments, downloadDocument } from '../employeeDataHelpers';
import { PanelHeader } from './employeeUi';

const CATEGORIES = [
  'Employment Contract',
  'Legal & Compliance',
  'KYC & Government ID',
  'Tax & Statutory',
  'Academic Credentials',
  'Experience & BGV'
];

const EMPTY_FORM = { title: '', category: CATEGORIES[0], description: '', file: null };
const fieldCls = 'w-full p-1.5 rounded border border-[#D1D5DB] bg-white';

const formatSize = (bytes) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function DocumentsTab({ employee, onShowToast }) {
  const [documents, setDocuments] = useState(() => getStoredDocuments(employee.userid) || []);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const persist = (next) => {
    setDocuments(next);
    saveStoredDocuments(employee.userid, next);
  };

  const closeForm = () => {
    setIsOpen(false);
    setForm(EMPTY_FORM);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((f) => ({ ...f, file, title: f.title || (file ? file.name.replace(/\.[^.]+$/, '') : '') }));
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const newDoc = {
      id: `doc-${Date.now()}`,
      title: form.title.trim(),
      category: form.category,
      format: form.file ? form.file.name.split('.').pop().toUpperCase() : '',
      size: form.file ? formatSize(form.file.size) : '',
      date: new Date().toISOString().split('T')[0],
      verified: false,
      description: form.description.trim()
    };

    persist([newDoc, ...documents]);
    closeForm();
    onShowToast?.({ type: 'success', title: 'Document Saved', message: `${newDoc.title} added to the vault.` });
  };

  const handleDelete = (id) => {
    persist(documents.filter((d) => d.id !== id));
    onShowToast?.({
      type: 'info',
      title: 'Document Removed',
      message: 'The selected document record was removed from the vault.'
    });
  };

  const handleDownload = (doc) => {
    downloadDocument(doc, employee);
    onShowToast?.({ type: 'info', title: 'Document Downloaded', message: `Saved ${doc.title}.` });
  };

  return (
    <div className="space-y-4 pt-1">
      <PanelHeader
        title="Official Employee Documents Vault"
        subtitle="Identity proofs, contracts, certifications, and compliance agreements"
      >
        <Button id="btn-upload-employee-doc" variant="primary" size="xs" icon={Plus} onClick={() => setIsOpen(true)}>
          Upload Document
        </Button>
      </PanelHeader>

      {isOpen && (
        <form onSubmit={handleAdd} className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
            <h5 className="font-semibold text-[#111827]">Add document to {employee.first_name}'s vault</h5>
            <button type="button" onClick={closeForm} className="text-[#5F6368] hover:text-[#111827] cursor-pointer">
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#111827] mb-1">Document Title *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. AWS Certification"
                className={fieldCls}
              />
            </div>
            <div>
              <label className="block font-semibold text-[#111827] mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={fieldCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#111827] mb-1">File</label>
              <input type="file" onChange={handleFile} className={fieldCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#111827] mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief note about the document"
                className={fieldCls}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
            <Button type="button" variant="secondary" size="xs" onClick={closeForm}>Cancel</Button>
            <Button type="submit" variant="primary" size="xs" icon={Upload}>Save Document</Button>
          </div>
        </form>
      )}

      <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-xl overflow-hidden bg-white">
        {documents.length === 0 ? (
          <div className="p-8 text-center text-[#5F6368]">
            No documents yet. Use "Upload Document" to add one.
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="p-3 hover:bg-[#F9FAFB] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] border border-[#E0E7FF] flex items-center justify-center text-[#4F46E5] shrink-0 mt-0.5">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-[#111827] truncate">{doc.title}</p>
                    {doc.format && (
                      <span className="font-mono px-1 rounded bg-[#F3F4F6] text-[#5F6368]">{doc.format}</span>
                    )}
                    {doc.verified && (
                      <span className="font-semibold text-[#059669] flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-[#5F6368] mt-0.5 truncate">
                    {[doc.category, doc.size, `Uploaded: ${doc.date}`].filter(Boolean).join(' • ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleDownload(doc)}
                  className="inline-flex items-center gap-1 px-2 py-1 font-semibold text-[#374151] bg-white border border-[#E5E7EB] rounded-md hover:bg-[#F9FAFB] shadow-2xs cursor-pointer"
                  title="Download Document"
                >
                  <Download className="w-3 h-3 text-[#6B7280]" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className="p-1 rounded text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                  title="Remove Document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
