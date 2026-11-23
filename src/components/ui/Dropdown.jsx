import { Button } from './Button';
import React, { useState, useRef, useEffect } from 'react';

export function Dropdown({
  trigger,
  children,
  align = 'right', // 'right' | 'left'
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`dropdown ${className}`} ref={containerRef}>
      <div
        className="dropdown__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`dropdown__menu ${
            align === 'left' ? 'dropdown__menu--left' : ''
          }`}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  icon: Icon,
  danger = false,
  onClick,
  className = ''
}) {
  return (
    <Button type="button" className={`dropdown__item ${className}`} onClick={onClick} variant={danger ? 'danger' : 'fadeout'} layout="row" wrapContent={false}>
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span>{children}</span>
    </Button>
  );
}

export function DropdownDivider() {
  return <div className="dropdown__divider" />;
}

export function DropdownLabel({ children }) {
  return <div className="dropdown__label">{children}</div>;
}
