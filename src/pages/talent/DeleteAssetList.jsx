import React, { useEffect, useRef, useState } from 'react';
import { Copy, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { talentApi } from '../../lib/talentApi';

export function DeleteAssetList({ list, onClose, onDeleted }) {
  const dialog = useRef(null);
  const [preview, setPreview] = useState(null), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  useEffect(() => {
    dialog.current.showModal(); let active = true;
    talentApi.deletionPreview(list.id).then(value => { if (active) setPreview(value); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [list.id]);
  async function remove(event) {
    event.preventDefault(); if (busy || !preview || name !== preview.title) return;
    setBusy(true); setError('');
    try { const result = await talentApi.deleteList(list.id, { name, token: preview.token }); onDeleted(result); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <dialog className="talent-dialog" ref={dialog} aria-labelledby="delete-asset-list-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><form onSubmit={remove}>
    <header><h2 id="delete-asset-list-title">Delete asset list</h2><Button variant="fadeout" iconOnly icon={X} aria-label="Close" disabled={busy} onClick={onClose} /></header>
    <div className="talent-editor-body">{error && <p className="talent-alert" role="alert">{error}</p>}{!preview && !error && <p role="status">Checking products…</p>}{preview && <>
      {preview.products.length > 0 && <p className="talent-alert" role="alert">This list contains {preview.products.length} product(s). Deleting it will also permanently delete these products, {preview.issues} issue/return record(s), and their photos.</p>}
      {preview.products.length > 0 && <details><summary>View affected products</summary><ul>{preview.products.map(product => <li key={product.id}>{product.title}</li>)}</ul></details>}
      <p>This cannot be undone. Type the exact list name to proceed.</p>
      <div className="talent-actions"><strong>{preview.title}</strong><Button variant="outline" size="sm" icon={Copy} disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(preview.title); setCopied(true); } catch { setError('Could not copy. Select and copy the list name manually.'); } }}>{copied ? 'Copied' : 'Copy name'}</Button></div>
      <label><span>List name</span><input autoComplete="off" value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
    </>}</div><footer><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="danger" icon={Trash2} type="submit" loading={busy} disabled={!preview || name !== preview.title}>Delete list{preview?.products.length ? ' and products' : ''}</Button></footer>
  </form></dialog>;
}
