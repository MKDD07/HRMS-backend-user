import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';

export function UpcomingHolidays({ holidays = [], today, unavailable = false }) {
  const [expanded, setExpanded] = useState(false);
  if (unavailable) return <p className="tenant-empty" role="status">Calendar unavailable. Refresh to retry.</p>;
  const upcoming = [...holidays].filter(item => item.holiday_date >= today).sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  if (!upcoming.length) return <p className="tenant-empty">No upcoming holidays.</p>;
  const daysUntil = value => Math.round((Date.parse(value + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000);
  const countdown = value => { const days = daysUntil(value); return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`; };
  return <div className="upcoming-holidays">
    <div className="upcoming-holidays__summary"><div><strong>{upcoming.length}</strong><span>Upcoming {upcoming.length === 1 ? 'holiday' : 'holidays'}</span></div><span>{countdown(upcoming[0].holiday_date)}</span></div>
    <ul className="upcoming-holidays__list" aria-label="Upcoming company holidays">
      {(expanded ? upcoming : upcoming.slice(0, 3)).map((holiday, index) => {
        const date = new Date(holiday.holiday_date + 'T12:00:00Z');
        return <li key={holiday.id || holiday.name + holiday.holiday_date}>
          <time dateTime={holiday.holiday_date}><span>{date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })}</span><strong>{date.getUTCDate()}</strong></time>
          <div className="upcoming-holidays__copy"><strong>{holiday.name}</strong><span>{date.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' })} · {holiday.type || 'Company holiday'}</span>{index === 0 && <small>Next holiday</small>}</div>
        </li>;
      })}
    </ul>
    {upcoming.length > 3 && <Button variant="fadeout" size="sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer holidays' : `Show all ${upcoming.length} holidays`}</Button>}
  </div>;
}
