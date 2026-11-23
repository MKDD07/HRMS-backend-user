import React from 'react';
import { TenantPanel } from './TenantPanel';

export function ChartCard({
  title,
  subtitle,
  actions,
  footer,
  children,
  className = ''
}) {
  return (
    <TenantPanel title={title} subtitle={subtitle} actions={actions} className={className}>
      <div className="chart-card__body">{children}</div>

      {footer && <div className="tenant-panel-footer">{footer}</div>}
    </TenantPanel>
  );
}
