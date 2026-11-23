import React, { useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { detectHolidayCategory } from '../../components/ui/UniversalCalendar';
import './HolidayCalendar.scss';
import { CalendarDayTooltip } from '../../components/ui/CalendarDayTooltip';

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function HolidayCalendar({ month, holidays = [], selected, onSelect, onEventSelect, compact = false, onOpen }) {
  const calendar = useRef(null);
  const monthKey = dateKey(new Date(month.getFullYear(), month.getMonth(), 1));
  useEffect(() => { calendar.current?.getApi().gotoDate(monthKey); }, [monthKey]);
  const events = useMemo(() => {
    const seen = new Set();
    return Object.values(holidays).flatMap((holiday, index) => {
      if (!holiday?.holiday_date || holiday.active === false) return [];
      const name = holiday.name || holiday.holiday_name || 'Holiday';
      const key = `${holiday.holiday_date}|${name.trim().toLowerCase()}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const category = detectHolidayCategory({ ...holiday, name });
      return [{ id: String(holiday.id || index), title: name, start: holiday.holiday_date, allDay: true, backgroundColor: category.bgColor, borderColor: category.color, textColor: '#243247', extendedProps: { holiday, category } }];
    });
  }, [holidays]);
  return <CalendarDayTooltip events={events}><div className={`cc-fullcalendar${compact ? ' cc-fullcalendar-compact' : ''}`}>
    <FullCalendar ref={calendar} plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" initialDate={monthKey} headerToolbar={false} firstDay={1} height="auto" fixedWeekCount={false} showNonCurrentDates={!compact} dayMaxEvents={compact ? 1 : 3} events={events} editable={false} eventDidMount={arg => { arg.el.dataset.holidayId = arg.event.id; arg.el.style.setProperty('--event-type-color', arg.event.borderColor); }} dayCellDidMount={arg => { if (onOpen) { arg.el.tabIndex = 0; arg.el.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); onOpen(arg.date, undefined, arg.el.getBoundingClientRect()); } }; } }} dayCellClassNames={arg => selected && dateKey(arg.date) === dateKey(selected) ? ['cc-fc-selected'] : []} dateClick={arg => { if (onOpen) onOpen(arg.date, undefined, arg.dayEl.getBoundingClientRect()); else onSelect?.(arg.date); }} eventClick={arg => { if (onOpen) onOpen(arg.event.start, arg.event.extendedProps.holiday, arg.el.getBoundingClientRect()); else if (onEventSelect) onEventSelect(arg.event.extendedProps.holiday); else onSelect?.(arg.event.start); }} eventContent={arg => <span className="cc-fc-event-label">{arg.event.title}</span>} />
  </div></CalendarDayTooltip>;
}
