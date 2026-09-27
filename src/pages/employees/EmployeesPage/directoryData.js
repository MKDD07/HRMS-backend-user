import { R2_STORAGE_BASE, R2_PROFILE_IMAGES } from '../../../lib/api';

export function profileImage(person) {
  const uid = person?.userid || person?.user_id || person?.employee_code || person?.id;
  const cached = uid && typeof window !== 'undefined' ? (localStorage.getItem(`pulse_avatar_${uid}`) || R2_PROFILE_IMAGES[uid]) : null;
  const path = cached || person?.profile_pic_url || person?.profile?.profile_pic_url || person?.avatar_url;
  if (!path || typeof path !== 'string') return '';
  if (/^\/?(?:storage\/)?profile\//.test(path.trim())) return path.trim();
  if (path.startsWith('data:') || path.startsWith('blob:')) return path;
  if (/^https?:\/\//i.test(path)) return path;
  try {
    const url = new URL(path.trim().replace(/^\/?storage\//, '').replace(/^\/(?!\/)/, ''), `${R2_STORAGE_BASE}/`);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function attendanceDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const punchValue = value => value != null && !['', 'null', 'undefined', '--', '-', '0000-00-00 00:00:00'].includes(String(value).trim().toLowerCase());
export function currentPresence(records, now = new Date()) {
  const day = attendanceDay(now);
  const today = records.filter(record => String(record.date || record.attdate || '').slice(0, 10) === day);
  const hasIn = record => punchValue(record.check_in_time || record.intime);
  const hasOut = record => punchValue(record.check_out_time || record.outtime);
  if (today.some(record => hasIn(record) && !hasOut(record))) return 'Active';
  if (today.some(hasOut)) return 'Punched out';
  return 'Not punched in';
}

// Do not expose authentication material when showing the full employee response.
export function displayFields(record) {
  return Object.entries(record || {}).filter(([key]) => !/password|passwd|token|secret|otp|salt|hash|credential|api_?key|profile_pic_url/i.test(key));
}
