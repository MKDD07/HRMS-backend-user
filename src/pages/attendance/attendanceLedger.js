export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const recordDate = record => String(record.date || record.attdate || '').slice(0, 10);
export const hasPunch = value => /\d{1,2}:\d{2}/.test(String(value || ''));
export const monthDates = month => Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1)));
export function reportedMinutes(record) {
  const raw = record.total_hours ?? record.totalhours;
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 60) : null;
  const match = String(raw).trim().match(/^(\d+):(\d{2})(?::\d{2})?(?:\s*(?:hrs?|hours?))?$/i);
  if (match && Number(match[2]) < 60) return Number(match[1]) * 60 + Number(match[2]);
  return null;
}
export function formatMinutes(minutes) { return minutes == null ? 'Not recorded' : `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
export const ATTENDANCE_CODES = { P: 'Present / punch recorded', L: 'Late', R: 'Other record', A: 'Recorded absent', EL: 'Earned leave', SL: 'Sick leave', CL: 'Casual leave', PL: 'Paid leave', LWP: 'Leave without pay', LV: 'Other leave', HD: 'Half day', WFH: 'Work from home', WO: 'Recorded weekly off', H: 'Recorded holiday', NR: 'No record', NA: 'Before joining', '-': 'Upcoming', '?': 'Unavailable' };
export function leaveCode(type) {
  const name = String(type || '').trim().toLowerCase();
  return ({el:'EL','earned leave':'EL',sl:'SL','sick leave':'SL',cl:'CL','casual leave':'CL',pl:'PL','paid leave':'PL',lwp:'LWP','leave without pay':'LWP','unpaid leave':'LWP'})[name] || 'LV';
}
export function dayLedger(records, leaves, userid, day, today, joiningDate = '') {
  if (/^\d{4}-\d{2}-\d{2}/.test(joiningDate) && day < joiningDate.slice(0,10)) return {code:'NA', label:'Before joining',records:[],leaves:[],minutes:null};
  if (records === null) return { code: '?', label: 'Unavailable', records: [], leaves: [], minutes: null };
  const logs = (records || []).filter(record => recordDate(record) === day);
  const approved = leaves.filter(leave => String(leave.userid || leave.user_id) === String(userid) && String(leave.status).toLowerCase() === 'approved' && String(leave.start_date || leave.startdate || '').slice(0, 10) <= day && String(leave.end_date || leave.enddate || '').slice(0, 10) >= day);
  const punched = logs.some(record => hasPunch(record.check_in_time || record.intime));
  const statuses = logs.map(record => String(record.status || record.attstatus || '').trim().toLowerCase().replace(/[_-]/g, ' '));
  let code = day > today ? '-' : 'NR';
  let label = day > today ? 'Upcoming' : 'No record';
  if (logs.length) {
    if ((statuses.includes('absent') || statuses.includes('a')) && !punched) { code = 'A'; label = 'Recorded absent'; }
    else if (statuses.some(status => ['late','l'].includes(status))) { code = 'L'; label = 'Recorded late'; }
    else if (statuses.some(status => status === 'half day')) { code = 'HD'; label = 'Recorded half day'; }
    else if (!punched && statuses.some(status => ['leave', 'on leave', 'onleave', 'approved leave'].includes(status))) { code = leaveCode(logs[0]?.leave_type || approved[0]?.leave_type); label = ATTENDANCE_CODES[code]; }
    else if (!punched && statuses.some(status => ['el','sl','cl','pl','lwp'].includes(status))) { code = leaveCode(statuses.find(status => ['el','sl','cl','pl','lwp'].includes(status))); label = ATTENDANCE_CODES[code]; }
    else if (statuses.some(status => ['wfh','work from home'].includes(status))) { code = 'WFH'; label = ATTENDANCE_CODES.WFH; }
    else if (!punched && statuses.some(status => ['weekly off','weekend','wo'].includes(status))) { code = 'WO'; label = ATTENDANCE_CODES.WO; }
    else if (!punched && statuses.some(status => ['holiday','h'].includes(status))) { code = 'H'; label = ATTENDANCE_CODES.H; }
    else if (statuses.includes('present') || statuses.includes('p') || punched) { code = 'P'; label = 'Punch recorded'; }
    else { code = 'R'; label = 'Record available'; }
  } else if (approved.length) { code = leaveCode(approved[0].leave_type); label = ATTENDANCE_CODES[code]; }
  const times = logs.map(reportedMinutes).filter(time => time !== null);
  return { code, label, records: logs, leaves: approved, minutes: times.length ? times.reduce((sum, time) => sum + time, 0) : null };
}
export function csvText(rows) {
  return rows.map(row => row.map(value => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
