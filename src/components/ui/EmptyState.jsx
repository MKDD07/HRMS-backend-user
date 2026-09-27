import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({
  title = 'No records found',
  description = 'There are currently no items to display in this view.',
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className = '',
  id
}) {
  return (
    <div
      id={id}
      className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] text-[#5F6368] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-[#27292C]">{title}</h4>
      <p className="text-[13px] text-[#5F6368] max-w-xs mt-1 mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
