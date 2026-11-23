import React, { forwardRef, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import './Modal.scss';

const openDialogs = new Set();
let previousOverflow;
function lockScroll(dialog, open) {
  if (open && !openDialogs.has(dialog)) {
    if (!openDialogs.size) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openDialogs.add(dialog);
  } else if (!open && openDialogs.delete(dialog) && !openDialogs.size) {
    document.body.style.overflow = previousOverflow;
  }
}

/** Native frame shared by editors that manage their own dialog ref. */
export const ModalFrame = forwardRef(function ModalFrame({ children, size = 'lg', className = '', onCancel, onClick, ...props }, forwardedRef) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const sync = () => lockScroll(dialog, dialog.open);
    const observer = new MutationObserver(sync);
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    sync();
    return () => { observer.disconnect(); lockScroll(dialog, false); };
  }, []);
  return createPortal(<dialog {...props} ref={node => {
    ref.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }} className={`universal-modal modal--${size} ${className}`.trim()} aria-modal="true" onCancel={onCancel} onClick={event => {
    if (onClick) { onClick(event); return; }
    if (event.target !== event.currentTarget) return;
    const dialog = event.currentTarget, bounds = dialog.getBoundingClientRect();
    if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) return;
    // Reuse the editor's Escape guard for backdrop dismissal, including busy/dirty checks.
    const cancel = new Event('cancel', { cancelable: true });
    if (dialog.dispatchEvent(cancel)) dialog.close();
  }}>{children}</dialog>, document.body);
});

/** Controlled modal with native focus trapping and stacked Escape handling. */
export function Modal({ isOpen, onClose, title, subtitle, children, footer, size = 'md', className = '', busy = false, closeOnBackdrop = true, closeOnEscape = true }) {
  const ref = useRef(null);
  const titleId = useId(), subtitleId = useId();
  useEffect(() => {
    if (!isOpen) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    };
  }, [isOpen]);
  if (!isOpen) return null;
  const close = () => { if (!busy) onClose?.(); };
  return <ModalFrame ref={ref} size={size} className={`universal-modal--controlled ${className}`} aria-labelledby={titleId} aria-describedby={subtitle ? subtitleId : undefined} onCancel={event => {
    event.preventDefault();
    if (closeOnEscape) close();
  }} onClick={event => {
    if (!closeOnBackdrop || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  }}>
    <header className="modal__header"><div><h2 className="modal__title" id={titleId}>{title}</h2>{subtitle && <p id={subtitleId}>{subtitle}</p>}</div><Button variant="fadeout" iconOnly size="sm" className="modal__close" icon={X} aria-label="Close modal" disabled={busy} onClick={close} /></header>
    <div className="modal__body">{children}</div>
    {footer && <footer className="modal__footer">{footer}</footer>}
  </ModalFrame>;
}
