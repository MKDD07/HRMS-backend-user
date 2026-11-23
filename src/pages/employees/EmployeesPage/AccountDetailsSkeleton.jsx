import React from 'react';
import './EmployeeProfileSkeleton.scss';
import './AccountDetailsSkeleton.scss';

export function AccountDetailsSkeleton({ history = false }) {
  return <div className="card overview-card account-loading" role="status" aria-label={history ? 'Loading payment records' : 'Loading account details'}><div aria-hidden="true">
    <div className="account-loading__header"><span className="profile-placeholder account-loading__title" /><span className="profile-placeholder account-loading__action" /></div>
    {history ? <div className="account-loading__history">{[0, 1, 2].map(index => <div key={index}><span className="profile-placeholder" /><span className="profile-placeholder" /><span className="profile-placeholder" /></div>)}</div> : <div className="account-loading__fields">{[0, 1, 2, 3, 4, 5, 6].map(index => <div key={index}><span className="profile-placeholder profile-placeholder--label" /><span className="profile-placeholder profile-placeholder--value" /></div>)}</div>}
  </div></div>;
}
