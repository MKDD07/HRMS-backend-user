import assert from 'node:assert/strict';
import {attendanceSummary} from './attendance-summary.mjs';
const records=[{employee_id:'e',date:'2026-10-01',check_in_time:'2026-10-01T04:00:00Z',check_out_time:'2026-10-01T12:30:00Z'},{employee_id:'e',date:'2026-10-02',check_in_time:'2026-10-02T04:00:00Z'}, {date:'2026-10-03',status:'Absent'}, {date:'2026-10-04',status:'Late',check_in_time:'2026-10-04T04:00:00Z'}, {date:'2026-10-05',status:'Half day'}];
const result=attendanceSummary(records,[{employee_id:'e',start_date:'2026-10-06',end_date:'2026-10-07',status:'Approved',leave_type:'Sick leave'}],'e',2026,10,'2026-10-13');
assert.deepEqual(result.attendanceCount,{presentCount:2,lateCount:1,halfDayCount:1,absentCount:1,leaveCount:2,daysInMonth:31,workedInMonth:'8h 30m'});
assert.equal(result.records[0].total_hours,'8:30');
assert.equal(attendanceSummary([],[],'e',2026,10,'2026-10-13').attendanceCount.presentCount,0);
console.log('Monthly attendance totals passed: recorded punches, open punch, leave, late, half day, empty month and hours.');
