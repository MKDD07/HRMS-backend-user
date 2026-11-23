import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import React, { useState } from 'react';
import { COMPANY_ROLES } from '../../../shared/companyLeadership.mjs';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { Button } from '../../components/ui/Button';
const dateOf = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export function CompanyLeadershipLog({ rows, people, loading, error, onRefresh }) {
  const [date, setDate] = useState('');
  const name = id => { const person = people.find(person => person.id === id); return person?.name || [person?.first_name, person?.last_name].filter(Boolean).join(' ') || id || 'Not assigned'; };
  const filtered = rows.filter(row => !date || dateOf(row.created_at) === date);
  const groups = [...new Set(filtered.map(row => dateOf(row.created_at)))].sort().reverse();
  return <TenantPanel title="Leadership change log" subtitle="Recent draft saves and finalizations, grouped by date.">
    <div className="company-log-toolbar"><label>Change date<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label>{date && <Button size="sm" variant="outline" onClick={() => setDate('')}>All dates</Button>}</div>
    <div className="company-leadership-log"><SectionSkeleton loading={loading}>{loading ? <p role="status">Loading changes…</p> : error ? <p role="alert">{error}</p> : !filtered.length ? <p>No changes recorded{date ? ' for this date' : ' yet'}.</p> : groups.map(day => <section key={day}><h3>{new Date(day + 'T00:00:00+05:30').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' })}</h3>{filtered.filter(row => dateOf(row.created_at) === day).map(row => {
      const finalized = row.action.endsWith('finalized');
      const before = row.details.before?.companyLeadership?.[finalized ? 'finalized' : 'draft'];
      const after = row.details.after?.companyLeadership?.[finalized ? 'finalized' : 'draft'];
      const previous = finalized ? before?.roles || {} : before || {};
      const next = finalized ? after?.roles || {} : after || {};
      const changed = COMPANY_ROLES.filter(role => (previous[role] || '') !== (next[role] || ''));
      return <article key={row.audit_id}><strong>{finalized ? 'Assignments finalized' : 'Draft saved'}</strong><small>{new Date(row.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {name(row.actor_id)}</small>{changed.map(role => <p key={role}><b>{role}</b> · {name(previous[role])} → {name(next[role])}</p>)}{!changed.length && <p>No assignment changes.</p>}</article>;
    })}</section>)}</SectionSkeleton></div>
  </TenantPanel>;
}
