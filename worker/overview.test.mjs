import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { overviewHandle } from './overview.mjs';
import { attendanceFacts,istDay,uniqueHolidays } from '../shared/overviewModel.mjs';
import { PAYROLL_SCHEMA } from '../server/payrollDatabase.mjs';
import worker from './index.mjs';
import { documentHandle } from './documents.mjs';
const sqlite=new DatabaseSync(':memory:');
for(const f of readdirSync(new URL('../migrations/hrms/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../migrations/hrms/'+f,import.meta.url),'utf8'));
for(const sql of PAYROLL_SCHEMA)sqlite.exec(sql);
let failAttendance=false;
function prepare(sql,values=[]){return {bind:(...params)=>prepare(sql,params),async all(){if(failAttendance&&sql.includes('FROM attendance a'))throw new Error('Source failure');return {results:sqlite.prepare(sql).all(...values)};},async first(){return sqlite.prepare(sql).get(...values)||null;},async run(){return sqlite.prepare(sql).run(...values);}};}
const db={prepare,async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}},company='a',time=Date.parse('2026-10-12T14:00:00Z');
sqlite.exec("INSERT INTO companies(company_id,name) VALUES('a','A'),('b','B')");
for(const id of ['admin','manager','late','absent','leave','unknown','night','foreign']){
  const c=id==='foreign'?'b':'a';sqlite.prepare("INSERT INTO users(user_id,company_id,username,email,password_hash,role,must_change_password) VALUES(?,?,?,?,?,'employee',0)").run(id,c,id,id+'@test.invalid','test');
  if(id==='admin')continue;
  sqlite.prepare('INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,department,designation,profile) VALUES(?,?,?,?,?,?,?,?)').run('e-'+id,c,id,id,id,['manager','night'].includes(id)?'Management':'Fitness','Engineer',JSON.stringify({joining_date:'2025-10-12',dob:'1995-10-14',work_location:id==='night'?'Remote':'Office',reports_to_userid:['late','absent'].includes(id)?'manager':'another',shift_id:id==='night'?'night':id==='unknown'?'missing':'day',employment_type:id==='late'?'Contract':'Full-time'}));
}
const shift={id:'day',name:'Day',startTime:'09:00',endTime:'18:00',gracePeriodMins:15,earlyExitGraceMins:10,breakDurationMins:60,halfDayHours:4,workingDays:['Mon','Tue','Wed','Thu','Fri'],status:'Active',isDefault:true};
const night={...shift,id:'night',name:'Night',startTime:'22:00',endTime:'06:00',isDefault:false,workingDays:['Sun','Mon']};
sqlite.prepare("INSERT INTO dashboard_configuration(company_id,section,payload,revision) VALUES('a','shifts',?,1)").run(JSON.stringify([shift,night]));
sqlite.prepare("INSERT INTO company_calendar(company_id,holidays,leave_types,policy_groups) VALUES('a',?,?,?)").run(JSON.stringify([{id:'holiday',name:'Company holiday',holiday_date:'2026-10-13',active:true}]),JSON.stringify([{id:'cl',name:'Casual',active:true,initial_days:12,accrual_frequency:'none'}]),JSON.stringify([{id:'group',name:'Standard',active:true,assignment_mode:'teams',teams:['Fitness'],leave_type_ids:['cl']}]));
sqlite.prepare("INSERT INTO leave_requests(leave_id,company_id,employee_id,leave_type,start_date,end_date,reason,status) VALUES('leave','a','e-leave','Casual','2026-10-12','2026-10-12','Test','Approved')").run();
for(const [id,day,start,end] of [['late','2026-10-12','2026-10-12T04:30:00Z','2026-10-12T07:00:00Z'],['absent','2026-10-11','2026-10-11T04:00:00Z',null],['night','2026-10-11','2026-10-11T16:30:00Z',null]])sqlite.prepare("INSERT INTO attendance(attendance_id,company_id,employee_id,date,check_in_time,check_out_time) VALUES(?,'a',?,?,?,?)").run(id,'e-'+id,day,start,end);
sqlite.prepare("INSERT INTO hr_connect(id,company_id,kind,title,body,status,audience,recipients,author_id,created_at,updated_at) VALUES('notice','a','announcement','Fitness notice','Team notice','Published','Fitness',?,'admin','2026-10-12','2026-10-12')").run(JSON.stringify(['late','absent','manager']));
sqlite.prepare("INSERT INTO workflow_requests(request_id,company_id,requester_id,kind,status,payload,route,created_at,updated_at) VALUES('reg','a','late','attendance','Pending',?,'{}','2026-10-12','2026-10-12')").run(JSON.stringify({date:'2026-10-11'}));
sqlite.prepare("INSERT INTO payslip_assignments(id,payload) VALUES('late','{}')").run();
for(const [id,status,created] of [['old','Finalized','2026-10-10'],['latest','Draft','2026-10-12']])sqlite.prepare("INSERT INTO payslip_records(id,userid,year,month,created_at,status,payload) VALUES(?,'late','2026','October',?,'pending',?)").run(id,created,JSON.stringify({company_id:'a',salary_status:status,salary:{pay_date:'2026-10-31'}}));
const admin={company_id:'a',user_id:'admin',role:'company_admin'},manager={company_id:'a',user_id:'manager',role:'employee',dashboard_access:true,dashboard_pages:['dashboard']};
const overview=(query='',actor=admin,t=time)=>overviewHandle({db,actor,url:new URL('https://test.invalid/api/v1/overview?'+query),time:t});
const metric=(data,key)=>data.metrics.find(m=>m.key===key).value;
try{
  const holidaySamples=[{id:'one',name:'Company holiday',holiday_date:'2026-10-13'}, {id:'imported',name:' COMPANY  HOLIDAY ',holiday_date:'2026-10-13',type:'Observance'}, {id:'different',name:'Another holiday',holiday_date:'2026-10-13'}, {id:'next-year',name:'Company holiday',holiday_date:'2027-10-13'}];
  assert.deepEqual(uniqueHolidays(holidaySamples).map(h=>h.id),['one','different','next-year']);
  sqlite.prepare("UPDATE company_calendar SET holidays=? WHERE company_id='a'").run(JSON.stringify(holidaySamples.slice(0,2)));
  assert.equal(istDay('2026-10-11T19:00:00Z'),'2026-10-12');
  const result=await overview('department=Fitness');assert.equal(metric(result,'employees'),4);assert.equal(metric(result,'absent'),1);assert.equal(metric(result,'late'),1);assert.equal(metric(result,'early'),1);assert.equal(metric(result,'halfDay'),1);assert.equal(metric(result,'onLeave'),1);assert.equal(result.diagnostics.unknownSchedules,1);
  assert.ok(result.lists.absent.every(r=>r.department==='Fitness'));assert.equal(result.attention.find(r=>r.key==='missingOut').value,1);assert.equal(result.attention.find(r=>r.key==='regularizations').value,1);
  assert.equal(result.holidays.length,1);assert.equal(result.celebrations.length,8);assert.equal(result.payroll.draft,1);assert.equal(result.payroll.processed,0);assert.equal(result.payroll.nextPayDate,'2026-10-31');assert.equal(result.announcements.length,1);assert.equal(result.balances[0].used,1);assert.equal(result.setup.length,0,'Completed setup hidden');
  const filtered=await overview('location=Remote');assert.equal(metric(filtered,'employees'),1);assert.equal(metric(filtered,'absent'),0,'Night shift has not started');assert.equal(filtered.announcements.length,0);assert.equal(filtered.payroll.draft,0);
  assert.equal((await overview('shift=day')).lists.employees.length,4);
  assert.equal((await overview('days=30')).trend.length,30);
  // Current-week celebrations stay current even with historical report dates.
  const birthdayProfile=JSON.parse(sqlite.prepare("SELECT profile FROM employees WHERE user_id='late'").get().profile);
  sqlite.prepare("UPDATE employees SET profile=? WHERE user_id='late'").run(JSON.stringify({...birthdayProfile,date_of_birth:'1995-10-12',dob:'1995-10-14'}));
  const birthday=await overview('from=2026-10-01&to=2026-10-04');
  assert.ok(birthday.celebrations.some(r=>r.user_id==='late'&&r.detail==='Birthday'&&r.date==='2026-10-12'),'Today birthday uses canonical saved date and current IST week');
  assert.equal((await overview('department=Management')).celebrations.some(r=>r.user_id==='late'),false,'Celebrations respect dashboard scope');
  sqlite.prepare("UPDATE employees SET profile=? WHERE user_id='late'").run(JSON.stringify(birthdayProfile));
  sqlite.exec('CREATE TABLE personal_details(userid TEXT PRIMARY KEY,dob TEXT,gender TEXT,bio TEXT,address TEXT,address2 TEXT,state TEXT,city TEXT,zipcode TEXT,country TEXT,address_type TEXT,updated_at TEXT)');
  sqlite.prepare('INSERT INTO personal_details(userid,dob) VALUES(?,?)').run('late','1995-10-12');
  sqlite.prepare("UPDATE employees SET profile=? WHERE user_id='late'").run(JSON.stringify({...birthdayProfile,dob:undefined}));
  assert.ok((await overview()).celebrations.some(r=>r.user_id==='late'&&r.detail==='Birthday'&&r.date==='2026-10-12'),'Legacy personal DOB is available to celebrations');
  sqlite.prepare("UPDATE employees SET profile=? WHERE user_id='late'").run(JSON.stringify(birthdayProfile));
  assert.equal((await overview('from=2026-10-13&to=2026-10-13',admin,Date.parse('2026-10-13T14:00:00Z'))).lists.absent.length,0,'Holiday excludes absence');
  await assert.rejects(overview('from=2026-01-01&to=2026-10-12'),/90 days/);await assert.rejects(overview('to=2026-10-20'),/past or current/);
  const team=await overview('',manager);assert.equal(team.role,'Manager');assert.equal(metric(team,'employees'),2);assert.equal(team.payroll,null);assert.equal(team.recruitment,null);assert.deepEqual(team.activity,[]);assert.ok(Object.values(team.lists).flat().every(r=>!r.user_id||['late','absent'].includes(r.user_id)));assert.equal(team.filters.departments.length,1);
  await assert.rejects(overview('',{...manager,dashboard_access:false}),e=>e.status===403);
  const foreign=await overview('',{...admin,company_id:'b',user_id:'foreign'});assert.equal(metric(foreign,'employees'),1);assert.equal(foreign.lists.late.length,0);assert.equal(foreign.announcements.length,0);
  failAttendance=true;const failed=await overview();assert.equal(metric(failed,'absent'),null);assert.ok(failed.errors.attendance);failAttendance=false;
  const p={employee_id:'night',status:'Active',shift_id:'night'};
  const records=[{employee_id:'night',date:'2026-10-11',check_in_time:'2026-10-11T16:30:00Z'}];
  assert.equal(attendanceFacts(p,'2026-10-11',records,[],[night],[],Date.parse('2026-10-11T23:00:00Z')).missingOut,false,'Overnight shift still in progress');
  assert.equal(attendanceFacts(p,'2026-10-11',records,[],[night],[],time).missingOut,true);
  assert.equal(attendanceFacts({...p,shift_id:'day'},'2026-10-12',[],[],[shift],[],Date.parse('2026-10-12T03:00:00Z')).absent,false,'Before shift start');
  let uploads=0;
  async function upload(expiry){const form=new FormData();form.set('file',new File(['%PDF-1.4 test'],'contract.pdf',{type:'application/pdf'}));form.set('title','Contract');form.set('userid','late');form.set('expiry_date',expiry);const request=new Request('https://test.invalid/api/v1/documents',{method:'POST',body:form});return documentHandle({request,env:{HRMS_DOCUMENTS:{async put(){uploads++;return true;}}},db,actor:admin,url:new URL(request.url),path:'/api/v1/documents',method:'POST'});}
  await assert.rejects(upload('2026-02-30'),/Invalid expiry/);assert.equal(uploads,0);
  const uploaded=await upload('2026-11-01');assert.equal(uploaded.expiry_date,'2026-11-01');assert.equal((await overview('department=Fitness')).attention.find(a=>a.key==='documents').value,1);
  assert.equal((await overview('department=Management')).attention.find(a=>a.key==='documents').value,0);
  // Real authentication and the browser's punch action aliases, including overnight checkout.
  const token='a'.repeat(64),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
  sqlite.prepare("INSERT INTO sessions(token_hash,company_id,user_id,expires_at) VALUES(?,'a','late',?)").run(hash,Date.now()+3600000);
  sqlite.prepare("UPDATE employees SET profile=? WHERE user_id='late'").run(JSON.stringify({...birthdayProfile,date_of_birth:'1995-10-14'}));
  const editBirthday=await worker.fetch(new Request('https://test.invalid/api/v1/edit-personal',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({dob:'1995-10-12'})}),{DB:db});
  assert.equal(editBirthday.status,200);
  assert.ok((await overview()).celebrations.some(r=>r.user_id==='late'&&r.detail==='Birthday'&&r.date==='2026-10-12'),'Saving through personal editor replaces stale canonical birthday');
  sqlite.prepare("DELETE FROM attendance WHERE employee_id='e-late'").run();
  const request=async action=>worker.fetch(new Request('https://test.invalid/api/v1/attendance',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action})}),{DB:db});
  assert.equal((await request('punch_in')).status,200);assert.equal(sqlite.prepare("SELECT date FROM attendance WHERE employee_id='e-late'").get().date,istDay());
  assert.equal((await request('punch_out')).status,200);
  // Simulate a distinct open overnight punch, including its matching evidence state.
  sqlite.prepare("DELETE FROM attendance_punch_evidence WHERE company_id='a' AND attendance_id IN (SELECT attendance_id FROM attendance WHERE employee_id='e-late')").run();
  sqlite.prepare("UPDATE attendance SET check_out_time=NULL,check_in_time=?,date=? WHERE employee_id='e-late'").run(new Date(Date.now()-3600000).toISOString(),addPreviousDay());
  assert.equal((await request('check-out')).status,200,'Checkout closes the recent open record across midnight');
  console.log('Overview tests passed: scoped metrics/widgets, IST, holidays, shift grace/overnight, errors, role and tenant isolation, payroll latest revision, setup and browser punch aliases.');
}finally{sqlite.close();}
function addPreviousDay(){return new Date(Date.parse(istDay()+'T00:00:00Z')-86400000).toISOString().slice(0,10);}
