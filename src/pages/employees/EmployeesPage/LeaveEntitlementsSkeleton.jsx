import React from 'react';
import './LeaveEntitlementsSkeleton.scss';

export function LeaveEntitlementsSkeleton() {
  return <div className="leave-entitlements-loading" role="status" aria-label="Loading leave allowances">
    <div aria-hidden="true"><span className="leave-entitlements-loading__note" /><div className="leave-entitlements-loading__list">{[0, 1, 2, 3, 4].map(index => <div className="leave-entitlements-loading__card" key={index}><div><span className="leave-entitlements-loading__name" /><span className="leave-entitlements-loading__policy" /></div><div><span className="leave-entitlements-loading__value" /><span className="leave-entitlements-loading__caption" /></div></div>)}</div></div>
  </div>;
}
