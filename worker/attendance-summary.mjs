import { dayLedger } from '../src/pages/attendance/attendanceLedger.js';
export function attendanceSummary(records, leaves, employee, year, month, today) {
  const days = new Date(Date.UTC(year,month,0)).getUTCDate();
  const counts = {presentCount:0,lateCount:0,halfDayCount:0,absentCount:0,leaveCount:0,daysInMonth:days};
  let minutes=0;
  const mapped = records.map(record=>{
    const duration=record.check_out_time ? (Date.parse(record.check_out_time)-Date.parse(record.check_in_time))/60000 : 0;
    const total=Math.max(0,Number.isFinite(duration)?Math.floor(duration):0);
    minutes+=total;
    return {...record,total_hours:Math.floor(total/60)+':'+String(total%60).padStart(2,'0')};
  });
  for(let day=1;day<=days;day++) {
    const date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    if(date>today)continue;
    const code=dayLedger(mapped,leaves.map(l=>({...l,userid:l.employee_id})),employee,date,today).code;
    if(['P','WFH'].includes(code))counts.presentCount++;
    else if(code==='L')counts.lateCount++;
    else if(code==='HD')counts.halfDayCount++;
    else if(code==='A')counts.absentCount++;
    else if(['EL','SL','CL','PL','LWP','LV'].includes(code))counts.leaveCount++;
  }
  counts.workedInMonth=Math.floor(minutes/60)+'h '+minutes%60+'m';
  return {records:mapped,attendanceCount:counts};
}
