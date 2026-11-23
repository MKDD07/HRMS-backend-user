import React from 'react';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import { TenantPanel } from '../../components/ui/TenantPanel';

/** Initial layout only: no requests, fake totals, or interactive controls. */
export function OverviewLoading() {
  const panel = (title, subtitle, height) => <TenantPanel title={title} subtitle={subtitle}>
    <SectionSkeleton loading label={`Loading ${title.toLowerCase()}`}>
      <div data-shimmer-no-children style={{ height, margin: 'var(--space-5)' }} />
    </SectionSkeleton>
  </TenantPanel>;
  return <div role="status" aria-label="Loading dashboard overview">
    <span className="sr-only">Loading dashboard overview</span>
    <MetricOverview loading aria-label="Workforce overview">
      {['Total headcount', 'Present today', 'Open positions', 'Pending approvals', 'Monthly attrition'].map(label => <MetricCard key={label} label={label} value="" caption="" />)}
    </MetricOverview>
    <div className="workspace-grid overview-top-grid">
      <div className="overview-top-attendance">
        {panel('Attendance trend', 'Daily attendance across your selected dates.', 250)}
      </div>
      <div className="overview-top-notifications">
        {panel('Notifications', undefined, 120)}
      </div>
    </div>
    <div className="workspace-grid">
      <section className="overview-main-column" aria-label="Loading workforce analytics">
        {panel('Headcount by department', 'How your active workforce is distributed', 180)}
      </section>
    </div>
  </div>;
}
