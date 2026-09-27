/**
 * Custom pay rows (Conveyance, Travel, Loan EMI ...) with a month scope.
 *
 * Row shape:
 * {
 *   id, name, amount, type: 'earning' | 'deduction',
 *   scope: { mode: 'once' | 'ongoing' | 'selected', year, month, months: [] },
 *   created_at
 * }
 *
 * Storage is localStorage for now. To move to a real API, only change the
 * functions in this file (keep the same names and return values).
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const KEY = 'hrms_custom_pay_rows_v2';

export const monthIndex = (year, month) => Number(year) * 12 + MONTH_NAMES.indexOf(month);

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Could not save custom pay rows:', err);
  }
}

export function getRows(uid) {
  return readAll()[uid] || [];
}

/** Add the same row to many people at once. */
export function addRowForUsers(uids, input) {
  const all = readAll();
  const stamp = Date.now();
  uids.forEach((uid, i) => {
    const row = {
      ...input,
      id: `row-${stamp}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString()
    };
    all[uid] = [...(all[uid] || []), row];
  });
  writeAll(all);
}

export function updateRow(uid, rowId, patch) {
  const all = readAll();
  all[uid] = (all[uid] || []).map((r) => (r.id === rowId ? { ...r, ...patch } : r));
  writeAll(all);
}

export function deleteRow(uid, rowId) {
  const all = readAll();
  all[uid] = (all[uid] || []).filter((r) => r.id !== rowId);
  writeAll(all);
}

export function isRowActive(row, year, month) {
  const s = row.scope;
  if (!s) return false;
  const current = monthIndex(year, month);
  if (s.mode === 'once') return monthIndex(s.year, s.month) === current;
  if (s.mode === 'ongoing') return current >= monthIndex(s.year, s.month);
  if (s.mode === 'selected') {
    return Number(s.year) === Number(year) && (s.months || []).includes(month);
  }
  return false;
}

/** Rows that apply to one person in one month, split by type. */
export function getRowsForMonth(uid, year, month) {
  const active = getRows(uid).filter((r) => isRowActive(r, year, month));
  return {
    earnings: active.filter((r) => r.type === 'earning'),
    deductions: active.filter((r) => r.type === 'deduction')
  };
}

export function describeScope(scope) {
  if (!scope) return '';
  if (scope.mode === 'once') return `Only ${scope.month} ${scope.year}`;
  if (scope.mode === 'ongoing') return `Ongoing from ${scope.month} ${scope.year}`;
  const list = (scope.months || []).map((m) => m.slice(0, 3)).join(', ');
  return `${scope.year}: ${list || 'no months'}`;
}
