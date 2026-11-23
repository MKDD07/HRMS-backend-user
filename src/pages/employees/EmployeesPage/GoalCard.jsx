import React from 'react';
import { CalendarDays, Pencil, Target } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

const percentage = result => Number(result.target) > 0 && Number.isFinite(Number(result.current)) ? Math.min(100, Math.max(0, Number(result.current) / Number(result.target) * 100)) : 0;
const dateLabel = value => { const date = new Date(value + 'T12:00:00Z'); return Number.isNaN(date.getTime()) ? 'No due date' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };

export function GoalCard({ goal, onEdit }) {
  const results = goal.key_results || [];
  const progress = results.length ? Math.round(results.reduce((sum, result) => sum + percentage(result), 0) / results.length) : 0;
  const tone = ({ 'On track': 'on-track', 'At risk': 'at-risk', Completed: 'completed', Cancelled: 'cancelled' })[goal.status] || 'not-started';
  return <article className="card overview-card goal-card">
    <div className="goal-card__header"><span className="goal-card__icon"><Target size={18} aria-hidden="true" /></span><div><h4>{goal.title}</h4><div className="goal-card__meta"><span className={`goal-card__status is-${tone}`}>{goal.status || 'Not started'}</span><span><CalendarDays size={13} aria-hidden="true" /><time dateTime={goal.due_date || undefined}>{dateLabel(goal.due_date)}</time></span></div></div><Button size="sm" variant="outline" iconOnly icon={Pencil} title="Edit goal" aria-label={`Edit ${goal.title}`} onClick={() => onEdit(goal)} /></div>
    <div className="goal-card__body">{results.length > 0 && <div className="goal-card__progress-label"><span>{results.length} key {results.length === 1 ? 'result' : 'results'}</span><strong>{progress}% complete</strong></div>}{results.map((result, index) => <div className="goal-card__result" key={index}><div><span>{result.title}</span><strong>{result.current} <span>/ {result.target}</span></strong></div><progress max={100} value={percentage(result)} aria-label={`${result.title} progress`} /></div>)}{!results.length && <p className="goal-card__no-results">No key results defined.</p>}</div>
  </article>;
}
