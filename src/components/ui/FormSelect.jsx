import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { FormField } from './FormField';

export function FormSelect({ label, value, options, placeholder = 'Select an option', onChange, required = false, disabled = false }) {
  const id = useId();
  const container = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.findIndex(option => option.value === value);
  const listId = `${id}-list`;
  const expanded = open && !disabled && options.length > 0;

  useEffect(() => {
    if (expanded) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [expanded, active, listId]);

  useEffect(() => {
    if (!expanded) return;
    const closeOutside = event => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [expanded]);

  function choose(index) {
    if (options[index]) onChange(options[index].value);
    setOpen(false);
  }

  function handleKey(event) {
    const { key } = event;
    if (key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (open) choose(active);
      else { setActive(Math.max(0, selected)); setOpen(true); }
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      const last = options.length - 1;
      const next = key === 'Home' ? 0 : key === 'End' ? last : !open
        ? (selected >= 0 ? selected : key === 'ArrowUp' ? last : 0)
        : Math.max(0, Math.min(last, active + (key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
      setOpen(true);
    }
  }

  const current = options[selected]?.label || placeholder;
  return (
    <div className="form-select" ref={container}>
      <FormField label={label}>
        <button
          type="button" className="form-select__control" role="combobox"
          aria-label={label} aria-required={required} aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
          disabled={disabled}
          onBlur={() => setOpen(false)}
          onClick={event => {
            event.currentTarget.focus({ preventScroll: true });
            setActive(Math.max(0, selected));
            setOpen(value => !value);
          }}
          onKeyDown={handleKey}
        >
          <span className="form-select__value">{current}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </FormField>
      {expanded && <ul className="form-select__list" id={listId} role="listbox" aria-label={label}>
        {options.map((option, index) => (
          <li key={option.value} id={`${listId}-${index}`} className="form-select__option"
            role="option" aria-selected={selected === index} data-active={active === index || undefined}
            onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}
          >
            {option.label}
            {selected === index && <Check size={15} aria-hidden="true" />}
          </li>
        ))}
      </ul>}
    </div>
  );
}
