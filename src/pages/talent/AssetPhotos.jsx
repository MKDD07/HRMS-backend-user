import { cachedImage } from '../../lib/imageCache';
import { ImageWithSkeleton } from '../../components/ui/ImageWithSkeleton';
import { compressAssetImage } from '../../lib/assetImageCompression';
import React, { useEffect, useRef, useState } from 'react';
import { COMPANY_API } from '../../lib/companyAuth';
import { Upload, X, Maximize2 } from 'lucide-react';
import './AssetPhotos.scss';
import './AssetEvidence.scss';
import { Button } from '../../components/ui/Button';

const endpoint = (collection, id, stage) => `${COMPANY_API}/talent/${collection}/${encodeURIComponent(id)}/photos?stage=${stage}`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('pulse_hrms_token')}` });
export async function uploadAssetPhoto(collection, record, stage, file) {
  const optimized = await compressAssetImage(file);
  const form = new FormData();
  form.append('image', optimized.image, 'image.webp');
  form.append('thumbnail', optimized.thumbnail, 'thumbnail.webp');
  const response = await fetch(`${endpoint(collection, record.id, stage)}&revision=${record.revision}`, { method: 'POST', headers: headers(), body: form });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Photo upload failed.');
  return { ...record, ...result.data };
}
function Photo(props) {
  return <PhotoContent key={[props.collection, props.recordId, props.stage, props.photo?.id].join(":")} {...props} />;
}
function PhotoContent({ collection, recordId, stage, photo, file, staticPreview = false, enlarge = false }) {
  const [src, setSrc] = useState(''), [expanded, setExpanded] = useState(false), [fullSrc, setFullSrc] = useState(''), [error, setError] = useState('');
  const dialog = useRef(null);
  useEffect(() => {
    setSrc(''); setError('');
    let disposed = false, objectUrl;
    (async () => {
      try {
        let blob = file;
        if (!blob) {
          blob = await cachedImage(`${endpoint(collection, recordId, stage)}&photo=${photo.id}&variant=thumbnail`);
        }
        if (!disposed) { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); }
      } catch (error) { if (!disposed) setError(error.message); }
    })();
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [collection, recordId, stage, photo?.id, file]);
  useEffect(() => {
    if (!expanded || file) return;
    let disposed = false, objectUrl;
    (async () => {
      try {
        const blob = await cachedImage(endpoint(collection, recordId, stage) + '&photo=' + photo.id);
        if (!disposed) { objectUrl = URL.createObjectURL(blob); setFullSrc(objectUrl); }
      } catch (error) { if (!disposed) setError(error.message); }
    })();
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); setFullSrc(''); };
  }, [expanded, collection, recordId, stage, photo?.id, file]);
  const preview = <ImageWithSkeleton src={src} loading={!src && !error} fallback={error || 'Image unavailable'} alt={staticPreview ? 'Product photo' : stage + ' photo'} fit="cover" />;
  if (staticPreview) return <div className="asset-photo-heading-image">{preview}</div>;
  if (!enlarge) return <div className="asset-photo-preview asset-photo-preview--static">{preview}</div>;
  return <><button className="asset-evidence-preview" type="button" disabled={!src || !!error} aria-label={'Enlarge ' + stage + ' photo'} onClick={() => { setExpanded(true); dialog.current.showModal(); }}>{preview}<Maximize2 size={14} aria-hidden="true" /></button>
    <dialog ref={dialog} className="asset-evidence-viewer" aria-label="Enlarged asset photo" onClose={() => setExpanded(false)}><div className="asset-evidence-viewer__body"><header className="asset-evidence-viewer__header"><strong>Photo preview</strong><Button variant="fadeout" iconOnly icon={X} aria-label="Close photo" onClick={() => dialog.current.close()} /></header><ImageWithSkeleton src={file ? src : fullSrc} loading={!(file ? src : fullSrc) && !error} fallback={error || 'Image unavailable'} alt={stage + ' photo enlarged'} height="min(65dvh, 600px)" fit="cover" /></div></dialog>
  </>;
}
export function AssetHeaderPhoto({ record, file }) {
  const photo = record.photos?.purchase?.[0];
  return photo || file ? <Photo collection="assets" recordId={record.id} stage="purchase" photo={photo} file={photo ? undefined : file} staticPreview /> : <div className="asset-photo-heading-image asset-photo-heading-image--empty"><span>No product photo</span></div>;
}
export function AssetPhotoThumbnails({ collection, record }) {
  return <div className="asset-photo-gallery">{Object.entries(record.photos || {}).flatMap(([stage, photos]) => photos.map(photo => <Photo key={photo.id} collection={collection} recordId={record.id} stage={stage} photo={photo} />))}</div>;
}
export function AssetPhotos({ collection, record, pending = {}, onFiles, onRemove, busy }) {
  const [error, setError] = useState('');
  const stages = collection === 'assets' ? [['purchase', 'Product / purchase photo']] : [['issued', 'Issued photo'], ['received', 'Received photo'], ['returned', 'Returned photo']];
  return <section className="asset-evidence-section"><div className="asset-evidence-section__heading"><h3>Photos / screenshots</h3><p>One image per stage, up to 5 MB. Choose an image directly; it is automatically optimized. Click to enlarge.</p></div>{error && <p role="alert" className="asset-evidence-error">{error}</p>}
    <div className="asset-evidence-cards">{stages.map(([stage, label]) => {
      const saved = record.photos?.[stage] || [], queued = pending[stage] || [];
      const allowed = stage !== 'received' && stage !== 'returned' || (stage === 'received' ? !!record.received_date : record.status === 'Returned');
      const disabled = busy || !allowed || saved.length + queued.length >= 1;
      return <div className="asset-evidence-card" key={stage}><header className="asset-evidence-card__header"><h4>{label}</h4><span>{saved.length ? 'Saved' : queued.length ? 'Ready to save' : 'No photo'}</span></header><div className="asset-evidence-gallery">{saved.map(photo => <Photo enlarge key={photo.id} collection={collection} recordId={record.id} stage={stage} photo={photo} />)}{queued.map((file, index) => <div className="asset-evidence-pending" key={index}><Photo enlarge collection={collection} stage={stage} file={file} /><span className="asset-evidence-filename">{file.name}</span><Button variant="fadeout" size="sm" disabled={busy} onClick={() => onRemove(stage, index)}>Remove</Button></div>)}</div>
        {onFiles && !saved.length && !queued.length && <label className={'asset-evidence-upload' + (disabled ? ' asset-evidence-upload--disabled' : '')}><Upload size={22} aria-hidden="true" /><span>Choose image</span><input aria-label={'Upload ' + label.toLowerCase()} type="file" accept="image/*" disabled={disabled} onChange={event => {
          const files = Array.from(event.target.files || []); event.target.value = ''; setError('');
          if (files.length !== 1 || files.length + saved.length + queued.length > 1) { setError('Choose one photo for this stage.'); return; }
          if (files.some(file => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024 || !file.size)) { setError('Choose an image up to 5 MB.'); return; }
          onFiles(stage, files);
        }} /></label>}{onFiles && !allowed && <p className="asset-evidence-card__hint">{stage === 'received' ? 'Set the received date to add a photo.' : 'Choose Returned to add a photo.'}</p>}
      </div>;
    })}</div>
  </section>;
}
