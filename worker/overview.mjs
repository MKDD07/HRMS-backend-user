import { workforceSummary } from '../shared/overviewDashboard.mjs';
import { probationEnd } from '../shared/lifecycleDocuments.mjs';
import { istDay,addDays,validDay,uniqueHolidays,attendanceFacts,shiftFor,punchInstant } from '../shared/overviewModel.mjs';
import { parsePages } from '../shared/dashboardAccess.mjs';
import { eligibleFor,accruedBalance } from '../src/lib/leavePolicy.js';
const parse=value=>value?JSON.parse(value):{};
const rows=async(db,sql,params=[]) => (await db.prepare(sql).bind(...params).all()).results;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function overviewHandle({db,actor,url,time=Date.now()}) {
  const admin=actor.role==='company_admin',pages=parsePages(actor.dashboard_pages);
  if(!admin&&!(actor.dashboard_access&&pages.includes('dashboard')))fail('Overview access required.',403);
  const allowed=page=>admin||page==='appraisals'||pages.includes(page),company=actor.company_id,today=istDay(time);
  const to=url.searchParams.get('to')||today,days=url.searchParams.get('days')==='30'?30:7,from=url.searchParams.get('from')||addDays(to,1-days);
  if(!validDay(from)||!validDay(to)||from>to||to>today||Date.parse(to)-Date.parse(from)>89*86400000)fail('Choose a past or current range of up to 90 days.');
  const department=url.searchParams.get('department')||'',location=url.searchParams.get('location')||'',shiftId=url.searchParams.get('shift')||'';
  const [raw,config,roles]=await Promise.all([
    rows(db,'SELECT e.employee_id,e.user_id,e.first_name,e.last_name,e.department,e.designation,e.status,e.profile,e.created_at,u.email FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=?',[company]),
    rows(db,'SELECT payload FROM workflow_configuration WHERE company_id=?',[company]),
    rows(db,'SELECT user_id FROM appraisal_roles WHERE company_id=? AND user_id=?',[company,actor.user_id])
  ]);
  // Older profile editors stored DOB in personal_details. Keep those real records
  // readable while newer profile fields take precedence, including explicit clears.
  const personalDates = await rows(db,'SELECT e.user_id,p.userid,p.dob FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id JOIN personal_details p ON p.userid=e.user_id OR p.userid=u.username WHERE e.company_id=?',[company]).catch(error=>{
    if (/no such table.*personal_details/i.test(error.message)) return [];
    throw error;
  });
  const birthdays = new Map(personalDates.sort((a,b)=>Number(a.userid===a.user_id)-Number(b.userid===b.user_id)).map(p=>[p.user_id,p.dob]));
  for (const person of raw) {
    const profile = parse(person.profile);
    person.date_of_birth = profile.date_of_birth ?? profile.dob ?? birthdays.get(person.user_id) ?? '';
  }
  const hr=admin||roles.length>0,links=parse(config[0]?.payload).links||[];
  const directory=raw.map(p=>({...parse(p.profile),...p,profile:undefined,name:[p.first_name,p.last_name].filter(Boolean).join(' '),userid:p.user_id})).filter(p=>{if(hr)return true;const direct=[...new Set(links.filter(l=>l.employee===p.user_id&&l.type==='direct').map(l=>l.manager))];return direct.length?direct.length===1&&direct[0]===actor.user_id:p.reports_to_userid===actor.user_id;});
  const errors={},sources={};
  const specs={
    shifts:['SELECT payload FROM dashboard_configuration WHERE company_id=? AND section=\'shifts\'',[company]],
    calendar:['SELECT * FROM company_calendar WHERE company_id=?',[company]],
    assignments:['SELECT userid,payload FROM company_calendar_assignments WHERE company_id=?',[company]],
    attendance:['SELECT a.* FROM attendance a WHERE company_id=? AND date>=? AND date<=?',[company,addDays(from,-1),to]],
    leaves:['SELECT * FROM leave_requests WHERE company_id=? AND end_date>=?',[company,to.slice(0,4)+'-01-01']],
    workflows:["SELECT request_id,requester_id,kind,status,payload,source_id FROM workflow_requests WHERE company_id=? AND status IN ('Pending','Blocked')",[company]],
    talent:["SELECT id,collection,payload,updated_at FROM talent_records WHERE company_id=? AND collection IN ('onboarding','offboarding','jobs','candidates')",[company]],
    expenses:allowed('expenses')?['SELECT id,payload FROM hr_expenses WHERE company_id=?',[company]]:null,
    appraisals:["SELECT r.id,r.employee_id,r.manager_id,r.status,r.payload,c.payload AS cycle_payload FROM appraisal_reviews r JOIN appraisal_cycles c ON c.company_id=r.company_id AND c.id=r.cycle_id WHERE r.company_id=? AND c.status='Launched' AND r.status IN ('Self-review','Manager review')",[company]],
    documents:allowed('documents')?["SELECT document_id,employee_id,title,metadata FROM documents WHERE company_id=? AND json_extract(metadata,'$.deleted_at') IS NULL",[company]]:null,
    announcements:["SELECT id,title,body,audience,recipients,author_id,created_at FROM hr_connect WHERE company_id=? AND kind='announcement' AND status='Published' ORDER BY created_at DESC",[company]],
    payroll:allowed('payroll')?['SELECT employee_id,period,status,breakdown,currency,gross_minor,deductions_minor FROM payroll WHERE company_id=? AND period=?',[company,to.slice(0,7)]]:null,
    payslips:allowed('payroll')?["SELECT userid,year,month,payload,created_at,id FROM payslip_records WHERE json_extract(payload,'$.company_id')=? AND year=? ORDER BY created_at DESC,id DESC",[company,to.slice(0,4)]]:null,
    payrollSetup:admin?['SELECT a.id FROM payslip_assignments a JOIN employees e ON e.user_id=a.id WHERE e.company_id=? LIMIT 1',[company]]:null,
    activity:hr?["SELECT actor_id,action,request_id,created_at FROM workflow_audit WHERE company_id=? AND date(created_at,'+330 minutes')>=? AND date(created_at,'+330 minutes')<=? ORDER BY created_at DESC LIMIT 100",[company,from,to]]:null,
    reviewActivity:hr?["SELECT actor_id,action,entity_type,entity_id,created_at FROM appraisal_audit WHERE company_id=? AND date(created_at,'+330 minutes')>=? AND date(created_at,'+330 minutes')<=? ORDER BY created_at DESC LIMIT 100",[company,from,to]]:null
  };
  // Limit concurrent bindings, preserving independent-source error states.
  const entries=Object.entries(specs);let cursor=0;
  await Promise.all(Array.from({length:5},async()=>{while(cursor<entries.length){const [key,spec]=entries[cursor++];if(!spec){sources[key]=[];continue;}try{sources[key]=await rows(db,...spec);}catch{sources[key]=[];errors[key]=`${key} data is unavailable.`;}}}));
  const shifts=parse(sources.shifts[0]?.payload||'[]'),calendar=sources.calendar[0]||{},holidays=parse(calendar.holidays||'[]');
  const people=directory.filter(p=>(!department||p.department===department)&&(!location||(p.work_location||p.worklocation||'')===location)&&(!shiftId||shiftFor(p,shifts)?.id===shiftId));
  const ids=new Set(people.map(p=>p.user_id)),employeeIds=new Set(people.map(p=>p.employee_id));
  const personById=new Map(people.map(p=>[p.user_id,p])),personByEmployee=new Map(people.map(p=>[p.employee_id,p]));
  const attendance=sources.attendance.filter(r=>employeeIds.has(r.employee_id)),leaves=sources.leaves.filter(r=>employeeIds.has(r.employee_id));
  const recordsByDay=new Map(attendance.map(r=>[r.employee_id+'/'+r.date,r])),leavesByEmployee=new Map(),factCache=new Map();
  for(const leave of leaves){const items=leavesByEmployee.get(leave.employee_id)||[];items.push(leave);leavesByEmployee.set(leave.employee_id,items);}
  const factsFor=(p,date)=>{const key=p.employee_id+'/'+date;if(!factCache.has(key))factCache.set(key,attendanceFacts(p,date,recordsByDay.has(key)?[recordsByDay.get(key)]:[],leavesByEmployee.get(p.employee_id)||[],shifts,holidays,time));return factCache.get(key);};
  const row=(p,detail='',date=to,id=p.user_id,page='employees')=>({id,user_id:p.user_id,name:p.name,department:p.department,detail,date,page});
  const lists={},metrics=[],attention=[];
  const metric=(key,title,items,note,page,unavailable=false)=>{lists[key]=items;metrics.push({key,title,value:unavailable?null:items.length,note,page});};
  const alert=(key,title,items,page,unavailable=false)=>{lists[key]=items;attention.push({key,title,value:unavailable?null:items.length,page});};
  const talent=sources.talent.map(r=>({...parse(r.payload),id:r.id,collection:r.collection}));
  for(const p of people)if(!p.confirmation_date)p.confirmation_date=probationEnd(p,talent.find(r=>r.collection==='onboarding'&&r.employee_id===p.user_id&&r.status!=='Cancelled')||{});
  const active=people.filter(p=>p.status!=='Inactive'&&(!(p.joining_date||p.date_of_joining)||(p.joining_date||p.date_of_joining)<=to));
  const attendanceError=!!(errors.attendance||errors.shifts||errors.calendar||errors.leaves);
  const facts=people.map(p=>({p,...factsFor(p,to)}));
  metric('employees','Employees',active.map(p=>row(p,p.designation)),hr?'Active workforce':'Your direct reports','employees');
  if (allowed('attendance')) {
    const photoFor = person => person.profile_pic_url || person.avatar_url || '';
    const preview = [...active.filter(person => photoFor(person)), ...active.filter(person => !photoFor(person))].slice(0, 5);
    lists.attendancePreview = preview.map(person => ({ user_id: person.user_id, name: person.name, profile_pic_url: photoFor(person) }));
  }
  for(const [key,title,note] of [['open','Punched in','Recorded punch without a punch-out'],['absent','Absent','Scheduled shift started; no punch or approved leave'],['late','Late arrivals','After the configured shift grace period'],['early','Early exits','Completed punches before shift end'],['halfDay','Half-days','Worked hours at or below configured half-day threshold'],['onLeave','On leave','Approved leave covering the selected day']])metric(key,title,facts.filter(f=>f[key]).map(f=>row(f.p,f.shift,to,f.p.user_id,'attendance')),note,key==='onLeave'?'leave':'attendance',attendanceError);
  metric('probation','On probation',active.filter(p=>p.status==='Probation').map(p=>row(p,'On probation')),'Current employee status','employees');
  metric('confirmations','Confirmations due',active.filter(p=>p.status==='Probation'&&validDay(p.confirmation_date)&&p.confirmation_date<=addDays(to,30)).map(p=>row(p,'Confirmation due',p.confirmation_date)),'Overdue or due within 30 days','onboarding');
  metric('joiners','New joiners',people.filter(p=>(p.joining_date||p.date_of_joining||'').startsWith(to.slice(0,7))&&(p.joining_date||p.date_of_joining)<=to).map(p=>row(p,'Joined',p.joining_date||p.date_of_joining)),'Selected month through the selected day','employees');
  const exits=talent.filter(r=>r.collection==='offboarding'&&ids.has(r.employee_id)&&r.status!=='Cancelled');
  metric('notice','Serving notice',exits.filter(r=>r.status!=='Completed'&&r.start_date<=to&&r.due_date>=to).map(r=>row(personById.get(r.employee_id),r.title,r.due_date,r.id,'offboarding')),'Active exit plans','offboarding',!!errors.talent);
  metric('exits','Exits this month',exits.filter(r=>r.status==='Completed'&&r.due_date.startsWith(to.slice(0,7))&&r.due_date<=to).map(r=>row(personById.get(r.employee_id),r.title,r.due_date,r.id,'offboarding')),'Completed exit plans','offboarding',!!errors.talent);
  const yesterday=addDays(to,-1);
  alert('missingOut','Missing punch-out (previous day)',people.filter(p=>factsFor(p,yesterday).missingOut).map(p=>row(p,'Shift has ended',yesterday,p.user_id,'attendance')),'attendance',attendanceError);
  alert('regularizations','Attendance regularizations',sources.workflows.filter(r=>r.kind==='attendance'&&ids.has(r.requester_id)).map(r=>row(personById.get(r.requester_id),r.status,parse(r.payload).date,r.request_id,'departments')),'departments',!!errors.workflows);
  alert('pendingLeave','Pending leave requests',leaves.filter(r=>r.status==='Pending').map(r=>row(personByEmployee.get(r.employee_id),r.leave_type,r.start_date,r.leave_id,'leave')),'leave',!!errors.leaves);
  if(allowed('expenses'))alert('expenses','Pending expense claims',sources.expenses.map(r=>({...parse(r.payload),id:r.id})).filter(r=>ids.has(r.employee_id)&&['Submitted','Approved'].includes(r.status)).map(r=>row(personById.get(r.employee_id),`${r.title} · ${r.status}`,r.expense_date,r.id,'expenses')),'expenses',!!errors.expenses);
  alert('appraisals','Overdue appraisal actions',sources.appraisals.filter(r=>ids.has(r.employee_id)).filter(r=>{const key=r.status==='Self-review'?'self':'manager';return Date.parse(parse(r.payload).reopened?.[key]||parse(r.cycle_payload).deadlines?.[key])<time;}).map(r=>row(personById.get(r.employee_id),r.status,to,r.id,'appraisals')),'appraisals',!!errors.appraisals);
  for(const collection of ['onboarding','offboarding'])if(allowed(collection))alert(collection,`Pending ${collection} tasks`,talent.filter(r=>r.collection===collection&&ids.has(r.employee_id)&&!['Completed','Cancelled'].includes(r.status)).flatMap(r=>(r.checklist||[]).filter(t=>!t.done).map((t,i)=>row(personById.get(r.employee_id),t.label||t.title||t.text||r.title,r.due_date,r.id+'-'+i,collection))),collection,!!errors.talent);
  if(allowed('documents'))alert('documents','Document expiries',sources.documents.filter(r=>employeeIds.has(r.employee_id)).map(r=>({...r,...parse(r.metadata)})).filter(r=>validDay(r.expiry_date||r.expires_at)&& (r.expiry_date||r.expires_at)<=addDays(to,30)).map(r=>row(personByEmployee.get(r.employee_id),r.title,r.expiry_date||r.expires_at,r.document_id,'documents')),'documents',!!errors.documents);
  alert('incomplete','Incomplete profiles',active.filter(p=>!p.email||!p.department||!p.designation).map(p=>row(p,['email','department','designation'].filter(k=>!p[k]).join(', '))),'employees');
  alert('schedule','Schedule not configured',facts.filter(f=>f.unknownSchedule).map(f=>row(f.p,'Assign an active shift or set a company default')),'shifts',!!errors.shifts);
  const trend=[];for(let date=from;date<=to;date=addDays(date,1)){const values=people.map(p=>factsFor(p,date));trend.push({date,present:values.filter(f=>f.present).length,absent:values.filter(f=>f.absent).length,leave:values.filter(f=>f.onLeave&&!f.present).length});}
  const attendanceRows=[];for(const point of trend)for(const p of people){const f=factsFor(p,point.date);if(f.scheduled||f.present||f.onLeave)attendanceRows.push({...row(p,f.present?(f.late?'Late':'Present'):f.onLeave?'Leave':f.absent?'Absent':'Not due',point.date,p.user_id+point.date,'attendance'),check_in:f.checkIn?new Date(f.checkIn).toISOString():'',check_out:f.checkOut?new Date(f.checkOut).toISOString():'',hours:f.hours==null?'':Math.max(0,f.hours).toFixed(2)});}
  lists.attendance=attendanceRows;
  const weekStart=addDays(to,-((new Date(to+'T12:00:00Z').getUTCDay()+6)%7)),weekEnd=addDays(weekStart,6),celebrations=[];
  const celebrationStart=addDays(today,-((new Date(today+'T12:00:00Z').getUTCDay()+6)%7)),celebrationEnd=addDays(celebrationStart,6);
  for(const p of people.filter(p=>p.status!=='Inactive'&&(!(p.joining_date||p.date_of_joining)||(p.joining_date||p.date_of_joining)<=today)))for(const [kind,date] of [['Birthday',p.date_of_birth ?? p.dob],['Work anniversary',p.joining_date||p.date_of_joining]])if(validDay(date))for(const year of new Set([celebrationStart.slice(0,4),celebrationEnd.slice(0,4)])){const event=year+date.slice(4);if(validDay(event)&&event>=celebrationStart&&event<=celebrationEnd&&(kind==='Birthday'||event>date))celebrations.push({...row(p,kind,event),profile_pic_url:p.profile_pic_url||p.avatar_url||''});}
  lists.leaveSchedule=leaves.filter(r=>r.status==='Approved'&&r.end_date>=to).sort((a,b)=>a.start_date.localeCompare(b.start_date)).map(r=>row(personByEmployee.get(r.employee_id),r.leave_type+' ? through '+r.end_date,r.start_date,r.leave_id,'leave'));
  const upcomingHolidays=uniqueHolidays(holidays.filter(h=>h.active!==false&&h.holiday_date>=to&&h.holiday_date<=addDays(to,30)&&(!department||!h.departments?.length||h.departments.includes(department)))).sort((a,b)=>a.holiday_date.localeCompare(b.holiday_date));
  const departments=[...new Set(active.map(p=>p.department||'Not assigned'))].map(name=>({name,count:active.filter(p=>(p.department||'Not assigned')===name).length}));
  const employmentTypes=[...new Set(active.map(p=>p.employment_type||'Not recorded'))].map(name=>({name,count:active.filter(p=>(p.employment_type||'Not recorded')===name).length}));
  for(const p of people)if(!p.last_working_date)p.last_working_date=exits.filter(r=>r.employee_id===p.user_id&&r.status==='Completed').map(r=>r.due_date).sort().pop()||'';
  const headcount=trend.map(({date})=>({date,count:people.filter(p=>{const joined=p.joining_date||p.date_of_joining;return joined&&joined<=date&&(!p.last_working_date||p.last_working_date>date)&&(p.status!=='Inactive'||!!p.last_working_date);}).length}));
  const assignments=new Map(sources.assignments.map(a=>[a.userid,parse(a.payload)])),types=parse(calendar.leave_types||'[]'),groups=parse(calendar.policy_groups||'[]');
  const balances=types.filter(t=>t.active).map(type=>{let entitlement=0,used=0,eligible=0;for(const p of active){const a=assignments.get(p.user_id)||{},group=groups.find(g=>g.id===a.group_id)||groups.find(g=>g.active&&(g.assignment_mode==='teams'?g.teams?.includes(p.department):g.userids?.includes(p.user_id)));const override=a.overrides?.[type.id];if(a.mode==='custom'?(override?override.enabled===false:!eligibleFor(type,p)):!group?.leave_type_ids?.includes(type.id))continue;eligible++;entitlement+=accruedBalance({...type,...override},to);for(const l of leaves.filter(l=>l.employee_id===p.employee_id&&l.status==='Approved'&&[type.name,type.code,type.id].includes(l.leave_type))){const start=[l.start_date,to.slice(0,4)+'-01-01'].sort().pop(),end=[l.end_date,to].sort()[0];if(start<=end)used+=(Date.parse(end)-Date.parse(start))/86400000+1;}}return {name:type.name,eligible,entitlement,used,balance:Math.max(0,Math.round((entitlement-used)*100)/100)};});
  const usage=[...new Set(leaves.map(l=>l.leave_type))].map(name=>({name,requests:leaves.filter(l=>l.leave_type===name&&l.status==='Approved'&&l.start_date<=to&&l.end_date>=from).length}));
  let payroll=null;
  if(allowed('payroll')){const ledger=new Map(),monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];for(const r of sources.payslips){if(!ids.has(r.userid)||monthNames.indexOf(r.month)+1!==Number(to.slice(5,7))||ledger.has(r.userid))continue;const value=parse(r.payload);ledger.set(r.userid,{...row(personById.get(r.userid),value.salary_status==='Finalized'?'Processed':'Draft',to,r.id,'payroll'),pay_date:value.salary?.pay_date||'',currency:'INR',gross:value.salary?.monthly_gross == null ? null : Number(value.salary.monthly_gross)});}for(const r of sources.payroll.filter(r=>employeeIds.has(r.employee_id))){const p=personByEmployee.get(r.employee_id);if(r.status==='Paid'||!ledger.has(p.user_id))ledger.set(p.user_id,{...row(p,r.status,to,p.user_id,'payroll'),pay_date:parse(r.breakdown).pay_date||'',currency:r.currency,gross:r.gross_minor == null ? null : Number(r.gross_minor)/100});}lists.payroll=[...ledger.values()];payroll={month:to.slice(0,7),draft:lists.payroll.filter(r=>r.detail==='Draft').length,processed:lists.payroll.filter(r=>r.detail==='Processed').length,paid:lists.payroll.filter(r=>r.detail==='Paid').length,nextPayDate:lists.payroll.map(r=>r.pay_date).filter(d=>validDay(d)&&d>=to).sort()[0]||null,unavailable:!!(errors.payroll||errors.payslips)};}
  if (payroll) {
    const totals = new Map();
    for (const row of lists.payroll) if (Number.isFinite(row.gross) && row.currency) {
      const total = totals.get(row.currency) || { currency: row.currency, gross: 0, records: 0 };
      total.gross += row.gross; total.records++; totals.set(row.currency,total);
    }
    payroll.totals = [...totals.values()];
    payroll.missingAmounts = lists.payroll.filter(row => !Number.isFinite(row.gross) || !row.currency).length;
    payroll.pending = active.filter(person => !lists.payroll.some(row => row.user_id === person.user_id && ['Processed','Paid'].includes(row.detail))).length;
  }
  const workforce = workforceSummary(people,to);
  const pendingWorkflows = sources.workflows.filter(row => ids.has(row.requester_id) && ['leave','attendance'].includes(row.kind));
  const linkedLeaves = new Set(pendingWorkflows.filter(row => row.kind === 'leave').map(row => row.source_id).filter(Boolean));
  workforce.pendingApprovals = errors.workflows || errors.leaves || errors.expenses ? null : pendingWorkflows.length + leaves.filter(row => row.status === 'Pending' && !linkedLeaves.has(row.leave_id)).length + sources.expenses.map(row => parse(row.payload)).filter(row => ids.has(row.employee_id) && row.status === 'Submitted').length;
  workforce.present = attendanceError ? null : facts.filter(row => row.present).length;
  lists.leaveThisWeek = leaves.filter(row => row.status === 'Approved' && row.start_date <= weekEnd && row.end_date >= to).map(leave => ({...row(personByEmployee.get(leave.employee_id),leave.leave_type,leave.start_date,leave.leave_id,'leave'),end_date:leave.end_date,onToday:leave.start_date<=to&&leave.end_date>=to}));
  const announcements=sources.announcements.filter(r=>{const recipients=parse(r.recipients);return (admin||hr&&allowed('helpdesk')||recipients.includes(actor.user_id))&&recipients.some(id=>ids.has(id));}).slice(0,8).map(({recipients,...r})=>r);
  const jobs=talent.filter(r=>r.collection==='jobs'&&(!department||r.department===department)&&(!location||r.location===location)),jobIds=new Set(jobs.map(r=>r.id));
  const recruitment=hr&&allowed('recruitment')&&!shiftId?{positions:jobs.filter(r=>r.status==='Open').reduce((s,r)=>s+Number(r.positions||1),0),stages:Object.entries(talent.filter(r=>r.collection==='candidates'&&jobIds.has(r.job_id)).reduce((a,r)=>({...a,[r.status]:(a[r.status]||0)+1}),{})).map(([name,count])=>({name,count}))}:null;
  const activity=hr&&!department&&!location&&!shiftId?[...sources.activity.map(a=>({...a,module:'Approvals'})),...sources.reviewActivity.filter(a=>!a.action.startsWith('peer')).map(a=>({...a,module:'Appraisals'}))].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,12).map(a=>({action:a.action,actor:directory.find(p=>p.user_id===a.actor_id)?.name||'Company administrator',at:a.created_at,module:a.module})):[];
  const setup=admin?[{label:'Departments',done:directory.some(p=>p.department),page:'employees'},{label:'Shifts',done:shifts.some(s=>s.status==='Active'),page:'shifts'},{label:'Leave policy',done:types.some(t=>t.active)&&groups.some(g=>g.active),page:'company-calendar'},{label:'Holidays',done:holidays.some(h=>h.active!==false),page:'company-calendar'},{label:'Payroll configuration',done:sources.payrollSetup.length>0,page:'payroll'}]:[];
  const lastPunch=attendance.map(r=>r.check_out_time||r.check_in_time).filter(Boolean).sort().pop()||null;
  return {workforce,today,from,to,refreshed_at:new Date(time).toISOString(),role:admin?'Admin':hr?'HR':'Manager',permissions:Object.fromEntries(['employees','attendance','leave','departments','payroll','helpdesk','documents','shifts','company-calendar','onboarding','offboarding','recruitment','expenses','appraisals'].map(p=>[p,allowed(p)])),filters:{departments:[...new Set(directory.map(p=>p.department).filter(Boolean))].sort(),locations:[...new Set(directory.map(p=>p.work_location||p.worklocation).filter(Boolean))].sort(),shifts:shifts.map(s=>({id:s.id,name:s.name}))},metrics,attention,lists,trend,departments,employmentTypes,headcount,celebrations:celebrations.sort((a,b)=>a.date.localeCompare(b.date)),holidays:upcomingHolidays,balances,usage,payroll,announcements,recruitment,activity,setup:setup.every(s=>s.done)?[]:setup,errors,diagnostics:{lastPunch,records:attendance.length,unknownSchedules:facts.filter(f=>f.unknownSchedule).length,unknownJoiningDates:people.filter(p=>!p.joining_date&&!p.date_of_joining).length,source:'Punch source is not recorded in the attendance table. Device, web and mobile delivery cannot be confirmed separately.'}};
}
