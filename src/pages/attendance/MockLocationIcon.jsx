import React from 'react';
import { MapPinOff } from 'lucide-react';
import { mockLocationSignals } from './punchEvidence';
export function MockLocationIcon({ record, records, phase = 'date' }) {
  const flagged = (records || [record]).filter(Boolean).some(item => {
    const flags = mockLocationSignals(item);
    return phase === 'in' ? flags.checkIn === true : phase === 'out' ? flags.checkOut === true : flags.any;
  });
  if (!flagged) return null;
  const label = phase === 'in' ? 'Mock location reported at punch-in' : phase === 'out' ? 'Mock location reported at punch-out' : 'Mock location reported for this date; open log details';
  return <span className="attendance-mock-icon" role="img" aria-label={label} title={label}><MapPinOff size={14} aria-hidden="true" /></span>;
}
