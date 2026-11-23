import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import './CalendarDayTooltip.scss';

export function CalendarDayTooltip({ events, children }) {
  const [hover, setHover] = useState(null);
  const id = useId();
  useEffect(() => {
    const clear = () => setHover(null);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);
    return () => { window.removeEventListener('scroll', clear, true); window.removeEventListener('resize', clear); };
  }, []);
  useEffect(() => { setHover(null); }, [events]);
  const show = event => {
    const cell = event.target.closest('[data-date]');
    if (!cell) { setHover(null); return; }
    const day = cell.dataset.date;
    const records = events.filter(record => record.start <= day && (record.end ? day < record.end : record.start === day));
    if (!records.length) { setHover(null); return; }
    const rect = cell.getBoundingClientRect();
    setHover({ day, records, portalRoot: cell.closest('dialog') || document.body, left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)), top: rect.bottom + 8, bottom: window.innerHeight - rect.top + 8, above: rect.bottom > window.innerHeight - 240 });
  };
  return <div onMouseOver={show} onMouseLeave={() => setHover(null)} onFocus={show} onBlur={() => setHover(null)} onClick={() => setHover(null)} onKeyDown={event => { if (event.key === 'Escape') setHover(null); }}>
    {children}
    {hover && createPortal(<div key={hover.day} id={id} role="tooltip" className="calendar-day-tooltip" style={{ '--calendar-type-color': hover.records[0].extendedProps.typeColor || hover.records[0].borderColor, left: hover.left, ...(hover.above ? { bottom: hover.bottom } : { top: hover.top }) }}>
      <strong className="calendar-day-tooltip-date">{new Date(`${hover.day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })}</strong>
      <div className="calendar-day-tooltip-records">{hover.records.map(record => <div key={record.id} className="calendar-day-tooltip-record" style={{ '--record-color': record.extendedProps.typeColor || record.borderColor }}>
        <i style={{ background: record.extendedProps.typeColor || record.borderColor }} />
        <div><strong>{record.title}</strong><span>{record.extendedProps.typeLabel || record.extendedProps.category?.label}{record.extendedProps.leave ? ` · ${record.extendedProps.leave.status || 'Pending'}` : ''}</span></div>
      </div>)}</div>
    </div>, hover.portalRoot)}
  </div>;
}
