import { SectionSkeleton } from './SectionSkeleton';
import React from 'react';
import { ArrowUpRight, ChartNoAxesCombined } from 'lucide-react';
import { StatValue } from './StatValue';

export function MetricHeading({ icon: Icon, children }) {
  return <div className="metric-card-label"><span>{children}</span><Icon size={16} aria-hidden="true" /></div>;
}

/** Shared summary card: heading, value and caption match the dashboard reference. */
export function MetricCard({ label, icon = ChartNoAxesCombined, value, caption, loading = false, onClick, as, ...props }) {
  const Element = as || (onClick ? 'button' : 'div');
  const interactive = Element === 'button';
  return <Element {...props} className="metric-card" type={interactive ? 'button' : undefined} onClick={onClick}>
    <MetricHeading icon={icon}>{label}</MetricHeading>
    <StatValue loading={loading}>{value}</StatValue>
    {(caption || onClick) && <p><span>{caption}</span>{onClick && <ArrowUpRight size={13} aria-hidden="true" />}</p>}
  </Element>;
}

export function MetricOverviewSkeleton({ count = 4 }) {
  return <>{Array.from({ length: count }, (_, index) => <SectionSkeleton loading className="metric-card metric-card--loading" key={index} label="Loading metric"><div className="metric-card-label"><span className="metric-card-placeholder metric-card-placeholder--label" /><span className="metric-card-placeholder metric-card-placeholder--icon" /></div><strong><span className="metric-card-placeholder metric-card-placeholder--value" /></strong><p><span className="metric-card-placeholder metric-card-placeholder--caption" /></p></SectionSkeleton>)}</>;
}

export function MetricOverview({ as: Element = 'section', loading = false, children, className = '', singleRow = false, ...props }) {
  const cards = React.Children.toArray(children);
  return <Element {...props} className={['metric-overview', singleRow && 'metric-overview--single-row', className].filter(Boolean).join(' ')} aria-busy={loading}>{loading ? <><span className="metric-overview-status" role="status">Loading summary</span><MetricOverviewSkeleton count={cards.length || 4} /></> : children}</Element>;
}
