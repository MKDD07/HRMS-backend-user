import React from 'react';
import { Avatar } from '../../../components/ui/Avatar';
import { Card } from '../../../components/ui/Card';
import { fullName } from '../lib/payrollHelpers';

export function PayrollPersonSummary({ employee, detail, status, actions }) {
  return <Card className="payroll-person-summary"><div className="payroll-person-copy"><Avatar src={employee?.profile_pic_url} avatarId={employee?.avatar_id} name={fullName(employee)} size="md"/><div><h3>{fullName(employee)}</h3><p>{[employee?.designation,employee?.department].filter(Boolean).join(' · ') || 'Employee'}{detail && <span>{detail}</span>}</p></div></div>{status&&<span className="payroll-status">{status}</span>}{actions&&<div className="payroll-person-actions">{actions}</div>}</Card>;
}
