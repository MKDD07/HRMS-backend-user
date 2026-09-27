export const emptyLeaveType = () => ({ name: '', code: '', description: '', color: '#66864f', active: true, eligibility_mode: 'all', genders: [], groups: [], userids: [], initial_days: 0, accrual_frequency: 'none', accrual_amount: 0, max_balance: 0, accrual_start_date: '', effective_from: '', effective_to: '', carry_forward: false, allow_half_day: true });

export const PROFESSIONAL_LEAVE_PRESETS = [
  { name: 'Casual Leave', code: 'CL', initial_days: 12, description: 'Short planned or personal absence.', color: '#66864f' },
  { name: 'Sick Leave', code: 'SL', initial_days: 12, description: 'Medical absence and recovery.', color: '#4e8580' },
  { name: 'Earned / Privilege Leave', code: 'EL', initial_days: 5, accrual_frequency: 'monthly', accrual_amount: 1.25, max_balance: 45, carry_forward: true, description: 'Accrued long-duration paid leave.', color: '#ad8748' },
  { name: 'Maternity Leave', code: 'ML', initial_days: 182, eligibility_mode: 'gender', genders: ['Female'], description: 'Maternity entitlement configured for eligible employees.', color: '#a66b83' },
  { name: 'Paternity Leave', code: 'PL', initial_days: 15, eligibility_mode: 'gender', genders: ['Male'], description: 'Paternity entitlement configured for eligible employees.', color: '#627fa0' },
  { name: 'Compensatory Off', code: 'CO', initial_days: 0, description: 'Time off credited against approved additional work.', color: '#7a7196' },
  { name: 'Bereavement Leave', code: 'BL', initial_days: 5, description: 'Leave following a death in the family.', color: '#6d777d' },
  { name: 'Marriage Leave', code: 'MRL', initial_days: 5, description: 'Special leave for an employee’s marriage.', color: '#a36f56' },
  { name: 'Study / Examination Leave', code: 'STL', initial_days: 0, description: 'Approved academic or professional examination leave.', color: '#537d77' },
  { name: 'Sabbatical Leave', code: 'SBL', initial_days: 0, description: 'Extended approved career or academic break.', color: '#756a52' }
];

export const presetLeaveType = preset => ({ ...emptyLeaveType(), ...preset });

export function eligibleFor(type, person) {
  if (!type?.active || !person) return false;
  if (type.eligibility_mode === 'gender') return (type.genders || []).some(value => value.toLowerCase() === String(person.gender || '').toLowerCase());
  if (type.eligibility_mode === 'groups') return (type.groups || []).includes(person.employment_type || person.department || person.type);
  if (type.eligibility_mode === 'people') return (type.userids || []).includes(person.userid);
  return true;
}

export function accruedBalance(type, onDate = new Date()) {
  const initial = Math.max(0, Number(type?.initial_days) || 0);
  if (!type?.active || type.accrual_frequency === 'none' || !type.accrual_start_date) return Math.min(initial, Number(type?.max_balance) || initial);
  const start = new Date(`${type.accrual_start_date}T12:00:00`);
  const end = onDate instanceof Date ? onDate : new Date(`${onDate}T12:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return initial;
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  const periods = type.accrual_frequency === 'monthly' ? months : type.accrual_frequency === 'quarterly' ? Math.floor(months / 3) : Math.floor(months / 12);
  const balance = initial + Math.max(0, periods) * Math.max(0, Number(type.accrual_amount) || 0);
  const cap = Number(type.max_balance);
  return Math.round((cap > 0 ? Math.min(balance, cap) : balance) * 100) / 100;
}

export function googleCalendarUrl(holiday) {
  const date = String(holiday.holiday_date || '').replaceAll('-', '');
  if (!/^\d{8}$/.test(date)) return '';
  const end = new Date(`${holiday.holiday_date}T12:00:00`); end.setDate(end.getDate() + 1);
  const endKey = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, '0')}${String(end.getDate()).padStart(2, '0')}`;
  const params = new URLSearchParams({ action: 'TEMPLATE', text: holiday.name, dates: `${date}/${endKey}`, details: [holiday.type || 'Company holiday', holiday.optional_note].filter(Boolean).join('\n') });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function holidaysToIcs(holidays) {
  const escape = value => String(value || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const rows = holidays.filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.holiday_date || '')).map(item => {
    const start = item.holiday_date.replaceAll('-', ''); const end = new Date(`${item.holiday_date}T12:00:00`); end.setDate(end.getDate() + 1);
    const endKey = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, '0')}${String(end.getDate()).padStart(2, '0')}`;
    return `BEGIN:VEVENT\r\nUID:${escape(item.id || `${start}-${item.name}`)}@pulsehrms\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${endKey}\r\nSUMMARY:${escape(item.name)}\r\nDESCRIPTION:${escape([item.type || 'Company holiday', item.optional_note].filter(Boolean).join(' - '))}\r\nEND:VEVENT`;
  });
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PulseHRMS//Company Calendar//EN\r\nCALSCALE:GREGORIAN\r\n${rows.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
}
