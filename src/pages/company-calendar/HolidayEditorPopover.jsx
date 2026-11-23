import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function HolidayEditorPopover({ anchor, color = '#059669', onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    element.querySelector('input')?.focus();
    return () => element.close();
  }, []);
  const width = Math.min(400, window.innerWidth - 24);
  const left = anchor ? Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)) : (window.innerWidth - width) / 2;
  const top = anchor ? Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - 540)) : Math.max(12, (window.innerHeight - 500) / 2);
  return createPortal(<dialog ref={dialog} className="cc-holiday-popover" aria-label="Holiday editor" style={{ '--calendar-type-color': color, left, top, width }} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <button type="button" className="cc-popover-close" aria-label="Close holiday editor" onClick={onClose}><X size={18} /></button>
    {children}
  </dialog>, document.body);
}
