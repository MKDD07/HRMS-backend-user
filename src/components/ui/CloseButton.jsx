import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export function CloseButton({ onClick, label = 'Close', disabled = false }) {
  return (
    <Button
      className="btn--close"
      variant="outline"
      iconOnly
      icon={<X size={16} aria-hidden="true" />}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    />
  );
}
