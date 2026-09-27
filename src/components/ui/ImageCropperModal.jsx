import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCw, RotateCcw, ZoomIn, ZoomOut, Check, X, Move, Sparkles, RefreshCw, FlipHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import './ImageCropperModal.css';

export function ImageCropperModal({
  isOpen,
  imageSrc,
  onClose,
  onCrop,
  isUploading = false,
  title = 'Adjust & Crop Photo'
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  const containerRef = useRef(null);
  const imageElementRef = useRef(null);

  // Viewport size in pixels
  const CROP_BOX_SIZE = 280;

  // Reset transforms when opened with new image
  useEffect(() => {
    if (isOpen && imageSrc) {
      setZoom(1);
      setRotation(0);
      setFlipped(false);
      setOffset({ x: 0, y: 0 });
      setImgLoaded(false);

      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.naturalWidth || 400, height: img.naturalHeight || 400 });
        setImgLoaded(true);
      };
      img.src = imageSrc;
    }
  }, [isOpen, imageSrc]);

  // Pointer dragging with Pointer Capture for seamless smooth panning
  const handlePointerDown = (e) => {
    if (isUploading) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragOrigin({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    });
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragOrigin.x,
      y: e.clientY - dragOrigin.y
    });
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(Math.max(0.5, +(prev + delta).toFixed(2)), 4));
  };

  const handleRotate = (deg) => {
    setRotation((prev) => (prev + deg + 360) % 360);
  };

  const handleFlip = () => {
    setFlipped((prev) => !prev);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setFlipped(false);
    setOffset({ x: 0, y: 0 });
  };

  const handleFit = () => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  // Generate cropped output canvas with precision
  const handleApplyCrop = () => {
    if (!imgLoaded || !imageElementRef.current) return;

    const sourceImg = imageElementRef.current;
    const outputSize = 512; // High-res avatar output
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear background
    ctx.clearRect(0, 0, outputSize, outputSize);

    // Calculate scaling ratio from UI crop box (280px) to output (512px)
    const ratio = outputSize / CROP_BOX_SIZE;

    ctx.save();
    // Center of canvas
    ctx.translate(outputSize / 2, outputSize / 2);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Apply horizontal flip
    if (flipped) {
      ctx.scale(-1, 1);
    }

    // Apply pan offset
    const actualOffsetX = (flipped ? -offset.x : offset.x) * ratio;
    const actualOffsetY = offset.y * ratio;
    ctx.translate(actualOffsetX, actualOffsetY);

    // Apply zoom
    ctx.scale(zoom, zoom);

    // Base display dimensions calculated the same way as CSS object-fit contain
    const aspect = (imageSize.width || 1) / (imageSize.height || 1);
    let baseW = outputSize;
    let baseH = outputSize;

    if (aspect > 1) {
      baseW = outputSize * aspect;
      baseH = outputSize;
    } else {
      baseW = outputSize;
      baseH = outputSize / aspect;
    }

    // Draw centered
    ctx.drawImage(sourceImg, -baseW / 2, -baseH / 2, baseW, baseH);
    ctx.restore();

    let croppedDataUrl = '';
    try {
      croppedDataUrl = canvas.toDataURL('image/webp', 0.95);
    } catch {
      croppedDataUrl = canvas.toDataURL('image/png');
    }

    onCrop(croppedDataUrl);
  };

  if (!isOpen) return null;

  // Compute CSS transform matrix for live image layer
  const imageTransform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${flipped ? -1 : 1})`;

  return (
    <div className="crop-modal-overlay" onClick={isUploading ? undefined : onClose}>
      <div className="crop-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="crop-title">
        {/* Header */}
        <header className="crop-modal-header">
          <div className="crop-modal-title">
            <div className="crop-sparkle-badge">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 id="crop-title">{title}</h3>
              <p>Drag to reposition, use slider to zoom & frame perfectly.</p>
            </div>
          </div>
          <button
            type="button"
            className="crop-close-btn"
            onClick={onClose}
            disabled={isUploading}
            aria-label="Close cropper"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body Workspace */}
        <div className="crop-modal-body">
          {/* Main Interactive Viewport */}
          <div className="crop-workspace-view">
            <div
              ref={containerRef}
              className={`crop-viewport ${isDragging ? 'is-dragging' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              style={{ width: `${CROP_BOX_SIZE}px`, height: `${CROP_BOX_SIZE}px` }}
            >
              <div
                className="crop-image-layer"
                style={{
                  transform: imageTransform
                }}
              >
                <img
                  ref={imageElementRef}
                  src={imageSrc}
                  alt="Crop preview source"
                  draggable={false}
                  onLoad={() => setImgLoaded(true)}
                />
              </div>

              {/* Viewfinder Circle Overlay */}
              <div className="crop-mask-overlay">
                <div className="crop-circular-cutout" />
              </div>

              {/* Composition Grid Lines */}
              <div className="crop-grid-overlay" />

              {/* Status Hint */}
              <div className="crop-drag-badge">
                <Move size={12} /> Drag to adjust
              </div>
            </div>

            {/* Viewport Control Strip */}
            <div className="crop-toolbar">
              <button
                type="button"
                className="crop-tool-btn"
                title="Rotate 90° Left"
                onClick={() => handleRotate(-90)}
                disabled={isUploading}
              >
                <RotateCcw size={15} />
                <span>-90°</span>
              </button>
              <button
                type="button"
                className="crop-tool-btn"
                title="Rotate 90° Right"
                onClick={() => handleRotate(90)}
                disabled={isUploading}
              >
                <RotateCw size={15} />
                <span>+90°</span>
              </button>
              <button
                type="button"
                className={`crop-tool-btn ${flipped ? 'is-active' : ''}`}
                title="Flip Horizontally"
                onClick={handleFlip}
                disabled={isUploading}
              >
                <FlipHorizontal size={15} />
                <span>Flip</span>
              </button>
              <button
                type="button"
                className="crop-tool-btn"
                title="Center & Fit"
                onClick={handleFit}
                disabled={isUploading}
              >
                <Maximize2 size={15} />
                <span>Fit</span>
              </button>
              <button
                type="button"
                className="crop-tool-btn"
                title="Reset All Changes"
                onClick={handleReset}
                disabled={isUploading}
              >
                <RefreshCw size={15} />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Real-time Side Preview Panel */}
          <aside className="crop-sidebar-preview">
            <span className="crop-preview-heading">LIVE PREVIEWS</span>

            {/* Circular Avatar Preview */}
            <div className="crop-preview-item">
              <div className="crop-preview-bubble crop-preview-bubble--lg">
                <div
                  className="crop-mini-layer"
                  style={{
                    transform: `translate(${offset.x * (108 / CROP_BOX_SIZE)}px, ${offset.y * (108 / CROP_BOX_SIZE)}px) scale(${zoom * (108 / CROP_BOX_SIZE)}) rotate(${rotation}deg) scaleX(${flipped ? -1 : 1})`
                  }}
                >
                  <img src={imageSrc} alt="" draggable={false} />
                </div>
              </div>
              <span className="crop-preview-tag">Dossier Profile</span>
            </div>

            {/* Small Navigation Avatar Preview */}
            <div className="crop-preview-row">
              <div className="crop-preview-item">
                <div className="crop-preview-bubble crop-preview-bubble--sm">
                  <div
                    className="crop-mini-layer"
                    style={{
                      transform: `translate(${offset.x * (42 / CROP_BOX_SIZE)}px, ${offset.y * (42 / CROP_BOX_SIZE)}px) scale(${zoom * (42 / CROP_BOX_SIZE)}) rotate(${rotation}deg) scaleX(${flipped ? -1 : 1})`
                    }}
                  >
                    <img src={imageSrc} alt="" draggable={false} />
                  </div>
                </div>
                <span className="crop-preview-tag">Navbar</span>
              </div>

              <div className="crop-preview-item">
                <div className="crop-preview-bubble crop-preview-bubble--sm crop-preview-bubble--square">
                  <div
                    className="crop-mini-layer"
                    style={{
                      transform: `translate(${offset.x * (42 / CROP_BOX_SIZE)}px, ${offset.y * (42 / CROP_BOX_SIZE)}px) scale(${zoom * (42 / CROP_BOX_SIZE)}) rotate(${rotation}deg) scaleX(${flipped ? -1 : 1})`
                    }}
                  >
                    <img src={imageSrc} alt="" draggable={false} />
                  </div>
                </div>
                <span className="crop-preview-tag">Card</span>
              </div>
            </div>
          </aside>
        </div>

        {/* Interactive Zoom Slider */}
        <div className="crop-zoom-section">
          <div className="crop-zoom-label">
            <span>Zoom</span>
            <strong>{Math.round(zoom * 100)}%</strong>
          </div>
          <div className="crop-zoom-controls">
            <button
              type="button"
              className="crop-zoom-step-btn"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
              disabled={isUploading || zoom <= 0.5}
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min="0.5"
              max="3.5"
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="crop-zoom-range"
              disabled={isUploading}
              aria-label="Zoom scale"
            />
            <button
              type="button"
              className="crop-zoom-step-btn"
              onClick={() => setZoom((z) => Math.min(3.5, +(z + 0.1).toFixed(2)))}
              disabled={isUploading || zoom >= 3.5}
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <footer className="crop-modal-footer">
          <button
            type="button"
            className="crop-footer-btn crop-footer-btn--cancel"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="crop-footer-btn crop-footer-btn--save"
            onClick={handleApplyCrop}
            disabled={isUploading || !imgLoaded}
          >
            {isUploading ? (
              <>
                <RefreshCw size={16} className="crop-spinning" />
                <span>Saving to Cloudflare R2...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Save & Upload to R2</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ImageCropperModal;
