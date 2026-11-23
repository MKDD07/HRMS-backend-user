import React from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { ViewTabs } from '../../../components/ui/ViewTabs';

export function ProfileTabToolbar({ tab, leaveView, accountView, onLeaveView, onAccountView, month, onMonth, disabled }) {
  const hasMonth = tab === 'attendance' || (tab === 'leave' && leaveView === 'history') || (tab === 'salary' && accountView === 'history');
  const hasViews = tab === 'leave' || tab === 'salary';
  if (!hasMonth && !hasViews) return null;
  const move = direction => {
    const date = new Date(month + '-01T12:00:00Z');
    date.setUTCMonth(date.getUTCMonth() + direction);
    onMonth(date.toISOString().slice(0, 7));
  };
  return <div className="profile-tab-toolbar">
    {tab === 'leave' && <ViewTabs label="Employee leave views" value={leaveView} disabled={disabled} onChange={onLeaveView} tabs={[{ id: 'available', label: 'Available leave' }, { id: 'history', label: 'Leave history' }]} />}
    {tab === 'salary' && <ViewTabs label="Account and payment views" value={accountView} disabled={disabled} onChange={onAccountView} tabs={[{ id: 'accounts', label: 'Account details' }, { id: 'history', label: 'Payment history' }]} />}
    {hasMonth && <div className="profile-month-picker"><button type="button" aria-label="Previous month" disabled={disabled} onClick={() => move(-1)}><ChevronLeft size={16} /></button><label><CalendarDays size={15} aria-hidden="true" /><span className="sr-only">Filter records by month</span><input type="month" value={month} disabled={disabled} aria-label="Filter records by month" onChange={event => { if (event.target.value) onMonth(event.target.value); }} /></label><button type="button" aria-label="Next month" disabled={disabled} onClick={() => move(1)}><ChevronRight size={16} /></button></div>}
  </div>;
}
