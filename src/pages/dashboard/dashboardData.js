export const dateKey = value => /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '';
export function normalizeLeaves(records) {
  return records.map(record => ({ ...record, start: dateKey(record.start_date || record.startdate), end: dateKey(record.end_date || record.enddate), state: String(record.status || '').toLowerCase() }));
}
export function attendanceSeries(attendance, today, days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - days + index + 1);
    const key = date.toISOString().slice(0, 10);
    const present = new Set();
    Object.entries(attendance).forEach(([userid, records]) => {
      if (records?.some(record => dateKey(record.date || record.attdate) === key && /\d{1,2}:\d{2}/.test(String(record.check_in_time || record.intime || '')))) present.add(userid);
    });
    return { date: key, label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }), employees: present.size };
  });
}
export function departmentCounts(employees) {
  const groups = new Map();
  employees.forEach(person => { const name = person.department || 'Not assigned'; groups.set(name, (groups.get(name) || 0) + 1); });
  return [...groups].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
