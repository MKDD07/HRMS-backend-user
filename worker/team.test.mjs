import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { teamHandle } from './team.mjs';
import worker from './index.mjs';
const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users(company_id,user_id,email,status);
CREATE TABLE employees(company_id,user_id,first_name,last_name,department,designation,status,profile);
CREATE TABLE workflow_configuration(company_id,payload);`);
function person(company,id,dept,profile={},status='Active') {
  sql.prepare('INSERT INTO users VALUES(?,?,?,?)').run(company,id,id+'@work.test','active');
  sql.prepare('INSERT INTO employees VALUES(?,?,?,?,?,?,?,?)').run(company,id,id,'Person',dept,'Developer',status,JSON.stringify(profile));
}
person('c','lead','Engineering',{work_phone:'+911234567890',profile_pic_url:'https://images.test/lead.jpg',bank_account:'SECRET'});
person('c','member','Engineering',{reports_to_userid:'lead'});
person('c','temp','Support');
person('c','inactive','Engineering',{},'Inactive');
person('other','foreign','Engineering');
sql.prepare('INSERT INTO workflow_configuration VALUES(?,?)').run('c', JSON.stringify({
  links:[{type:'direct',manager:'lead',employee:'member'},{type:'direct',manager:'foreign',employee:'member'}],
  departments:[{name:'Engineering',themeIndex:0,head:'lead',memberRoles:{lead:'Team leader'},temporaryMembers:['temp','foreign'],leadershipCoverage:[{person:'lead',cover:'temp',role:'Team leader',from:'2026-10-01',until:'2026-10-31'}]}],
  companyLeadership:{draft:{Owner:'member'},finalized:{roles:{CTO:'lead'}}}
}));
function prepare(query,args=[]) {return {bind(...values){return prepare(query,values);},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};}};}
const db={prepare};
const result=await teamHandle({db,actor:{company_id:'c',user_id:'member'},now:new Date('2026-10-13T10:00:00Z')});
assert.equal(result.members.length,3);
assert.equal(result.members.find(m=>m.id==='lead').profile_pic_url,'https://images.test/lead.jpg');
assert.deepEqual(result.members.find(m=>m.id==='lead').colors,{accent:'#388a75',tint:'#e1faf3',glow:'#f2fbfc'});
assert.deepEqual(result.members.find(m=>m.id==='member').colors,result.members.find(m=>m.id==='lead').colors);
assert.notDeepEqual(result.members.find(m=>m.id==='temp').colors,result.members.find(m=>m.id==='lead').colors);
assert.equal(result.members.find(m=>m.id==='lead').phone,'+911234567890');
assert.deepEqual(result.members.find(m=>m.id==='member').manager_ids,['lead']);
assert.deepEqual(result.members.find(m=>m.id==='member').badges,[]);
assert.ok(result.members.find(m=>m.id==='lead').badges.includes('CTO'));
assert.ok(result.members.find(m=>m.id==='temp').badges.includes('Acting team leader'));
const engineering=result.departments.find(d=>d.name==='Engineering');
assert.deepEqual(new Set(engineering.member_ids),new Set(['lead','member','temp']));
assert.equal(JSON.stringify(result).includes('SECRET'),false);
assert.equal(JSON.stringify(result).includes('foreign'),false);
assert.equal(JSON.stringify(result).includes('inactive'),false);
const other=await teamHandle({db,actor:{company_id:'other',user_id:'foreign'}});
assert.deepEqual(other.members.map(m=>m.id),['foreign']);
assert.equal(other.departments[0].badges.foreign,undefined);
// Exercise the real authenticated route as an employee with no dashboard page grants.
sql.exec(`CREATE TABLE companies(company_id,status); INSERT INTO companies VALUES('c','active'),('other','active');
CREATE TABLE sessions(token_hash,company_id,user_id,expires_at);
ALTER TABLE users ADD COLUMN role DEFAULT 'employee';
ALTER TABLE employees ADD COLUMN employee_id;
ALTER TABLE employees ADD COLUMN dashboard_access DEFAULT 1;
ALTER TABLE employees ADD COLUMN dashboard_pages DEFAULT '[]';
UPDATE employees SET employee_id=user_id;`);
const token='a'.repeat(64);
const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),byte=>byte.toString(16).padStart(2,'0')).join('');
sql.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest,'c','member',Date.now()+3600000);
const env={DB:db,ALLOW_LOCALHOST_ORIGINS:'true'};
const unauthorized=await worker.fetch(new Request('https://hrms.test/api/v1/team'),env);
assert.equal(unauthorized.status,401);
const authenticated=await worker.fetch(new Request('https://hrms.test/api/v1/team?company_id=other',{headers:{Authorization:'Bearer '+token,Origin:'http://localhost:49510'}}),env);
assert.equal(authenticated.status,200);
const payload=await authenticated.json();
assert.equal(payload.data.members.length,3);
assert.equal(payload.data.current_user_id,'member');
assert.equal(JSON.stringify(payload).includes('foreign'),false);
console.log('Team directory checks passed: tenant scope, temporary membership, acting leadership, hierarchy and minimal contact fields.');


// Monthly attendance uses the same authenticated employee scope.
sql.exec(`CREATE TABLE attendance(attendance_id,company_id,employee_id,date,check_in_time,check_out_time);
CREATE TABLE leave_requests(company_id,employee_id,start_date,end_date,status,leave_type);
INSERT INTO attendance VALUES('oct','c','member','2026-10-01','2026-10-01T04:00:00Z','2026-10-01T12:30:00Z'),('sep','c','member','2026-09-01','2026-09-01T04:00:00Z','2026-09-01T12:00:00Z'),('foreign','other','foreign','2026-10-01','2026-10-01T04:00:00Z','2026-10-01T12:00:00Z');`);
const monthly=await worker.fetch(new Request('https://hrms.test/api/v1/get-attendance?year=2026&month=October&userid=member',{headers:{Authorization:'Bearer '+token}}),env);
assert.equal(monthly.status,200);
const monthlyData=(await monthly.json()).data;
assert.deepEqual(monthlyData.records.map(r=>r.attendance_id),['oct']);
assert.equal(monthlyData.attendanceCount.presentCount,1);
assert.equal(monthlyData.attendanceCount.workedInMonth,'8h 30m');
const invalid=await worker.fetch(new Request('https://hrms.test/api/v1/get-attendance?year=2026&month=invalid&userid=member',{headers:{Authorization:'Bearer '+token}}),env);
assert.equal(invalid.status,400);
console.log('Monthly route passed: month filtering, totals, tenant isolation and invalid month.');
