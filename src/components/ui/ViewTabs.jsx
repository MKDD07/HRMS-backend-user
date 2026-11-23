import React, { useEffect, useRef, useState, useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import './ViewTabs.scss';

/** Universal view switcher: controlled value, optional icon/count and disabled tabs. */
export function ViewTabs({ tabs = [], value, onChange, label = 'Page views', disabled = false, variant = 'default' }) {
  if (variant === 'slider') return <SlidingViewTabs tabs={tabs} value={value} onChange={onChange} label={label} disabled={disabled} />;
  return <nav className="view-tabs" aria-label={label}>
    {tabs.filter(tab => tab.visible !== false).map(({ id, label: title, icon, count, disabled: unavailable }) =>
      <Button key={id} size="sm" variant={value === id ? 'colored' : 'fadeout'} active={value === id} className="view-tabs__button" icon={icon} disabled={disabled || unavailable} aria-pressed={value === id} onClick={() => onChange?.(id)}>
        {title}{count != null && <span className="view-tabs__count">{count}</span>}
      </Button>
    )}
  </nav>;
}

function SlidingViewTabs({ tabs, value, onChange, label, disabled }) {
  const viewport = useRef(null), track = useRef(null);
  const buttons = useRef(new Map());
  const id = useId();
  const [offset, setOffset] = useState(0);
  const [size, setSize] = useState({ width: 0, max: 0 });
  const visible = tabs.filter(tab => tab.visible !== false);
  useEffect(() => {
    const measure = () => {
      const width = viewport.current?.clientWidth || 0;
      const max = Math.max(0, (track.current?.scrollWidth || 0) - width);
      setSize(old => old.width === width && old.max === max ? old : { width, max });
      setOffset(old => Math.min(old, max));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport.current);
    observer.observe(track.current);
    measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const button = buttons.current.get(value);
    if (!button || !size.width) return;
    setOffset(old => Math.max(0, Math.min(size.max, button.offsetLeft < old ? button.offsetLeft : button.offsetLeft + button.offsetWidth > old + size.width ? button.offsetLeft + button.offsetWidth - size.width : old)));
  }, [value, size]);
  function keyboard(event, current) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const enabled = visible.filter(tab => !disabled && !tab.disabled);
    if (!enabled.length) return;
    event.preventDefault();
    const index = enabled.findIndex(tab => tab.id === current);
    const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1) : enabled[(index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    onChange?.(next.id);
    buttons.current.get(next.id)?.focus({ preventScroll: true });
  }
  return <nav className="view-tabs view-tabs--slider" aria-label={label}>
    {size.max > 1 && <button type="button" className="view-tabs__arrow" aria-label="Show earlier sections" aria-controls={id} disabled={offset <= 1} onClick={() => setOffset(old => Math.max(0, old - size.width * .7))}><ChevronLeft size={16} /></button>}
    <div ref={viewport} id={id} className="view-tabs__viewport"><div ref={track} className="view-tabs__track" style={{ transform: `translateX(-${offset}px)` }}>
      {visible.map(({ id, label: title, icon: Icon, count, disabled: unavailable }) => <button key={id} ref={node => { if (node) buttons.current.set(id, node); else buttons.current.delete(id); }} type="button" className={`btn btn--sm view-tabs__button view-tabs__item ${value === id ? 'btn--colored is-active' : 'btn--fadeout'}`} aria-pressed={value === id} disabled={disabled || unavailable} onClick={() => onChange?.(id)} onKeyDown={event => keyboard(event, id)}>{Icon && <Icon size={16} aria-hidden="true" />}<span>{title}</span>{count != null && <span className="view-tabs__count">{count}</span>}</button>)}
    </div></div>
    {size.max > 1 && <button type="button" className="view-tabs__arrow" aria-label="Show later sections" aria-controls={id} disabled={offset >= size.max - 1} onClick={() => setOffset(old => Math.min(size.max, old + size.width * .7))}><ChevronRight size={16} /></button>}
  </nav>;
}
