import React from 'react';

export function StatValue({ loading = false, children }) {
  return <strong aria-busy={loading} aria-label={loading ? 'Loading value' : undefined}>
    {loading ? <span className="metric-card-skeleton" aria-hidden="true" /> : children}
  </strong>;
}
