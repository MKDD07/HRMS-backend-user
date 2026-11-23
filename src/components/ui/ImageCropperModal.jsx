import React, { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { avatarThumbnail } from '../../lib/avatarThumbnail';
import './ImageCropperModal.scss';

export function ImageCropperModal({ isOpen, imageSrc, onClose, onCrop, isUploading = false, title = 'Adjust profile photo' }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1), [rotation, setRotation] = useState(0);
  const [area, setArea] = useState(null), [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false), [error, setError] = useState('');
  const busy = exporting || isUploading;
  const reset = () => {setCrop({x:0,y:0});setZoom(1);setRotation(0);};
  useEffect(() => {reset();setArea(null);setReady(false);setError('');}, [imageSrc, isOpen]);
  async function save() {
    if (!area || busy) return;
    setExporting(true);setError('');
    try { await onCrop(await avatarThumbnail(imageSrc, area, rotation)); }
    catch (err) {setError(err.message || 'Photo could not be prepared.');}
    finally {setExporting(false);}
  }
  return <Modal isOpen={isOpen} onClose={onClose} busy={busy} title={title} subtitle="Drag to center your photo. Zoom to frame it comfortably." size="md" className="avatar-crop-editor"
    footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button icon={Check} loading={busy} disabled={!ready || !area || busy} onClick={save}>Save photo</Button></>}>
    <div className="avatar-crop-stage" aria-label="Photo cropping area" aria-busy={!ready}>
      {imageSrc && <Cropper image={imageSrc} crop={crop} zoom={zoom} rotation={rotation} aspect={1} cropShape="round" showGrid={false} objectFit="cover" minZoom={1} maxZoom={3} restrictPosition
        onCropChange={busy ? () => {} : setCrop} onZoomChange={busy ? () => {} : setZoom} onRotationChange={busy ? () => {} : setRotation}
        onCropComplete={(_, pixels) => setArea(pixels)} onMediaLoaded={() => setReady(true)} mediaProps={{onError:()=>setError('This image could not be opened. Choose another photo.')}} />}
    </div>
    <div className="avatar-crop-tools"><div><Button variant="fadeout" size="sm" iconOnly icon={RotateCcw} aria-label="Rotate left" title="Rotate left" disabled={busy || !ready} onClick={()=>{setArea(null);setRotation(value=>(value+270)%360);}}/><Button variant="fadeout" size="sm" iconOnly icon={RotateCw} aria-label="Rotate right" title="Rotate right" disabled={busy || !ready} onClick={()=>{setArea(null);setRotation(value=>(value+90)%360);}}/></div><Button variant="fadeout" size="sm" disabled={busy || !ready} onClick={reset}>Reset</Button></div>
    <label className="avatar-crop-zoom"><span>Zoom <output>{Math.round(zoom*100)}%</output></span><div><ZoomOut size={16} aria-hidden="true"/><input type="range" min="1" max="3" step="0.01" value={zoom} disabled={busy || !ready} onChange={event=>setZoom(Number(event.target.value))} aria-label="Photo zoom"/><ZoomIn size={16} aria-hidden="true"/></div></label>
    <p className="avatar-crop-hint">Saved as an optimized 144 &times; 144 WebP. The circular frame shows how your avatar will appear.</p>
    {error && <p className="avatar-crop-error" role="alert">{error}</p>}
  </Modal>;
}
export default ImageCropperModal;
