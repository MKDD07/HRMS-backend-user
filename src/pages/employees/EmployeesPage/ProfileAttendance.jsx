import React from 'react';
import { CalendarDays, Clock, CircleCheck } from 'lucide-react';
import { MetricOverview, MetricCard } from '../../../components/ui/MetricOverview';

const dayOf = record => String(record.date || record.attdate || '').slice(0, 10);
const clockIn = record => record.check_in_time || record.intime;
const clockOut = record => record.check_out_time || record.outtime;
const hoursOf = record => {
  const raw = record.total_hours ?? record.totalhours;
  if (raw == null || raw === '') return null;
  if (/^\d+:\d{2}$/.test(String(raw))) { const [hours, minutes] = String(raw).split(':').map(Number); return minutes < 60 ? hours + minutes / 60 : null; }
  return Number.isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : null;
};
const timeLabel = value => {
  if (!value) return '—';
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(value))) return String(value).slice(0, 5);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
};
const dateLabel = value => {
  const date = new Date(value + 'T12:00:00Z');
  return Number.isNaN(date.getTime()) ? value || 'Not recorded' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'UTC' });
};

export function ProfileAttendance({ records = [], renderDetails }) {
  const sorted = [...records].sort((a, b) => dayOf(b).localeCompare(dayOf(a)));
  const days = new Set(records.map(dayOf).filter(Boolean)).size;
  const complete = records.filter(record => clockIn(record) && clockOut(record)).length;
  const knownHours = records.map(hoursOf).filter(value => value != null);
  const total = knownHours.reduce((sum, hours) => sum + hours, 0);
  return <div className="profile-attendance">
    <MetricOverview aria-label="Employee monthly attendance summary">
      <MetricCard label="Recorded days" icon={CalendarDays} value={days} caption="Days with attendance records" />
      <MetricCard label="Complete punches" icon={CircleCheck} value={complete} caption="Records with both in and out" />
      <MetricCard label="Recorded hours" icon={Clock} value={knownHours.length ? `${Number(total.toFixed(2))} h` : '—'} caption={knownHours.length < records.length ? 'Excludes records without hours' : 'Total reported for this month'} />
    </MetricOverview>
    <div className="card overview-card profile-attendance__records">
      <div className="card-head"><div><h3>Attendance records</h3><p>Punch times shown in India time.</p></div><span className="profile-attendance__count">{records.length} {records.length === 1 ? 'record' : 'records'}</span></div>
      {!records.length ? <p className="profile-attendance__empty">No attendance recorded for this month. Choose another month to review past records.</p> : <div className="profile-attendance__table" tabIndex={0} role="region" aria-label="Monthly punch records"><table><thead><tr><th scope="col">Date</th><th scope="col">Punch in</th><th scope="col">Punch out</th><th scope="col">Hours</th><th scope="col">Details</th></tr></thead><tbody>{sorted.map((record, index) => <tr key={record.id || `${dayOf(record)}-${index}`}>
        <th scope="row"><time dateTime={dayOf(record)}>{dateLabel(dayOf(record))}</time></th><td>{timeLabel(clockIn(record))}</td><td>{timeLabel(clockOut(record))}</td><td>{hoursOf(record) == null ? '—' : `${Number(hoursOf(record).toFixed(2))} h`}</td><td><details><summary>View record</summary><div className="profile-attendance__details">{renderDetails?.(record)}</div></details></td>
      </tr>)}</tbody></table></div>}
    </div>
  </div>;
}
