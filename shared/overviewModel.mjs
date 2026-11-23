export const istDay = (time = Date.now()) => new Date(new Date(time).getTime()+19800000).toISOString().slice(0,10);
export const addDays = (day, count) => new Date(Date.parse(day+'T00:00:00Z')+count*86400000).toISOString().slice(0,10);
export const validDay = day => typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day;
// Imports can give the same holiday different IDs or categories. Its date and name identify the displayed event.
export function uniqueHolidays(holidays) {
  const seen = new Set();
  return holidays.filter(holiday => {
    const name = String(holiday.name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
    const key = JSON.stringify([holiday.holiday_date, name]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function punchInstant(value, day) {
  if(!value)return null;
  const text=String(value).trim();
  const instant=/^\d{2}:\d{2}(:\d{2})?$/.test(text)?`${day}T${text}+05:30`:/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(text)?text.replace(' ','T')+'+05:30':text;
  const result=Date.parse(instant);return Number.isFinite(result)?result:null;
}
export function shiftFor(person,shifts) {
  if (person.shift_override?.status === 'Active') return person.shift_override;
  const id=person.shift_id||person.shiftId;
  return id?shifts.find(s=>s.id===id&&s.status==='Active'):shifts.find(s=>s.isDefault&&s.status==='Active');
}
export function attendanceFacts(person,day,records,leaves,shifts,holidays,time=Date.now()) {
  const shift=shiftFor(person,shifts),record=records.find(r=>r.employee_id===person.employee_id&&r.date===day);
  const start=shift?punchInstant(shift.startTime,day):null;
  let end=shift?punchInstant(shift.endTime,day):null;if(end!=null&&end<=start)end+=86400000;
  const joined=person.joining_date||person.date_of_joining,exited=person.last_working_date;
  const employed=(!joined||joined<=day)&&(!exited||exited>=day)&&(person.status!=='Inactive'||!!exited);
  const weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(day+'T12:00:00Z').getUTCDay()];
  const holiday=holidays.some(h=>h.active!==false&&!/optional/i.test(h.type||'')&&h.holiday_date===day&&(!h.departments?.length||h.departments.includes(person.department)));
  const scheduled=!!shift&&employed&&shift.workingDays?.includes(weekday)&&!holiday;
  const onLeave=leaves.some(l=>l.employee_id===person.employee_id&&l.status==='Approved'&&l.start_date<=day&&l.end_date>=day);
  const checkIn=punchInstant(record?.check_in_time,day);let checkOut=punchInstant(record?.check_out_time,day);
  if(checkOut!=null&&checkIn!=null&&checkOut<checkIn&&/^\d{2}:/.test(record.check_out_time))checkOut+=86400000;
  const present=checkIn!=null&&checkIn<=time,grace=Number(shift?.gracePeriodMins)||0;
  const closed=checkOut!=null&&checkOut>=checkIn&&checkOut<=time;
  const hours=closed?(checkOut-checkIn)/3600000-(Number(shift?.breakDurationMins)||0)/60:null;
  return {scheduled,present,onLeave,unknownSchedule:employed&&!shift,absent:!!scheduled&&!present&&!onLeave&&time>=start+grace*60000,late:!!scheduled&&present&&checkIn>start+grace*60000,early:!!scheduled&&closed&&checkOut<end-(Number(shift?.earlyExitGraceMins)||0)*60000,halfDay:!!scheduled&&closed&&Number(shift.halfDayHours)>0&&hours<=Number(shift.halfDayHours),missingOut:present&&!closed&&!!shift&&time>end+(Number(shift.earlyExitGraceMins)||0)*60000,open:present&&!closed,checkIn,checkOut,hours,shift:shift?.name||'Not configured'};
}
