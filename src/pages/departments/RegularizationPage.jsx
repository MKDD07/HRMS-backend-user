import React, { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { TenantHeader } from '../../components/ui/TenantHeader';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { WorkflowInbox } from '../../components/hierarchy/WorkflowInbox';
import { workflowApi } from '../../lib/workflowApi';

export function RegularizationPage({ currentUser }) {
  const isAdmin = currentUser?.role === 'company_admin';
  const [people, setPeople] = useState([]);
  const [directoryError, setDirectoryError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const companyId = currentUser?.company_id;

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setPeople([]);
    setDirectoryError(false);
    workflowApi.directory().then(directory => {
      if (active) setPeople(directory);
    }, () => {
      if (active) setDirectoryError(true);
    });
    return () => { active = false; };
  }, [isAdmin, companyId, attempt]);

  return (
    <>
      <TenantHeader settings={{
        heading: 'Regularization',
        paragraph: 'Submit attendance corrections, leave, expenses, and other requests. Review approvals assigned to you.',
      }} />
      <TenantPanel title="Requests & approvals">
        {directoryError && (
          <div className="wf-warning" role="alert">
            The employee list could not be loaded. <Button size="sm" variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry</Button>
          </div>
        )}
        <WorkflowInbox key={companyId} currentUser={currentUser} people={isAdmin ? people : []} showHeading={false} />
      </TenantPanel>
    </>
  );
}
