import { useEffect, useRef } from 'react';

export function useStickyDashboardColumns() {
  const ref = useRef(null);
  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const columns = [...grid.children];
    let frame;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        columns.forEach(column => { column.removeAttribute('data-sticky'); column.style.removeProperty('--sticky-column-top'); });
        if (window.innerWidth <= 900 || columns.length !== 2) return;
        const heights = columns.map(column => column.getBoundingClientRect().height);
        const index = 1;
        const header = document.getElementById('tenant-admin-header-bar')?.getBoundingClientRect().bottom || 82;
        columns[index].style.setProperty('--sticky-column-top', `${Math.min(header + 16, window.innerHeight - heights[index] - 16)}px`);
        columns[index].setAttribute('data-sticky', 'true');
      });
    }
    const observer = new ResizeObserver(update);
    columns.forEach(column => observer.observe(column));
    window.addEventListener('resize', update);
    update();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', update); };
  }, []);
  return ref;
}
