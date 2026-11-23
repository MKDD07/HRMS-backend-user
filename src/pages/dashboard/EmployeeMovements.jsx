import React from 'react';

const dateLabel = value => {
  const date = new Date(value + 'T12:00:00Z');
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export function EmployeeMovements({ people = [] }) {
  if (!people.length) return <p className="tenant-empty">No recorded joiners or exits this month.</p>;
  const sorted = [...people].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return <div className="employee-movements" role="region" tabIndex={0} aria-label="Recent employee joiners and exits">
    <table><thead><tr><th scope="col">Employee</th><th scope="col">Date</th><th scope="col">Movement</th></tr></thead><tbody>{sorted.map(person => <tr key={person.id + person.status + person.date}>
      <td><div className="employee-movements__person"><span className="employee-movements__avatar" aria-hidden="true">{person.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('') || '—'}</span><div><strong>{person.name || 'Employee'}</strong><small>{[person.department || 'Unassigned', person.designation].filter(Boolean).join(' · ')}</small></div></div></td>
      <td><time dateTime={person.date || undefined}>{dateLabel(person.date)}</time></td>
      <td><span className={`employee-movements__status ${person.status === 'Exited' ? 'is-exit' : 'is-joined'}`}>{person.status}</span></td>
    </tr>)}</tbody></table>
  </div>;
}
