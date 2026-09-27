import assert from 'node:assert/strict';
import { leaveDates, leaveSummary } from './leaveCalendarData.js';

assert.deepEqual(leaveDates({ start_date: '2026-12-31', end_date: '2027-01-02' }), ['2026-12-31', '2027-01-01', '2027-01-02']);
assert.deepEqual(leaveDates({ start_date: '2026-02-03', end_date: '2026-02-01' }), []);
const result = leaveSummary([
  { start_date: '2026-02-01', leave_type: 'Sick Leave', status: 'Approved' },
  { start_date: '2026-02-04', leave_type: 'Sick Leave', status: 'Pending' },
  { start_date: '2025-02-04', leave_type: 'Annual Leave', status: 'Approved' }
], 2026);
assert.equal(result.months[1].Approved, 1);
assert.equal(result.months[1].Pending, 1);
assert.deepEqual(result.types, [{ name: 'Sick Leave', count: 2, days: 2, code: 'SL' }]);

// Test DD-MM-YYYY formats from Worker API
assert.deepEqual(leaveDates({ start_date: '28-09-2026', end_date: '30-09-2026' }), ['2026-09-28', '2026-09-29', '2026-09-30']);

const dmyResult = leaveSummary([
  { start_date: '28-09-2026', leave_type: 'Sick / Medical Leave (SL)', status: 'Approved' }
], 2026, [
  { name: 'Sick Leave', code: 'SL', initial_days: 12 }
]);
assert.equal(dmyResult.months[8].Approved, 1);
assert.equal(dmyResult.types[0].count, 1);

const eligibleResult = leaveSummary([
  { start_date: '2026-02-01', leave_type: 'Sick Leave', status: 'Approved' }
], 2026, [
  { name: 'Sick Leave', code: 'SL', initial_days: 12 },
  { name: 'Casual Leave', code: 'CL', initial_days: 10 }
]);
assert.equal(eligibleResult.types.length, 2);
assert.deepEqual(eligibleResult.types[0], { name: 'Sick Leave', count: 1, days: 1, code: 'SL', allotted: 12 });
assert.deepEqual(eligibleResult.types[1], { name: 'Casual Leave', count: 0, days: 0, code: 'CL', allotted: 10 });
console.log('Leave calendar data checks passed.');
