import React from 'react';
import './DateRangePicker.scss';

/** Dates use YYYY-MM-DD strings. Pass allowEmpty for open-ended ranges. */
export function DateRangePicker({
  from = '',
  to = '',
  onChange,
  min,
  max,
  label = 'Date range',
  disabled = false,
  allowEmpty = false,
}) {
  function update(event, field) {
    const { value, validity } = event.currentTarget;
    if (!validity.valid || (!value && !allowEmpty)) return;
    onChange(field === 'from' ? value : from, field === 'to' ? value : to);
  }

  return (
    <div className="date-range-picker" role="group" aria-label={label}>
      <label>
        <span>From</span>
        <input
          type="date"
          value={from}
          min={min}
          max={to && (!max || to < max) ? to : max}
          disabled={disabled}
          onChange={event => update(event, 'from')}
        />
      </label>
      <label>
        <span>To</span>
        <input
          type="date"
          value={to}
          min={from && (!min || from > min) ? from : min}
          max={max}
          disabled={disabled}
          onChange={event => update(event, 'to')}
        />
      </label>
    </div>
  );
}
