import React from 'react';

/** Wrap a native input, select, or textarea with its visible label. */
export function FormField({ label, children }) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      {children}
    </label>
  );
}
