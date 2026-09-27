import { getMonthlySalary, getInitialMonthlyRecord } from '../../../lib/salaryStore';
import { getRowsForMonth, MONTH_NAMES } from './customRowsStore';

export const fullName = (emp) =>
  emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.userid || 'Employee' : 'Employee';

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const isFinal = (rec) => rec?.status === 'Finalized' || rec?.status === 'Processed';

export const EARNING_FIELDS = [
  ['basic', 'Basic Salary'],
  ['hra', 'House Rent Allowance (HRA)'],
  ['conveyance', 'Conveyance Allowance'],
  ['special_allowance', 'Special Allowance'],
  ['medical_allowance', 'Medical Allowance'],
  ['bonus_incentive', 'Performance Incentive / Bonus']
];

export const DEDUCTION_FIELDS = [
  ['pf_deduction', 'Provident Fund (PF 12%)'],
  ['professional_tax', 'Professional Tax (PT)'],
  ['tds_tax', 'Income Tax TDS']
];

const sum = (list) => (list || []).reduce((acc, c) => acc + Number(c.amount || 0), 0);

export function computeTotals(rec) {
  if (!rec) return { gross: 0, deductions: 0, net: 0 };
  const gross =
    EARNING_FIELDS.reduce((acc, [k]) => acc + Number(rec[k] || 0), 0) + sum(rec.custom_earnings);
  const deductions =
    DEDUCTION_FIELDS.reduce((acc, [k]) => acc + Number(rec[k] || 0), 0) + sum(rec.custom_deductions);
  return { gross, deductions, net: gross - deductions };
}

/** Write computed totals onto a record. */
export function withTotals(rec) {
  const { gross, deductions, net } = computeTotals(rec);
  return {
    ...rec,
    monthly_gross: gross,
    total_deductions: deductions,
    monthly_net: net,
    annual_ctc: gross * 12
  };
}

/**
 * Merge scoped custom rows (from the Salary Structure tab) into a draft.
 * - Finalized records are never touched.
 * - Rows removed from the draft by the user (skipped_row_ids) are not re-added.
 * - Amounts already edited inside the draft are kept.
 */
export function applyScopedRows(rec, uid, year, month) {
  if (!rec || isFinal(rec)) return rec;
  const scoped = getRowsForMonth(uid, year, month);
  const skipped = rec.skipped_row_ids || [];
  const activeIds = new Set([...scoped.earnings, ...scoped.deductions].map((r) => `scoped-${r.id}`));

  const merge = (existing, rows) => {
    // keep manual items + scoped items that are still active
    const kept = (existing || []).filter((c) => c.source !== 'scoped' || activeIds.has(c.id));
    rows.forEach((r) => {
      const id = `scoped-${r.id}`;
      if (skipped.includes(r.id) || kept.some((c) => c.id === id)) return;
      kept.push({ id, row_id: r.id, name: r.name, amount: Number(r.amount || 0), source: 'scoped' });
    });
    return kept;
  };

  return withTotals({
    ...rec,
    custom_earnings: merge(rec.custom_earnings, scoped.earnings),
    custom_deductions: merge(rec.custom_deductions, scoped.deductions)
  });
}

/** Saved record if present, otherwise a fresh draft (with scoped rows applied). */
export function getMonthRecord(emp, year, month) {
  const uid = emp.userid;
  const saved = getMonthlySalary(uid, year, month);
  if (saved) return applyScopedRows(saved, uid, year, month);
  const fresh = getInitialMonthlyRecord(uid, year, month);
  fresh.employee_name = fullName(emp);
  return applyScopedRows(fresh, uid, year, month);
}

export function previousMonth(year, month) {
  const i = MONTH_NAMES.indexOf(month);
  return i === 0 ? { year: String(Number(year) - 1), month: MONTH_NAMES[11] } : { year: String(year), month: MONTH_NAMES[i - 1] };
}

/* ---------- CSV export ---------- */
export function buildPayrollCsv(users, year, month) {
  const head = ['Employee ID', 'Name', 'Department', 'Gross', 'Deductions', 'Net', 'Status'];
  const lines = users.map((u) => {
    const r = getMonthRecord(u, year, month);
    return [u.userid, fullName(u), u.department || '', r.monthly_gross || 0, r.total_deductions || 0, r.monthly_net || 0, r.status || 'Draft']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',');
  });
  return [head.join(','), ...lines].join('\n');
}

export function downloadTextFile(filename, text, mime = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
