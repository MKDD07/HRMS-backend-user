import React, { useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarDays, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { dateKey, leaveDates } from './leaveCalendarData';
import { detectHolidayCategory } from '../../components/ui/UniversalCalendar';
import './LeaveSchedule.scss';
import { CalendarDayTooltip } from '../../components/ui/CalendarDayTooltip';

const nameOf = person => [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.name || person?.userid || 'Employee';
const statusOf = leave => String(leave.status || 'Pending').toLowerCase();

const palette = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777', '#0891b2'];
const typeKey = value => String(value || '').trim().toLowerCase();
const fallbackColor = name => palette[Array.from(typeKey(name)).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % palette.length];
const eventColors = color => ({ backgroundColor: `${color}18`, borderColor: color, textColor: '#243247' });

export function LeaveSchedule({ people, leaves, holidays, leaveTypes = [], selectedId, onEmployeeChange, month, onMonthChange, selectedDate, onDateChange, loading }) {
  const calendar = useRef(null);
  const peopleById = useMemo(() => new Map(people.map(person => [person.userid, person])), [people]);
  const events = useMemo(() => {
    const leaveEvents = leaves.flatMap((leave, index) => {
      const days = leaveDates(leave);
      if (!days.length) return [];
      const end = new Date(`${days.at(-1)}T12:00:00`);
      end.setDate(end.getDate() + 1);
      const type = leaveTypes.find(type => [type.name, type.code, type.id].some(value => value != null && typeKey(value) === typeKey(leave.leave_type)));
      const label = type?.name || leave.leave_type || 'Leave';
      const color = /^#[0-9a-f]{6}$/i.test(type?.color || '') ? type.color : fallbackColor(label);
      return [{ id: `leave-${leave.id || index}`, title: nameOf(peopleById.get(leave.userid)), start: days[0], end: dateKey(end), allDay: true, ...eventColors(color), classNames: ['ls-type-event'], extendedProps: { leave, typeLabel: label, typeColor: color } }];
    });
    const seen = new Set();
    const holidayEvents = Object.values(holidays || {}).flatMap((holiday, index) => {
      if (holiday?.active === false || !holiday?.holiday_date) return [];
      const title = holiday.name || holiday.holiday_name || 'Holiday';
      const key = `${holiday.holiday_date}|${typeKey(title)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const category = detectHolidayCategory({ ...holiday, name: title });
      return [{ id: `holiday-${index}`, title, start: holiday.holiday_date, allDay: true, ...eventColors(category.color), classNames: ['ls-type-event'], extendedProps: { typeLabel: category.label, typeColor: category.color } }];
    });
    return [...leaveEvents, ...holidayEvents];
  }, [leaves, peopleById, holidays, leaveTypes]);
  const legend = [...new Map(events.filter(event => event.start.slice(0, 7) === dateKey(month).slice(0, 7)).map(event => [event.extendedProps.typeLabel, { label: event.extendedProps.typeLabel, color: event.extendedProps.typeColor }])).values()];
  const daily = leaves.filter(leave => leaveDates(leave).includes(selectedDate));
  const monthKey = dateKey(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthly = leaves.filter(leave => leaveDates(leave).some(day => day.startsWith(monthKey.slice(0, 7))));
  useEffect(() => { calendar.current?.getApi().gotoDate(monthKey); }, [monthKey]);
  const moveMonth = offset => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    onMonthChange(next);
    onDateChange(dateKey(next));
  };
  return <div className="leave-scheduler" aria-busy={loading}>
    <div className="ls-toolbar">
      <div className="ls-navigation">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button>
        <h3>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={17} /></button>
        <button type="button" className="ls-today" onClick={() => { const today = new Date(); onMonthChange(today); onDateChange(dateKey(today)); }}>Today</button>
      </div>
      <label className="ls-employee-filter"><Users size={16} /><select aria-label="Filter employee" value={selectedId} onChange={event => onEmployeeChange(event.target.value)}><option value="">All employees</option>{people.map(person => <option key={person.userid} value={person.userid}>{nameOf(person)}</option>)}</select></label>
    </div>
    <div className="ls-meta"><span>{loading ? 'Loading leave records…' : `${monthly.length} leave request${monthly.length === 1 ? '' : 's'} this month`}</span><div className="ls-legend">{legend.map(type => <span key={type.label}><i style={{ backgroundColor: type.color }} />{type.label}</span>)}</div></div>
    <div className="ls-calendar"><CalendarDayTooltip events={events}><FullCalendar ref={calendar} plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" initialDate={monthKey} headerToolbar={false} firstDay={1} height="auto" fixedWeekCount={false} showNonCurrentDates={true} dayMaxEvents={2} events={events} editable={false} eventDidMount={arg => arg.el.style.setProperty('--event-type-color', arg.event.borderColor)} dayCellClassNames={arg => dateKey(arg.date) === selectedDate ? ['ls-selected-day'] : []} dateClick={arg => onDateChange(arg.dateStr)} eventClick={arg => onDateChange(dateKey(arg.event.start))} eventContent={arg => <span className="ls-event-label">{arg.event.title}</span>} /></CalendarDayTooltip></div>
    <div className="ls-day-panel" aria-live="polite">
      <div className="ls-day-heading"><div className="ls-day-icon"><CalendarDays size={21} /></div><div><span className="ls-eyebrow">SELECTED DAY</span><h4>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h4></div><span className="ls-count">{daily.length} request{daily.length === 1 ? '' : 's'}</span></div>
      {!daily.length ? <p className="ls-empty">{loading ? 'Loading leave records…' : 'No recorded leave for this day. Select another date to explore the schedule.'}</p> : <div className="ls-day-list">{daily.map((leave, index) => <article key={`${leave.id || index}-${leave.userid}`}><span className="ls-avatar">{nameOf(peopleById.get(leave.userid)).slice(0, 1)}</span><div><strong>{nameOf(peopleById.get(leave.userid))}</strong><small>{leave.leave_type || 'Leave'}</small></div><span className={`leave-pill ${statusOf(leave)}`}>{leave.status || 'Pending'}</span></article>)}</div>}
    </div>
  </div>;
}
