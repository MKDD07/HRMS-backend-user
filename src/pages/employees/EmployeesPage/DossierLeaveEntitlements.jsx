import { LeaveEntitlementsSkeleton } from './LeaveEntitlementsSkeleton';
import React, { useEffect, useState } from 'react';
import { companyCalendarApi } from '../../../lib/companyCalendarApi';
import { accruedBalance, eligibleFor } from '../../../lib/leavePolicy';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

export function DossierLeaveEntitlements({ employee }) {
  const [configuration, setConfiguration] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setConfiguration(null); setError('');
    companyCalendarApi.configuration().then(data => { if (active) setConfiguration(data); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [employee.userid, revision]);
  if (error) return <div role="alert" className="people-error">{error}<Button size="sm" variant="outline" onClick={() => setRevision(value => value + 1)}>Retry</Button></div>;
  if (!configuration) return <LeaveEntitlementsSkeleton />;
  const assignment = (configuration.assignments || []).find(item => item.userid === employee.userid);
  const groups = configuration.groups || [];
  const inferred = groups.find(item => item.active && (item.assignment_mode === 'people'
    ? (item.userids || []).includes(employee.userid)
    : (item.teams || []).some(team => [employee.employment_type, employee.department, employee.type].includes(team))));
  const policy = assignment?.mode === 'group' ? groups.find(item => item.id === assignment.group_id && item.active) : inferred;
  const types = (configuration.leaveTypes || []).filter(type => {
    if (!type.active) return false;
    if (assignment?.mode === 'custom') return assignment.overrides?.[type.id]?.enabled ?? eligibleFor(type, employee);
    return (policy?.leave_type_ids || []).includes(type.id);
  }).map(type => ({ ...type, ...(assignment?.mode === 'custom' ? assignment.overrides?.[type.id] : {}) }));
  return <><p className="dossier-muted">Assigned allowances before approved leave deductions.</p><div className="dossier-leave-entitlements">{types.map(type => <Card key={type.id} className="dossier-leave-entitlement" style={{ '--leave-color': /^#[0-9a-f]{6}$/i.test(type.color || '') ? type.color : 'var(--color-primary)' }}><div><h4>{type.name}</h4><small>{type.code} · {assignment?.mode === 'custom' ? 'Individual policy' : policy?.name || 'Assigned policy'}</small></div><strong>{accruedBalance(type)} <small>days allowance</small></strong></Card>)}</div>{!types.length && <p className="dossier-empty">No leave types assigned to this employee.</p>}</>;
}
