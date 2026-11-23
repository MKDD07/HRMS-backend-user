import React from 'react';
import { CalendarDays, Pencil, ChartNoAxesCombined } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import './KpiCard.scss';

const monthLabel = value => {
  if (!/^\d{4}-\d{2}$/.test(value || '')) return value || 'Period not set';
  const date = new Date(value + '-01T12:00:00Z');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export function KpiCard({ kpi, onEdit }) {
  const actual = Number(kpi.actual), target = Number(kpi.target);
  const valid = Number.isFinite(actual) && Number.isFinite(target) && target > 0;
  const percent = valid ? Math.max(0, Math.round(actual / target * 100)) : null;
  const format = value => Number.isFinite(value) ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
  return <article className="card overview-card profile-kpi-card">
    <div className="profile-kpi-card__header"><span className="profile-kpi-card__icon"><ChartNoAxesCombined size={17} aria-hidden="true" /></span><h4>{kpi.title}</h4><Button variant="outline" size="sm" iconOnly icon={Pencil} title="Edit KPI" aria-label={`Edit ${kpi.title}`} onClick={() => onEdit(kpi)} /></div>
    <div className="profile-kpi-card__numbers"><div><strong>{format(actual)}</strong><span>of {format(target)} {kpi.unit}</span></div><span className={`profile-kpi-card__percent ${percent >= 100 ? 'is-complete' : ''}`}>{percent == null ? 'No target' : `${percent}% achieved`}</span></div>
    <progress max={100} value={Math.min(100, percent || 0)} aria-label={`${kpi.title} target achievement`} />
    <div className="profile-kpi-card__footer"><span><CalendarDays size={13} aria-hidden="true" />{monthLabel(kpi.period)}</span><span>{!valid ? 'Target unavailable' : actual >= target ? 'Target reached' : `${format(Math.max(0, target - actual))} ${kpi.unit || 'remaining'}${kpi.unit ? ' remaining' : ''}`}</span></div>
  </article>;
}
