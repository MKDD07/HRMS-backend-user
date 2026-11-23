import { companyRequest } from '../../../lib/companyAuth';
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
 * Cloudflare D1 owns the records. This module keeps a session-scoped memory copy.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

let session, cached = {};
const token = () => localStorage.getItem('pulse_hrms_token');
const request = options => companyRequest('/salary-components', { token: token(), ...options });
const post = body => request({ method: 'POST', body: JSON.stringify(body) });

export const monthIndex = (year, month) => Number(year) * 12 + MONTH_NAMES.indexOf(month);

function readAll() {
  if (session !== token()) { session = token(); cached = {}; }
  return cached;
}

export async function loadRows() {
  const current = token();
  const result = await request();
  if (current !== token()) throw new Error('Account changed while loading payroll components.');
  session = current;
  cached = {};
  for (const { userid, ...row } of result) (cached[userid] ||= []).push(row);
  return cached;
}

export function getRows(uid) {
  return readAll()[uid] || [];
}

/** Add the same row to many people at once. */
export async function addRowForUsers(uids, input) {
  await post({ action: 'add', employee_ids: uids, row: input });
  await loadRows();
}

export async function updateRow(uid, rowId, patch) {
  await post({ action: 'update', userid: uid, id: rowId, patch });
  await loadRows();
}

export async function deleteRow(uid, rowId) {
  await post({ action: 'delete', userid: uid, id: rowId });
  await loadRows();
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
