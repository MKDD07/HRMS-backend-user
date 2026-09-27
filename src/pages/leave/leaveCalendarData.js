export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function normalizeLeaveDate(dateStr) {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  const ymd = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${String(ymd[2]).padStart(2, '0')}-${String(ymd[3]).padStart(2, '0')}`;
  }
  const dmy = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return dateKey(parsed);
  }
  return '';
}

export function leaveDates(leave) {
  const start = normalizeLeaveDate(leave?.start_date || leave?.startdate);
  const end = normalizeLeaveDate(leave?.end_date || leave?.enddate || start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return [];
  const dates = [];
  let date = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (date <= last && dates.length < 367) {
    dates.push(dateKey(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

export function shortCodeOf(item) {
  if (typeof item === 'object' && item?.code && String(item.code).trim()) {
    return String(item.code).trim().toUpperCase();
  }
  const name = typeof item === 'string' ? item : item?.name || '';
  const clean = name.trim();
  if (!clean) return 'LV';

  const map = {
    'casual leave': 'CL',
    'sick leave': 'SL',
    'earned leave': 'EL',
    'privilege leave': 'PL',
    'earned / privilege leave': 'EL',
    'maternity leave': 'ML',
    'paternity leave': 'PL',
    'compensatory off': 'CO',
    'bereavement leave': 'BL',
    'marriage leave': 'MRL',
    'study leave': 'STL',
    'study / examination leave': 'STL',
    'sabbatical leave': 'SBL',
    'annual leave': 'AL',
    'unpaid leave': 'UL',
    'leave without pay': 'LWP'
  };

  const lower = clean.toLowerCase();
  if (map[lower]) return map[lower];

  const letters = clean.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('');
  return (letters.slice(0, 4) || clean.slice(0, 3)).toUpperCase();
}

export function leaveSummary(leaves, year, eligibleTypes = []) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: new Date(year, index, 1).toLocaleString('en', { month: 'short' }),
    Approved: 0,
    Pending: 0,
    Rejected: 0
  }));

  const typeMap = new Map();
  const daysMap = new Map();
  const metaMap = new Map();

  // Pre-populate typeMap with eligible types so they are always present even with 0 requests
  for (const item of eligibleTypes) {
    const name = typeof item === 'string' ? item : item?.name;
    if (!name) continue;
    typeMap.set(name, 0);
    daysMap.set(name, 0);
    if (typeof item === 'object') {
      metaMap.set(name.toLowerCase(), item);
      if (item.code) metaMap.set(String(item.code).toLowerCase(), item);
    }
    for (let m = 0; m < 12; m++) {
      months[m][name] = 0;
    }
  }

  for (const leave of leaves) {
    const start = normalizeLeaveDate(leave?.start_date || leave?.startdate);
    if (!start.startsWith(`${year}-`)) continue;
    const month = Number(start.slice(5, 7)) - 1;
    if (month < 0 || month > 11) continue;
    const status = String(leave?.status || '').toLowerCase();
    const key = status === 'approved' ? 'Approved' : status === 'pending' ? 'Pending' : status === 'rejected' ? 'Rejected' : null;
    if (key) months[month][key]++;

    const rawType = String(leave?.leave_type || 'Unspecified').trim();
    const rawLower = rawType.toLowerCase();
    const matchedMeta = metaMap.get(rawLower)
      || [...metaMap.values()].find(m => {
        const mLower = (m.name || '').toLowerCase();
        return rawLower.includes(mLower) || mLower.includes(rawLower)
          || (m.code && rawLower.includes(m.code.toLowerCase()));
      });
    const typeName = matchedMeta?.name || rawType;

    const dVal = Math.max(1, Number(leave?.days) || leaveDates(leave).length || 1);
    typeMap.set(typeName, (typeMap.get(typeName) || 0) + 1);
    daysMap.set(typeName, (daysMap.get(typeName) || 0) + dVal);
    months[month][typeName] = (months[month][typeName] || 0) + 1;
    months[month][`${typeName}_days`] = (months[month][`${typeName}_days`] || 0) + dVal;
  }

  const monthlyByType = {};
  for (const name of typeMap.keys()) {
    monthlyByType[name] = {
      days: Array.from({ length: 12 }, (_, m) => months[m][`${name}_days`] || 0),
      counts: Array.from({ length: 12 }, (_, m) => months[m][name] || 0)
    };
  }

  const types = [...typeMap.entries()].map(([name, count]) => {
    const meta = metaMap.get(name.toLowerCase());
    const code = meta?.code
      ? String(meta.code).trim().toUpperCase()
      : shortCodeOf(meta || name);
    return {
      name,
      count,
      days: daysMap.get(name) || 0,
      code,
      ...(meta?.color ? { color: meta.color } : {}),
      ...(meta?.initial_days !== undefined ? { allotted: meta.initial_days } : meta?.allotted !== undefined ? { allotted: meta.allotted } : {}),
      ...(meta?.max_balance !== undefined ? { max_balance: meta.max_balance } : {})
    };
  }).sort((a, b) => b.days - a.days || b.count - a.count || a.name.localeCompare(b.name));

  return { months, types, monthlyByType };
}
