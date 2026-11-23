import React, { forwardRef, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import './UniversalSearch.scss';
import { useSearchDesign } from './SearchDesignContext';

/** Shared controlled search field; callers own the searchable data and filtering. */
export const UniversalSearch = forwardRef(function UniversalSearch({
  value = '', onChange, variant = 'outlined', label = 'Search records',
  placeholder = label, disabled = false, className = '', trailing, scope, preview = false, shortcut,
  icon: Icon = Search, showIcon = true, showKeyboardHint = true, style, ...inputProps
}, ref) {
  const settings = useSearchDesign();
  const localRef = useRef(null);
  useEffect(() => {
    if (!shortcut || preview || disabled) return;
    const focus = event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === shortcut.toLowerCase()) { event.preventDefault(); localRef.current?.focus(); } };
    document.addEventListener('keydown', focus); return () => document.removeEventListener('keydown', focus);
  }, [shortcut, preview, disabled]);
  const assigned = preview ? variant : settings?.config.assignments[scope || settings.page] || variant;
  const design = ['outlined', 'filled', 'compact'].includes(assigned) ? assigned : 'outlined';
  return <div style={style} className={`universal-search universal-search--${design} ${className}`}>
    {showIcon && Icon && <Icon size={16} aria-hidden="true" />}
    <input {...inputProps} className="universal-search__input" ref={node => { localRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }} type="search" aria-label={label} placeholder={placeholder}
      value={value ?? ''} disabled={disabled} autoComplete="off"
      onChange={event => onChange?.(event.target.value, event)} />
    {value ? <button type="button" className="universal-search__clear" aria-label={`Clear ${label.toLowerCase()}`}
      disabled={disabled} onClick={() => onChange?.('')}><X size={14} aria-hidden="true" /></button> : trailing || (shortcut && showKeyboardHint && <kbd title={`Press Control or Command and ${shortcut.toUpperCase()}`}>&#8984; / Ctrl {shortcut.toUpperCase()}</kbd>)}
  </div>;
});
