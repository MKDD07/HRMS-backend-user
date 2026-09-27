import { useEffect, useState } from 'react';
import { COMPANY_API } from './companyAuth';

export function useAvatarImage(source) {
  const [image, setImage] = useState({ source: '', url: '' });
  const value = typeof source === 'string' ? source.trim() : '';
  const key = value.replace(/^\/?storage\//, '').replace(/^\//, '');
  const stored = key.startsWith('profile/');
  useEffect(() => {
    if (!stored) return;
    const controller = new AbortController();
    let objectUrl;
    const token = localStorage.getItem('pulse_hrms_token');
    fetch(`${COMPANY_API}/avatar?key=${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token || ''}` }, signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Photo unavailable'); return response.blob(); })
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ source: value, url: objectUrl });
      }).catch(() => { if (!controller.signal.aborted) setImage({ source: value, url: '' }); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [value, key, stored]);
  if (stored) return image.source === value ? image.url : '';
  if (/^(https?:|blob:|data:image\/)/i.test(value)) return value;
  return key.startsWith('images/') ? `https://hrms-api.mkmkataria07.workers.dev/storage/${key}` : '';
}
