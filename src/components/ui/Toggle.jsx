import React from 'react';
import './Toggle.scss';

export function Toggle({
  checked = false,
  onChange,
  disabled = false,
  className = '',
  id,
  name,
  ...props
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      name={name}
      disabled={disabled}
      className={`toggle ${checked ? 'toggle--on' : ''} ${className}`}
      onClick={() => !disabled && onChange && onChange(!checked)}
      {...props}
    />
  );
}
