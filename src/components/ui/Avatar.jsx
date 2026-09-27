import React, { useState, useEffect } from 'react';
import { useAvatarImage } from '../../lib/avatarImage';

const AVATAR_PALETTES = [
  'from-blue-600 to-indigo-700 text-white',
  'from-purple-600 to-indigo-800 text-white',
  'from-emerald-600 to-teal-800 text-white',
  'from-amber-600 to-orange-700 text-white',
  'from-rose-600 to-pink-700 text-white',
  'from-sky-600 to-blue-800 text-white',
];

export function Avatar({
  src,
  name = 'User',
  size = 'lg', // 'sm' | 'md' | 'lg' | 'xl'
  status = null, // 'online' | 'offline' | 'busy' | 'away'
  className = '',
  avatarId = 0,
  userid = ''
}) {
  const [hasError, setHasError] = useState(false);
  const [liveSrc, setLiveSrc] = useState(src || '');
  const imageSrc = useAvatarImage(liveSrc);

  useEffect(() => { setHasError(false); }, [imageSrc]);

  useEffect(() => {
    setHasError(false);
    setLiveSrc(src || '');
  }, [src]);

  useEffect(() => {
    const handleAvatarUpdate = (e) => {
      const { userid: updatedId, profile_pic_url } = e.detail || {};
      if (updatedId && (updatedId === userid || updatedId === name || (src && src.includes(updatedId)))) {
        setLiveSrc(profile_pic_url);
        setHasError(false);
      }
    };
    window.addEventListener('pulse-avatar-updated', handleAvatarUpdate);
    return () => window.removeEventListener('pulse-avatar-updated', handleAvatarUpdate);
  }, [userid, name, src]);

  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-9 h-9 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-[48px] h-[48px] min-w-[48px] min-h-[48px] text-2xl',
    '2xl': 'w-[120px] h-[120px] min-w-[120px] min-h-[120px] text-3xl'
  };

  const initials = name
    ? name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    : 'U';

  const paletteIndex = avatarId
    ? avatarId % AVATAR_PALETTES.length
    : Math.abs(name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_PALETTES.length);
  const palette = AVATAR_PALETTES[paletteIndex];

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {imageSrc && !hasError ? (
        <img
          src={imageSrc}
          alt={name}
          className={`${sizeMap[size]} rounded-full object-cover`}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full bg-gradient-to-br ${palette} font-semibold flex items-center justify-center border border-[#E5E7EB] shadow-xs`}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          className={`absolute ${
            size === '2xl'
              ? 'bottom-1.5 right-1.5 w-5 h-5'
              : size === 'xl' || size === 'lg'
                ? 'bottom-0.5 right-0.5 w-3.5 h-3.5'
                : 'bottom-0 right-0 w-2.5 h-2.5'
          } flex shrink-0`}
          title={`Status: ${status}`}
        >
          {status === 'Active' || status === 'online' ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-full w-full bg-emerald-500 ring-2 ring-white" />
            </>
          ) : status === 'OnLeave' || status === 'away' ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-full w-full bg-amber-500 ring-2 ring-white" />
            </>
          ) : status === 'busy' ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-full w-full bg-rose-500 ring-2 ring-white" />
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-full w-full bg-slate-400 ring-2 ring-white" />
          )}
        </span>
      )}
    </div>
  );
}
