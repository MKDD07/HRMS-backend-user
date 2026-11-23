import React from 'react';
import { Badge } from './Badge';

const tones = {
  success: ['active', 'enabled', 'approved', 'paid', 'finalized', 'completed', 'hired', 'open', 'published', 'available', 'on track', 'covered', 'verified', 'accepted'],
  warning: ['pending', 'submitted', 'draft', 'planned', 'onleave', 'on leave', 'probation', 'review', 'required', 'self review', 'manager review', 'needs review'],
  danger: ['inactive', 'disabled', 'rejected', 'declined', 'failed', 'expired', 'at risk', 'damaged', 'overdue'],
  info: ['in progress', 'interview', 'offered', 'assigned', 'issued', 'received', 'launched', 'finalize'],
};

export function StatusBadge({ status, variant }) {
  const label = String(status || 'Unknown');
  const tone = variant || Object.keys(tones).find(key => tones[key].includes(label.trim().toLowerCase())) || 'neutral';
  return <Badge variant={tone}>{label === 'OnLeave' ? 'On leave' : label}</Badge>;
}
