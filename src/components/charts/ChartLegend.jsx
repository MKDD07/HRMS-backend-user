import React from 'react';
import './ChartLegend.scss';

/** Accepts explicit items or the payload supplied by a Recharts Legend. */
export function ChartLegend({ items, payload = [], onHighlight, label: legendLabel = 'Chart legend' }) {
  const entries = items || payload.filter(item => item.type !== 'none')
    .map(item => ({ label: item.value, color: item.color }));
  if (!entries.length) return null;

  return (
    <ul className="chart-legend" aria-label={legendLabel}>
      {entries.map(({ id, label, color, detail }, index) => (
        <li key={id ?? index}
          onMouseEnter={onHighlight ? () => onHighlight(index) : undefined}
          onMouseLeave={onHighlight ? () => onHighlight(null) : undefined}
        >
          <span className="chart-legend__swatch" aria-hidden="true" style={{ backgroundColor: color }} />
          <span>{label}</span>
          {detail != null && <strong>{detail}</strong>}
        </li>
      ))}
    </ul>
  );
}
