import { ModalFrame } from '../../components/ui/Modal';
import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { talentApi } from '../../lib/talentApi';
import { readLetterImage } from '../../lib/letterImages';

export function ConfirmDialog({ title = 'Close this document?', message, onConfirm, onCancel, confirmLabel = 'Discard and close' }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <ModalFrame size="sm" ref={ref} className="letter-confirm" aria-labelledby="letter-confirm-title" onCancel={e => { e.preventDefault(); onCancel(); }}><h2 id="letter-confirm-title">{title}</h2><p>{message || 'Your unsaved changes will be lost. Stay here to save your work first.'}</p><div><Button variant="outline" onClick={onCancel} autoFocus>Keep editing</Button><Button onClick={onConfirm}>{confirmLabel}</Button></div></ModalFrame>;
}

export function LetterSettings({ record, onClose, onSaved }) {
  const [brand, setBrand] = useState(() => record ? JSON.parse(record.content).branding || {} : {});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [dirty, setDirty] = useState(false), [confirm, setConfirm] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  useEffect(() => { const warn = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  function change(key, value) { setDirty(true); setBrand(old => ({ ...old, [key]: value })); }
  const close = () => { if (!busy) { if (dirty) setConfirm(true); else onClose(); } };
  async function upload(key, file) { setBusy(true); setError(''); try { change(key, await readLetterImage(file)); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function save() {
    setBusy(true); setError('');
    try { const empty = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }; const saved = await talentApi.save('letter_settings', { ...record, title: 'Company letterhead', status: 'Published', content: JSON.stringify({ header: empty, body: empty, footer: empty, branding: brand }) }); setDirty(false); onSaved(saved); onClose(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <ModalFrame size="xl" ref={ref} className="lifecycle-editor letter-settings" aria-labelledby="letter-settings-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <header><div><small>COMPANY DEFAULTS</small><h2 id="letter-settings-title">Letterhead & signature</h2></div><Button iconOnly icon={X} aria-label="Close settings" onClick={close} disabled={busy} /></header>
    <div className="lifecycle-editor-body"><p className="lifecycle-hint">Used on new letters across onboarding and offboarding. Existing drafts can apply these settings; finalized papers keep their original letterhead.</p>{error && <p className="talent-alert" role="alert">{error}</p>}
      <div className="letter-input-grid">{[['company_name','Company name'],['company_address','Company address'],['signatory','Authorized signatory'],['signatory_role','Signatory designation']].map(([key,label]) => <label key={key}>{label}<input maxLength={1000} value={brand[key] || ''} disabled={busy} onChange={e => change(key,e.target.value)} /></label>)}</div>
      <div className="letter-brand-grid">{[['logo','Company logo'],['signature','Authorized signature']].map(([key,label]) => <section key={key}><h3>{label}</h3><div className="letter-artwork">{brand[key] ? <img src={brand[key].src} width={brand[key].width} height={brand[key].height} alt={label} /> : <span>Upload {label.toLowerCase()}</span>}</div><label className="letter-upload">PNG or JPEG · maximum 5 MB<input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={e => { if(e.target.files[0]) upload(key,e.target.files[0]); e.target.value=''; }} /></label>{brand[key] && <><label>Width: {brand[key].width}px (maximum 140px)<input type="range" min="20" max="140" value={brand[key].width} disabled={busy} onChange={e => { const width=Number(e.target.value); change(key,{...brand[key],width,height:Math.max(1,Math.round(brand[key].height*width/brand[key].width))}); }} /></label><Button variant="outline" size="sm" disabled={busy} onClick={() => change(key, null)}>Remove image</Button></>}</section>)}</div>
    </div><footer><Button variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button loading={busy} onClick={save}>Save company settings</Button></footer>{confirm && <ConfirmDialog title="Discard settings changes?" onCancel={() => setConfirm(false)} onConfirm={onClose} />}
  </ModalFrame>;
}
