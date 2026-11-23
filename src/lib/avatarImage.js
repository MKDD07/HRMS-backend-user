import { isAvatarStorageKey } from '../../shared/avatarStorage.mjs';
import { cachedImage } from './imageCache';
import { useEffect, useState } from 'react';
import { COMPANY_API } from './companyAuth';

export function useAvatarImage(source) {
  return useAvatarImageState(source).url;
}

export function useAvatarImageState(source) {
  const [image, setImage] = useState({ source: '', url: '' });
  const value = typeof source === 'string' ? source.trim() : '';
  const key = value.replace(/^\/?storage\//, '').replace(/^\//, '');
  const stored = isAvatarStorageKey(key);
  useEffect(() => {
    if (!stored) return;
    let active = true;
    let objectUrl;
    cachedImage(`${COMPANY_API}/avatar?key=${encodeURIComponent(key)}`)
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ source: value, url: objectUrl });
      }).catch(() => { if (active) setImage({ source: value, url: '' }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [value, key, stored]);
  if (stored) return { url: image.source === value ? image.url : '', loading: image.source !== value };
  if (/^(https?:|blob:|data:image\/)/i.test(value)) return { url: value, loading: false };
  return { url: key.startsWith('images/') ? `https://hrms-api.mkmkataria07.workers.dev/storage/${key}` : '', loading: false };
}
