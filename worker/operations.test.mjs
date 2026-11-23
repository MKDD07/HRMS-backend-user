import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import worker from './index.mjs';
import { OPERATIONS } from '../shared/operationsModel.mjs';
import { routePages, parsePages } from '../shared/dashboardAccess.mjs';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const file of readdirSync(new URL('../migrations/hrms/', import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../migrations/hrms/'+file,import.meta.url),'utf8'));
// The new migration must remain safe to reapply without destroying records.
sqlite.exec(readFileSync(new URL('../migrations/hrms/0011_hr_operations.sql',import.meta.url),'utf8'));
function prepare(sql, values=[]) { return {bind:(...params)=>prepare(sql,params),first:async()=>sqlite.prepare(sql).get(...values)||null,all:async()=>({results:sqlite.prepare(sql).all(...values)}),run:async()=>sqlite.prepare(sql).run(...values)}; }
const objects=new Map(), env={DB:{prepare},HRMS_DOCUMENTS:{async put(key,bytes){objects.set(key,bytes);},async get(key){return objects.has(key)?{body:objects.get(key)}:null;},async delete(key){objects.delete(key);}}};
sqlite.exec("INSERT INTO companies(company_id,name) VALUES('a','A'),('b','B');");
const tokens={};
for (const [id,company,role,pages] of [['admin','a','company_admin',[]],['employee','a','employee',[]],['reviewer','a','employee',['expenses','timesheets','appraisals']],['other','a','employee',['expenses']],['analyst','a','employee',['hr-analytics']],['admin-b','b','company_admin',[]]]) {
  sqlite.prepare('INSERT INTO users(user_id,company_id,username,password_hash,role,must_change_password) VALUES(?,?,?,?,?,0)').run(id,company,id,'test',role);
  sqlite.prepare("INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,department,profile,created_at,dashboard_access,dashboard_pages) VALUES(?,?,?,?,?,'Engineering',?,?,?,?)").run('e-'+id,company,id,id,id,JSON.stringify({joining_date:'2026-01-01'}),'2026-01-01',pages.length?1:0,JSON.stringify(pages));
  tokens[id]=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test-'+id))).toString('hex');
  const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tokens[id]))).toString('hex');
  sqlite.prepare('INSERT INTO sessions(token_hash,company_id,user_id,expires_at) VALUES(?,?,?,?)').run(digest,company,id,Date.now()+3600000);
}
let checks=0;
async function call(path,{user='admin',body,status=200,method=body?'POST':'GET',raw}={}) {
  const response=await worker.fetch(new Request('https://test.invalid/api/v1'+path,{method,headers:{Authorization:'Bearer '+tokens[user],'Content-Type':raw?'application/octet-stream':'application/json'},...(method==='POST'?{body:raw || JSON.stringify(body)}:{})}),env);
  if(response.headers.get('content-type')?.includes('application/json')){const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));checks++;return result.data;}
  assert.equal(response.status,status);checks++;return response;
}
const save=(c,body,options={})=>call('/operations/'+c+(body.id?'/'+body.id:''),{body,...options});
try {
  for(const [collection,config] of Object.entries(OPERATIONS)){
    assert.deepEqual(routePages('/api/v1/operations/'+collection,'GET'),[config.page]);
    assert.ok(parsePages([config.page]).includes(config.page));
    assert.deepEqual(await call('/operations/'+collection),[]);
    await call('/operations/'+collection,{user:'employee',status:403});
  }
  await call('/operations/expenses',{user:'analyst',status:403});
  await call('/operations/expenses',{user:'reviewer'});
  await call('/operations/__proto__',{status:404});
  const expense={title:'Train fare',employee_id:'employee',reviewer_id:'reviewer',category:'Travel',expense_date:'2026-01-02',amount:1250.50,currency:'INR',status:'Draft'};
  let claim=await save('expenses',expense);
  assert.equal(claim.revision,0);
  assert.deepEqual(await call('/operations/expenses',{user:'admin-b'}),[]);
  await save('expenses',{...claim,title:'Foreign edit'},{user:'admin-b',status:404});
  await save('expenses',{...expense,employee_id:'admin-b'},{status:400});
  await save('expenses',{...expense,reviewer_id:'employee'},{status:400});
  await save('expenses',{...expense,amount:-2},{status:400});
  await save('expenses',{...expense,amount:1.123},{status:400});
  await save('expenses',{...expense,expense_date:'2026-02-30'},{status:400});
  await save('expenses',{...expense,status:'Paid'},{status:400});
  await save('expenses',{...claim,status:'Submitted'},{status:400});
  const receiptPath='/operations/expenses/'+claim.id+'/receipts';
  const receipt=await call(receiptPath+'?name=receipt.pdf',{method:'POST',raw:Buffer.from('%PDF-1.4\nfixture')});
  assert.equal((await call(receiptPath)).length,1);
  await call(receiptPath,{user:'admin-b',status:404});
  await call(receiptPath,{user:'analyst',status:403});
  await call(receiptPath,{method:'POST',raw:Buffer.from('<script>bad</script>'),status:400});
  const downloaded=await call(receiptPath+'/'+receipt.id);
  assert.equal(await downloaded.text(),'%PDF-1.4\nfixture');
  claim=await save('expenses',{...claim,status:'Submitted'});
  await save('expenses',{...claim,amount:1,status:'Draft'},{status:409});
  await call(receiptPath,{method:'POST',raw:Buffer.from('%PDF-1.4'),status:409});
  const review='/operations/expenses/'+claim.id+'/review';
  await call(review,{user:'other',body:{revision:claim.revision,decision:'Approved'},status:403});
  await call(review,{user:'reviewer',body:{revision:claim.revision,decision:'Rejected'},status:400});
  claim=await call(review,{user:'reviewer',body:{revision:claim.revision,decision:'Approved',note:'Verified receipt'}});
  await call(review,{user:'reviewer',body:{revision:0,decision:'Approved'},status:409});
  await call('/operations/expenses/'+claim.id+'/pay',{user:'reviewer',body:{revision:claim.revision,paid_date:'2026-01-03',payment_reference:'BANK-1'},status:403});
  claim=await call('/operations/expenses/'+claim.id+'/pay',{body:{revision:claim.revision,paid_date:'2026-01-03',payment_reference:'BANK-1'}});
  assert.equal(claim.status,'Paid');
  await save('expenses',{...claim,status:'Draft'},{status:409});
  const cycle=await save('review_cycles',{title:'Annual review',start_date:'2026-01-01',end_date:'2026-12-31',status:'Open'});
  let appraisal=await save('appraisals',{title:'Employee review',cycle_id:cycle.id,employee_id:'employee',reviewer_id:'reviewer',status:'Self review',self_review:'Delivered goals',self_rating:4});
  await save('appraisals',{...appraisal,id:undefined},{status:409});
  await save('appraisals',{...appraisal,manager_rating:6},{status:400});
  await save('appraisals',{...appraisal,status:'Finalized'},{status:400});
  appraisal=await save('appraisals',{...appraisal,status:'Finalized',manager_review:'Strong delivery',manager_rating:4,outcome:'Meets expectations'},{user:'reviewer'});
  await save('appraisals',{...appraisal,self_rating:5},{status:409});
  const plan=await save('benefit_plans',{title:'Health cover',provider:'Insurer',coverage:'Hospital care',coverage_amount:500000,premium:12000,currency:'INR',start_date:'2026-01-01',end_date:'2026-12-31',status:'Active'});
  const enrollment=await save('benefit_enrollments',{title:'Employee cover',plan_id:plan.id,employee_id:'employee',start_date:'2026-01-01',end_date:'2026-12-31',status:'Active'});
  await save('benefit_enrollments',{...enrollment,id:undefined,end_date:'2027-01-01'},{status:400});
  await save('dependants',{title:'Dependant',enrollment_id:enrollment.id,relationship:'Child',birth_date:'2020-02-02',status:'Covered'});
  await save('dependants',{title:'Foreign',enrollment_id:enrollment.id,relationship:'Child',birth_date:'2020-02-02',status:'Covered'},{user:'admin-b',status:400});
  let survey=await save('surveys',{title:'Engagement',start_date:'2020-01-01',end_date:'2099-12-31',status:'Open',questions:[{id:'q1',label:'Satisfaction?',type:'rating'},{id:'q2',label:'Suggestions?',type:'text'}]});
  await save('survey_responses',{survey_id:survey.id,employee_id:'employee',status:'Submitted',answers:{q1:6,q2:'Good'}},{status:400});
  const response=await save('survey_responses',{survey_id:survey.id,employee_id:'employee',status:'Submitted',answers:{q1:4,q2:'More learning'}});
  await save('survey_responses',{...response,id:undefined},{status:409});
  await save('survey_responses',{...response,answers:{q1:1,q2:'Changed'}},{status:409});
  await save('surveys',{...survey,questions:[{id:'q1',label:'Changed',type:'text'}]},{status:409});
  survey=await save('surveys',{...survey,status:'Closed'});
  await save('survey_responses',{survey_id:survey.id,employee_id:'reviewer',status:'Submitted',answers:{q1:4,q2:'Good'}},{status:400});
  const project=await save('projects',{title:'Project A',owner_id:'reviewer',start_date:'2026-01-01',end_date:'2026-12-31',budget_hours:100,status:'Active'});
  const time={title:'Implementation',project_id:project.id,employee_id:'employee',reviewer_id:'reviewer',work_date:'2026-01-02',hours:8,billable:'Yes',status:'Submitted'};
  let entry=await save('timesheets',time);
  await save('timesheets',{...time,hours:17},{status:400});
  await save('timesheets',{...time,hours:1.1},{status:400});
  await save('timesheets',{...time,work_date:'2025-12-31'},{status:400});
  entry=await call('/operations/timesheets/'+entry.id+'/review',{user:'reviewer',body:{revision:entry.revision,decision:'Approved'}});
  await save('timesheets',{...entry,status:'Draft',hours:1},{status:409});
  const parallel = await Promise.all([1,2].map(async n=>{
    const res=await worker.fetch(new Request('https://test.invalid/api/v1/operations/timesheets',{method:'POST',headers:{Authorization:'Bearer '+tokens.admin,'Content-Type':'application/json'},body:JSON.stringify({...time,title:'Concurrent '+n,work_date:'2026-01-03',hours:16})}),env);
    return res.status;
  }));
  assert.equal(parallel.filter(s=>s===200).length,1,'Only one concurrent entry may save.');
  assert.ok(parallel.some(s=>s===400 || s===409),'The other daily-hours entry must be rejected.');
  const raceSurvey=await save('surveys',{title:'Concurrent survey',start_date:'2020-01-01',end_date:'2099-12-31',status:'Open',questions:[{id:'q1',label:'Original question',type:'rating'}]});
  const raceBodies=[['surveys/'+raceSurvey.id,{...raceSurvey,questions:[{id:'q1',label:'Changed question',type:'text'}]}],['survey_responses',{survey_id:raceSurvey.id,employee_id:'employee',status:'Submitted',answers:{q1:4}}]];
  const raceStatuses=await Promise.all(raceBodies.map(async ([path,body])=>(await worker.fetch(new Request('https://test.invalid/api/v1/operations/'+path,{method:'POST',headers:{Authorization:'Bearer '+tokens.admin,'Content-Type':'application/json'},body:JSON.stringify(body)}),env)).status));
  assert.ok(raceStatuses.includes(200));assert.ok(raceStatuses.some(s=>s===400 || s===409),'Concurrent question edit and response must not save inconsistent answers.');
  // Analytics: company-scoped source rows, actual month boundaries, currency separation.
  sqlite.prepare("INSERT INTO attendance(attendance_id,company_id,employee_id,date,check_in_time,check_out_time) VALUES('at','a','e-employee','2026-01-02','2026-01-02T09:00:00Z','2026-01-02T17:00:00Z')").run();
  sqlite.prepare("INSERT INTO payroll(payroll_id,company_id,employee_id,period,gross_minor,deductions_minor,currency,status) VALUES('pay','a','e-employee','2026-01',1000000,100000,'INR','Paid')").run();
  sqlite.exec("CREATE TABLE payslip_records(id TEXT,userid TEXT,year TEXT,month TEXT,payload TEXT,created_at TEXT)");
  for(const [id,gross,date,company] of [['old',20000,'2026-01-01','a'],['new',25000,'2026-01-02','a'],['foreign',99999,'2026-01-03','b']]) sqlite.prepare('INSERT INTO payslip_records VALUES(?,?,?,?,?,?)').run(id,'employee','2026','January',JSON.stringify({company_id:company,salary_status:'Finalized',salary:{monthly_gross:gross,total_deductions:1000,monthly_net:gross-1000}}),date);
  const analytics=await call('/hr-analytics?from=2026-01&to=2026-02',{user:'analyst'});
  assert.equal(analytics.monthly[0].hours,8);assert.equal(analytics.monthly[0].joined,5);assert.equal(analytics.monthly[1].closing,5);
  assert.equal(analytics.payroll[0].net,9000);assert.equal(analytics.salaryLedger[0].gross,25000);assert.equal(analytics.salaryLedger[0].records,1);
  const foreign=await call('/hr-analytics?from=2026-01&to=2026-02',{user:'admin-b'});assert.equal(foreign.payroll.length,0);assert.equal(foreign.currentHeadcount,1);
  await call('/hr-analytics?from=2026-01&to=2026-02',{user:'reviewer',status:403});
  await call('/hr-analytics?from=2026-13&to=2026-14',{status:400});
  await call('/hr-analytics?from=2020-01&to=2026-01',{status:400});
  await call('/hr-analytics/views',{user:'analyst',body:{title:'Q1',from:'2026-01',to:'2026-03'}});
  assert.equal((await call('/hr-analytics/views',{user:'analyst'})).length,1);
  assert.equal((await call('/hr-analytics/views',{user:'admin-b'})).length,0);
  console.log(`HR operations passed: ${checks} API checks, all six sections, company isolation, delegated permissions, approval/payment guards, receipt storage, appraisals, benefits, surveys, timesheets, analytics and idempotent migration.`);
} finally { sqlite.close(); }
