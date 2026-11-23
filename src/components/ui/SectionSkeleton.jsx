import React, { useEffect, useRef } from 'react';
import './SectionSkeleton.scss';

/** Explicit local loading boundary. Never watches sibling cards or photos. */
export function SectionSkeleton({ children, loading = false, className = '', label = 'Loading content', mode = 'auto' }) {
  const previous = useRef(null);
  useEffect(() => { if (!loading) previous.current = { children }; }, [children, loading]);
  useEffect(() => { import('@aejkatappaja/phantom-ui'); }, []);
  const overlay = loading && previous.current && mode !== 'skeleton';
  return <phantom-ui class={className} loading={loading} mode={overlay ? 'overlay' : 'skeleton'} animation="breathe" background-color="var(--color-border)" shimmer-color="var(--color-surface)" loading-label={label}>
    {overlay ? previous.current.children : children}
  </phantom-ui>;
}
