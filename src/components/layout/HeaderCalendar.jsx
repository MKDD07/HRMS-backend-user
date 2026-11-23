import React, { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarDays, ChevronLeft, ChevronRight, X, Plus, Bell, Trash2, Maximize2, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { createPortal } from 'react-dom';
import { CalendarDayTooltip } from '../ui/CalendarDayTooltip';
import { detectHolidayCategory } from '../ui/UniversalCalendar';
import { calendarHubApi as companyCalendarApi } from '../../lib/calendarHubApi';
import { api } from '../../lib/api';
import { canUsePage } from '../../../shared/dashboardAccess.mjs';
import { dateKey, leaveDates, normalizeLeaveDate } from '../../pages/leave/leaveCalendarData';
import './HeaderCalendar.scss';

const nameOf = person => [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.name || person?.userid || 'Employee';
const emptyReminder = day => ({ name: '', holiday_date: day, time: '09:00', type: 'Meeting', description: '', location: '', priority: 'Normal', remind_before: 0, reminder: true, active: true });
export function CalendarPanel({ currentUser, allUsers = [], onClose, onOpenPage, fullPage = false }) {
  const dialog = useRef(null), calendar = useRef(null);
  const [month, setMonth] = useState(() => new Date()), [day, setDay] = useState(() => dateKey(new Date()));
  const [config, setConfig] = useState({}), [people, setPeople] = useState(allUsers), [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [draft, setDraft] = useState(null), [saving, setSaving] = useState(false);
  const [filter,setFilter] = useState('all'), [search,setSearch] = useState(''), [view,setView] = useState('dayGridMonth');
  const canEdit = canUsePage(currentUser, 'company-calendar');
  const userId = currentUser?.userid || currentUser?.user_id;
  useEffect(() => { let alive = true;
    (async () => {
      const results = await Promise.allSettled([companyCalendarApi.configuration(), canUsePage(currentUser, 'employees') ? api.getAllUsers({ liveOnly: true }) : Promise.resolve({ data: allUsers }), canUsePage(currentUser, 'leave') ? api.getLeaves(undefined, { liveOnly: true }) : Promise.resolve({ data: [] })]);
      if (!alive) return;
      if (results[0].status === 'fulfilled') setConfig(results[0].value);
      if (results[1].status === 'fulfilled') setPeople(results[1].value.data || []);
      if (results[2].status === 'fulfilled') setLeaves(results[2].value.data || []);
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length) setError('Some calendar records could not be loaded. ' + failures[0].reason.message);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => { calendar.current?.getApi().gotoDate(dateKey(month)); }, [month]);
  useEffect(() => {
    if (fullPage) return;
    const outside = event => { if (!dialog.current?.contains(event.target) && !event.target.closest('[data-header-calendar-trigger]') && !saving) onClose(); };
    const keyboard = event => { if (event.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('mousedown',outside); document.addEventListener('keydown',keyboard);
    return () => { document.removeEventListener('mousedown',outside); document.removeEventListener('keydown',keyboard); };
  }, [fullPage,saving,onClose]);
  const events = useMemo(() => {
    const result = [], seen = new Set(), names = new Map(people.map(person => [person.userid || person.user_id, nameOf(person)]));
    for (const holiday of config.holidays || []) {
      const key = `${holiday.holiday_date}|${holiday.name}`;
      if (holiday.active === false || seen.has(key)) continue;
      seen.add(key); const category = detectHolidayCategory(holiday);
      result.push({ id: `holiday:${holiday.id || key}`, start: holiday.holiday_date, title: holiday.name, borderColor: category.color, extendedProps: { typeLabel: category.label, typeColor: category.color } });
    }
    for (const [index, leave] of leaves.entries()) {
      const days = leaveDates(leave); if (!days.length) continue;
      const end = new Date(days.at(-1) + 'T12:00:00'); end.setDate(end.getDate() + 1);
      const type = (config.leaveTypes || []).find(type => [type.name, type.code].includes(leave.leave_type));
      const color = /^#[0-9a-f]{6}$/i.test(type?.color || '') ? type.color : '#2563eb';
      result.push({ id: `leave:${leave.id || index}`, start: days[0], end: dateKey(end), title: names.get(leave.userid) || leave.userid || 'Employee', borderColor: color, extendedProps: { typeLabel: leave.leave_type || 'Leave', typeColor: color, leave } });
    }
    for (const person of people) {
      const birth = normalizeLeaveDate(person.date_of_birth || person.dob); if (!birth) continue;
      for (const year of [month.getFullYear() - 1, month.getFullYear(), month.getFullYear() + 1]) {
        const date = `${year}-${birth.slice(5)}`; const parsed = new Date(date + 'T12:00:00'); if (dateKey(parsed) !== date) continue;
        result.push({ id: `birthday:${person.userid || person.user_id}:${year}`, start: date, title: nameOf(person), borderColor: '#db2777', extendedProps: { typeLabel: 'Birthday', typeColor: '#db2777' } });
      }
    }
    for (const reminder of config.importantDates || []) if (reminder.active !== false) result.push({ id: `reminder:${reminder.id}`, start: reminder.holiday_date, title: reminder.name, borderColor: '#d97706', extendedProps: { typeLabel: `${reminder.type || 'Reminder'} / ${reminder.time || '09:00'} IST`, typeColor: '#d97706', reminder } });
    return result;
  }, [config, people, leaves, month.getFullYear()]);
  const visibleEvents = events.filter(event => (filter === 'all' || event.id.startsWith(filter + ':')) && (event.title + ' ' + event.extendedProps.typeLabel).toLowerCase().includes(search.toLowerCase()));
  const daily = visibleEvents.filter(event => event.start <= day && (event.end ? day < event.end : event.start === day));
  const selectDay = date => { setDay(date); setDraft(null); };
  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    try { await companyCalendarApi.saveImportantDate(draft); setConfig(await companyCalendarApi.configuration()); setDay(draft.holiday_date); setMonth(new Date(draft.holiday_date + 'T12:00:00')); setDraft(null); window.dispatchEvent(new Event('calendar-reminders-updated')); }
    catch (error) { setError(error.message); } finally { setSaving(false); }
  }
  const content = <section ref={dialog} className={`header-calendar-panel ${fullPage ? 'header-calendar-page' : 'header-calendar-drawer'}`} role={fullPage ? undefined : 'dialog'} aria-modal={fullPage ? undefined : false} aria-labelledby="header-calendar-title">
    <header><div><small>YOUR WORKSPACE</small><h2 id="header-calendar-title">{fullPage ? 'HR Calendar & Planner' : 'Calendar & reminders'}</h2><p>{fullPage ? 'Plan meetings, interviews, training, deadlines and HR alerts.' : 'Your schedule and upcoming alerts.'}</p></div>{!fullPage && <Button iconOnly icon={X} variant="fadeout" aria-label="Close calendar" disabled={saving} onClick={onClose}/>}</header>
    <div className="header-calendar-body">
      {fullPage && <div className="header-calendar-filters"><label><Search size={15}/><input aria-label="Search calendar" placeholder="Search schedules and events" value={search} onChange={event => setSearch(event.target.value)}/></label><select aria-label="Event type" value={filter} onChange={event => setFilter(event.target.value)}>{[['all','All events'],['reminder','Schedules & alerts'],['leave','Leaves'],['holiday','Holidays'],['birthday','Birthdays']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><div>{[['dayGridMonth','Month'],['dayGridWeek','Week']].map(([value,label]) => <Button key={value} size="sm" variant={view === value ? 'colored' : 'fadeout'} onClick={() => { setView(value); calendar.current?.getApi().changeView(value); }}>{label}</Button>)}</div></div>}
      <div className="header-calendar-grid"><div className="header-calendar-month">
      <div className="header-calendar-nav"><Button iconOnly icon={ChevronLeft} variant="fadeout" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}/><h3>{month.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h3><Button iconOnly icon={ChevronRight} variant="fadeout" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}/><Button size="sm" variant="outline" onClick={() => { const now = new Date(); setMonth(now); selectDay(dateKey(now)); }}>Today</Button></div>
      {error && <p className="header-calendar-error" role="alert">{error}</p>}
      {loading && <p role="status">Loading calendar records...</p>}
      <CalendarDayTooltip events={visibleEvents}><FullCalendar ref={calendar} plugins={[dayGridPlugin,interactionPlugin]} initialView="dayGridMonth" headerToolbar={false} firstDay={1} fixedWeekCount={false} height="auto" events={visibleEvents} dayMaxEvents={fullPage ? 3 : 2} dateClick={arg => selectDay(arg.dateStr)} eventClick={arg => selectDay(dateKey(arg.event.start))} dayCellClassNames={arg => dateKey(arg.date) === day ? ['header-calendar-selected'] : []} eventContent={arg => fullPage ? <span className="header-calendar-event" style={{'--event-color':arg.event.borderColor}}>{arg.event.title}</span> : <span className="header-calendar-dot" style={{ background: arg.event.borderColor }} aria-label={arg.event.title}/>} /></CalendarDayTooltip>
      <div className="header-calendar-legend">{[['Leaves','#2563eb'],['Holidays','#059669'],['Birthdays','#db2777'],['Reminders','#d97706']].map(([label,color]) => <span key={label}><i style={{background:color}}/>{label}</span>)}</div>
      </div><div className="header-calendar-detail"><section className="header-calendar-agenda"><div className="header-calendar-agenda-heading"><h3>{new Date(day+'T12:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'long'})}</h3>{canEdit && <Button size="sm" variant="colored" icon={Plus} disabled={loading || saving} onClick={() => setDraft(emptyReminder(day))}>Add reminder</Button>}{!fullPage && canEdit && <Button size="sm" variant="fadeout" iconOnly icon={Maximize2} title="Open full HR calendar" aria-label="Open full HR calendar" onClick={onOpenPage}/>}</div>
        {!daily.length && <p className="header-calendar-empty">Nothing scheduled for this date.</p>}
        {daily.map(event => <article key={event.id} style={{'--agenda-color':event.borderColor}}><i/><div><strong>{event.title}</strong><small>{event.extendedProps.typeLabel}{event.extendedProps.leave ? ` / ${event.extendedProps.leave.status || 'Pending'}` : ''}</small>{event.extendedProps.reminder?.description && <p>{event.extendedProps.reminder.description}</p>}</div>{canEdit && event.extendedProps.reminder?.owner_id === userId && <Button size="sm" variant="fadeout" disabled={saving} onClick={() => setDraft(event.extendedProps.reminder)}>Edit</Button>}</article>)}
      </section>
      {draft && <form className="header-calendar-form" onSubmit={save}><h3>{draft.id ? 'Edit reminder' : 'New reminder'}</h3><label>Title<input autoFocus required maxLength={160} value={draft.name} onChange={event => setDraft({...draft,name:event.target.value})}/></label><div className="header-calendar-form-row"><label>Date<input required type="date" value={draft.holiday_date} onChange={event => setDraft({...draft,holiday_date:event.target.value})}/></label><label>Time (IST)<input required type="time" value={draft.time} onChange={event => setDraft({...draft,time:event.target.value})}/></label><label>Type<select value={draft.type} onChange={event => setDraft({...draft,type:event.target.value})}>{['Meeting','Interview','Training','Payroll deadline','Onboarding','HR alert','Reminder','Deadline','Event'].map(type => <option key={type}>{type}</option>)}</select></label></div><div className="header-calendar-form-row"><label>Location or meeting link<input maxLength={160} value={draft.location || ''} onChange={event => setDraft({...draft,location:event.target.value})}/></label><label>Priority<select value={draft.priority || 'Normal'} onChange={event => setDraft({...draft,priority:event.target.value})}><option>Normal</option><option>High</option></select></label></div><label>Alert timing<select value={draft.remind_before || 0} onChange={event => setDraft({...draft,remind_before:Number(event.target.value)})}>{[[0,'At event time'],[15,'15 minutes before'],[30,'30 minutes before'],[60,'1 hour before'],[1440,'1 day before']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Details<textarea rows={2} maxLength={500} value={draft.description} onChange={event => setDraft({...draft,description:event.target.value})}/></label><label className="header-calendar-alarm"><input type="checkbox" checked={draft.reminder} onChange={event => setDraft({...draft,reminder:event.target.checked})}/><Bell size={14}/>Notify me at the selected alert time</label><small>Reminders appear in your notification inbox when due.</small><footer>{draft.id && <Button type="button" variant="danger" icon={Trash2} disabled={saving} onClick={async () => { setSaving(true); try { await companyCalendarApi.deleteImportantDate(draft.id); setConfig(await companyCalendarApi.configuration()); setDraft(null); window.dispatchEvent(new Event('calendar-reminders-updated')); } catch(error) {setError(error.message);} finally {setSaving(false);} }}>Delete</Button>}<Button type="button" variant="outline" disabled={saving} onClick={() => setDraft(null)}>Cancel</Button><Button type="submit" loading={saving}>Save reminder</Button></footer></form>}
    </div></div></div>
  </section>;
  return fullPage ? content : createPortal(content,document.body);
}
export function HeaderCalendar({ currentUser, allUsers = [], onNavigate }) {
  const [open,setOpen] = useState(false);
  return <><Button data-header-calendar-trigger="true" className="tenant-topbar__icon-button" variant="fadeout" iconOnly icon={CalendarDays} aria-label="Open calendar and reminders" aria-expanded={open} title="Calendar & reminders" onClick={() => setOpen(true)}/>{open && <CalendarPanel currentUser={currentUser} allUsers={allUsers} onClose={() => setOpen(false)} onOpenPage={() => { setOpen(false); onNavigate?.('hr-calendar'); }}/>}</>;
}
