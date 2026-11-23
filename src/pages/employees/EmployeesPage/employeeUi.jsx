import { StatusBadge as SharedStatusBadge } from '../../../components/ui/StatusBadge';
import { Button } from '../../../components/ui/Button';
import { TenantPanel, TenantPanelHeader } from '../../../components/ui/TenantPanel';
import React from 'react';

export const STATUS_DOT = {
  Active: 'bg-[#10B981]',
  OnLeave: 'bg-[#F59E0B]',
  default: 'bg-[#9CA3AF]'
};

export function StatusBadge({ status }) {
  return <SharedStatusBadge status={status} />;
}

export function IdChip({ children }) {
  return (
    <span className="font-mono font-semibold text-[#4F46E5] bg-[#EEF2FF] px-2 py-0.5 rounded border border-[#E0E7FF]">
      {children}
    </span>
  );
}

export function Detail({ label, children, className = '' }) {
  return (
    <div className={className}>
      <span className="text-[11px] font-medium text-[#6B7280]">{label}</span>
      <p className="text-sm font-semibold text-[#111827] mt-0.5">{children}</p>
    </div>
  );
}

export function EditLink({ onClick, children = 'Edit' }) {
  return (
    <Button type="button" onClick={onClick} className="" variant="outline" wrapContent={false}>
      {children}
    </Button>
  );
}

const headingActions = children => React.Children.toArray(children).filter(React.isValidElement).map((child, index) => ({ ...child.props, id: child.key || index, label: child.props.children }));

export function SectionCard({ icon, title, action, className = '', children }) {
  return <TenantPanel title={title} icon={icon} headingLevel={4} actions={headingActions(action)} className={className}><div className="p-4">{children}</div></TenantPanel>;
}

export function PanelHeader({ title, subtitle, children }) {
  return <TenantPanelHeader title={title} subtitle={subtitle} headingLevel={4} actions={headingActions(children)} />;
}
