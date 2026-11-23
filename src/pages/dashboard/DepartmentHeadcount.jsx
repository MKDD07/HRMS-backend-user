import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';

export function DepartmentHeadcount({ data = [], unavailable = false }) {
  const [expanded, setExpanded] = useState(false);
  if (unavailable) return <p className="tenant-empty" role="status">Department headcount is unavailable. Refresh to retry.</p>;
  const departments = [...data].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const total = departments.reduce((sum, item) => sum + item.count, 0);
  if (!total) return <p className="tenant-empty">No active employees in this selection.</p>;
  const visible = expanded ? departments : departments.slice(0, 6);
  return <div className="department-headcount">
    <div className="department-headcount__summary"><div><strong>{total.toLocaleString('en-IN')}</strong><span>Active employees</span></div><span>{departments.length} {departments.length === 1 ? 'department' : 'departments'}</span></div>
    <ul className="department-headcount__list" aria-label="Employees by department">
      {visible.map(item => {
        const share = item.count / total * 100;
        return <li key={item.name}>
          <div className="department-headcount__label"><span>{item.name}</span><div><strong>{item.count.toLocaleString('en-IN')}</strong><span>{share > 0 && share < 1 ? '<1' : Math.round(share)}%</span></div></div>
          <div className="department-headcount__track" aria-hidden="true"><span style={{ width: `${share}%` }} /></div>
        </li>;
      })}
    </ul>
    {departments.length > 6 && <Button variant="fadeout" size="sm" className="department-headcount__more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer departments' : `Show all ${departments.length} departments`}</Button>}
  </div>;
}
