import React, { useEffect, useRef, useState } from 'react';
import './ImageWithSkeleton.scss';

/** Shared image loader. Use shape="circle" for avatars; loading covers async URL fetching. */
export function ImageWithSkeleton({ src, alt = '', loading = false, width = '100%', height = '100%', shape = 'rounded', fit = 'cover', className = '', fallback = 'Image unavailable', onError, resetKey = '', ...imageProps }) {
  return <ImageContent key={JSON.stringify([resetKey, src || 'pending'])} {...{ src, alt, loading, width, height, shape, fit, className, fallback, onError, imageProps }} />;
}
function ImageContent({ src, alt, loading, width, height, shape, fit, className, fallback, onError, imageProps }) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const img = ref.current;
    const ready = async () => {
      try { await img.decode?.(); } catch { /* onError handles unavailable images. */ }
      if (active && img.naturalWidth) setLoaded(true);
    };
    if (img?.complete && img.naturalWidth) ready();
    img?.addEventListener('load', ready);
    return () => { active = false; img?.removeEventListener('load', ready); };
  }, []);
  const pending = !failed && (loading || (!!src && !loaded));
  return <span className={`image-with-skeleton image-with-skeleton--${shape} ${className}`} style={{ width, height }} aria-busy={pending}>
    {pending && <span className="image-with-skeleton__placeholder" role="status" aria-label="Loading image" />}
    {src && !failed && <img {...imageProps} ref={ref} src={src} alt={alt} className={loaded && !loading ? 'image-with-skeleton__image' : 'image-with-skeleton__image image-with-skeleton__image--pending'} style={{ objectFit: fit }} onError={event => { setFailed(true); onError?.(event); }} />}
    {(failed || (!src && !loading)) && <span className="image-with-skeleton__fallback">{fallback}</span>}
  </span>;
}
