import React from 'react';

const STATUS_STYLES = {
  Active: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
  OnLeave: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  default: 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]'
};

export const STATUS_DOT = {
  Active: 'bg-[#10B981]',
  OnLeave: 'bg-[#F59E0B]',
  default: 'bg-[#9CA3AF]'
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded font-medium border shrink-0 ${
        STATUS_STYLES[status] || STATUS_STYLES.default
      }`}
    >
      {status || 'Unknown'}
    </span>
  );
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
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-semibold text-[#4F46E5] hover:underline cursor-pointer"
    >
      {children}
    </button>
  );
}

export function SectionCard({ icon: Icon, iconClass = 'text-[#4F46E5]', title, action, className = '', children }) {
  return (
    <div className={`p-4 bg-white rounded-xl border border-[#E5E7EB] space-y-3.5 shadow-2xs ${className}`}>
      <div className="flex items-center justify-between border-b border-[#F1F3F5] pb-2.5">
        <h4 className="text-sm font-semibold text-[#111827] flex items-center gap-1.5">
          {Icon && <Icon className={`w-4 h-4 ${iconClass}`} />}
          {title}
        </h4>
        {action}
      </div>
      {children}
    </div>
  );
}

export function PanelHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F9FAFB] p-3.5 rounded-xl border border-[#E5E7EB]">
      <div>
        <h4 className="text-sm font-semibold text-[#111827]">{title}</h4>
        {subtitle && <p className="text-xs text-[#4B5563] mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
