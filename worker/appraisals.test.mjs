import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import worker from './index.mjs';
import { processAppraisalTimers } from './appraisals.mjs';
import { newReviewTemplate, weightedScore, bandFor, validateTemplate, distributionTargets } from '../shared/appraisalModel.mjs';
import { appraisalPayrollRows, withAppraisalRows } from '../shared/appraisalPayroll.mjs';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync(new URL('../migrations/hrms/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../migrations/hrms/'+file,import.meta.url),'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0012_appraisal_workflow.sql',import.meta.url),'utf8'));
function prepare(sql,values=[]){assert.ok(values.length<=100,'D1 bound parameter limit');return {bind:(...params)=>prepare(sql,params),first:async()=>sqlite.prepare(sql).get(...values)||null,all:async()=>({results:sqlite.prepare(sql).all(...values)}),run:async()=>sqlite.prepare(sql).run(...values)};}
let queue=Promise.resolve(),beforeBatch=null;
const db={prepare,batch(statements){const task=queue.then(async()=>{if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}});queue=task.catch(()=>{});return task;}};
const env={DB:db},tokens={};
sqlite.exec("INSERT INTO companies(company_id,name) VALUES('a','A'),('b','B')");
for(const id of ['admin','hr','manager','replacement','employee','probation','newjoiner','peer1','peer2','peer3','foreign']){
  const company=id==='foreign'?'b':'a',role=['admin','foreign'].includes(id)?'company_admin':'employee';
  sqlite.prepare('INSERT INTO users(user_id,company_id,username,password_hash,role,must_change_password) VALUES(?,?,?,?,?,0)').run(id,company,id,'test',role);
  if(role==='employee')sqlite.prepare('INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,department,designation,status,profile) VALUES(?,?,?,?,?,?,?,?,?)').run('e-'+id,company,id,id,id,'Engineering','Engineer',id==='probation'?'Probation':'Active',JSON.stringify({joining_date:id==='newjoiner'?'2026-10-01':'2025-01-01',reports_to_userid:'manager'}));
  tokens[id]=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('appraisal-'+id))).toString('hex');
  const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tokens[id]))).toString('hex');
  sqlite.prepare('INSERT INTO sessions(token_hash,company_id,user_id,expires_at) VALUES(?,?,?,?)').run(digest,company,id,Date.now()+3600000);
}
let checks=0;
async function call(path,{user='admin',body,status=200}={}){
  const response=await worker.fetch(new Request('https://test.invalid/api/v1/appraisals/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+tokens[user],'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
  const result=await response.json();assert.equal(response.status,status,path+': '+JSON.stringify(result));checks++;return result.data;
}
const future=(days=10)=>new Date(Date.now()+days*86400000).toISOString();
const template={...newReviewTemplate(),name:'Annual performance'};
const answers=rating=>Object.fromEntries(template.sections.flatMap(s=>s.questions.map(q=>[q.id,{rating,comment:'Evidence for '+q.id}])));
const cycleBody=templateId=>({name:'Annual review',period:'Annual',start_date:'2026-01-01',end_date:'2026-12-31',template_id:templateId,scope:{departments:[],designations:[],employees:['employee','probation','newjoiner'],exclude_probation:true,joined_before:'2026-06-01'},deadlines:{self:future(),manager:future(11),peer:future(12),calibration:future(13),publish:future(14)},peer_enabled:true,enforce_distribution:false,reminder_hours:24,escalation_hours:24});
try{
  assert.equal(weightedScore(template,answers(4)),4);assert.equal(weightedScore(template,{}),null);
  assert.equal(bandFor(4.5),'Outstanding');assert.equal(bandFor(3.5),'Exceeds expectations');assert.equal(bandFor(2.5),'Meets expectations');
  assert.equal(Object.values(distributionTargets(7,template.distribution)).reduce((a,b)=>a+b,0),7);
  const bad=structuredClone(template);bad.sections[0].questions[0].id='__proto__';assert.throws(()=>validateTemplate(bad));
  await call('templates',{user:'employee',status:403});
  await call('roles',{user:'employee',body:{user_id:'employee',role:'hr'},status:403});
  await call('roles',{body:{user_id:'hr',role:'hr'}});
  await call('templates',{user:'hr',body:template,status:403});
  let t=await call('templates',{body:template});
  await call('templates/'+t.id,{user:'foreign',body:{...t},status:404});
  let cycle=await call('cycles',{user:'hr',body:cycleBody(t.id)});
  assert.deepEqual(await call('cycles',{user:'employee'}),[],'Draft hidden');
  const eligible=await call('cycles/'+cycle.id+'/scope');assert.deepEqual(eligible.map(p=>p.user_id),['employee']);
  cycle=await call('cycles/'+cycle.id+'/launch',{body:{revision:cycle.revision}});
  await call('cycles/'+cycle.id+'/launch',{body:{revision:cycle.revision},status:409});
  t=await call('templates/'+t.id,{body:{...t,name:'Changed later'}});
  let review=(await call('reviews'))[0];const path='reviews/'+review.id;
  const employeeView=await call(path,{user:'employee'});assert.equal(employeeView.cycle.template_snapshot.name,'Annual performance','Snapshot preserved');
  await call(path,{user:'peer1',status:404});await call(path,{user:'foreign',status:404});
  await call(path+'/audit',{user:'employee',status:403});
  await call(path+'/respond',{user:'employee',body:{revision:review.revision,rater_type:'manager',answers:answers(5),submit:true},status:403});
  await call(path+'/respond',{user:'employee',body:{revision:review.revision,rater_type:'self',answers:answers(4.2),submit:true},status:400});
  await call(path+'/respond',{user:'employee',body:{revision:review.revision,rater_type:'self',answers:{},submit:true},status:400});
  review=await call(path+'/peers',{body:{revision:review.revision,peers:['peer1','peer2','peer3']}});
  review=await call(path+'/respond',{user:'employee',body:{revision:review.revision,rater_type:'self',answers:answers(5),achievements:'Delivered goals',submit:true}});assert.equal(review.status,'Manager review');
  await call(path+'/respond',{user:'manager',body:{revision:0,rater_type:'manager',answers:answers(4),summary:'Strong delivery',submit:true},status:409});
  review=await call(path+'/respond',{user:'manager',body:{revision:review.revision,rater_type:'manager',answers:answers(4),summary:'Private manager feedback',submit:true}});assert.equal(review.status,'Peer/360');
  let hidden=await call(path,{user:'employee'});assert.equal(hidden.scores.manager_score,undefined);assert.equal(hidden.scores.final_score,undefined);assert.equal(hidden.manager_summary,undefined);assert.equal(hidden.outcome,null);assert.ok(hidden.responses.every(r=>r.rater_type==='self'));
  assert.equal((await call('reviews',{user:'employee'}))[0].scores.final_score,undefined);
  for(const peer of ['peer1','peer2','peer3']){
    review=await call(path,{user:peer});assert.equal(review.scores,null);assert.equal(review.responses.length,0);
    review=await call(path+'/respond',{user:peer,body:{revision:review.revision,rater_type:'peer',answers:answers(3),submit:true}});
    if(peer!=='peer3')assert.deepEqual((await call(path)).peer_summary,[],'No small-group results');
  }
  review=await call(path);assert.equal(review.status,'Calibration');assert.equal(review.peer_summary.length,3);assert.equal(review.scores.final_score,4);
  const peerAudit=(await call(path+'/audit')).filter(a=>a.action==='peer_submitted');assert.equal(peerAudit.length,3);assert.ok(peerAudit.every(a=>a.actor_id==='Anonymous peer'&&!a.after_data&&!a.before_data));
  review=await call(path+'/calibrate',{user:'hr',body:{revision:review.revision,score:4.6,reason:'Cross-team evidence'}});
  const outcome={increment_percent:12,base_ctc:600000,bonus:10000,effective_date:'2026-11-16',promotion:'Senior Engineer',pip:false,training_plan:'Leadership',comments:'Approved after calibration'};
  review=await call(path+'/finalize',{user:'hr',body:{revision:review.revision,...outcome}});assert.equal(review.outcome.revised_ctc,672000);assert.equal(review.outcome.rating_band,'Outstanding');
  await call(path+'/calibrate',{body:{revision:review.revision,score:1,reason:'Late'},status:409});
  hidden=await call(path,{user:'employee'});assert.equal(hidden.outcome,null);
  cycle=await call('cycles/'+cycle.id+'/publish',{user:'hr',body:{revision:cycle.revision}});
  hidden=await call(path,{user:'employee'});assert.equal(hidden.scores.final_score,4.6);assert.equal(hidden.outcome.revised_ctc,672000);
  await call('cycles/'+cycle.id+'/close',{body:{revision:cycle.revision},status:409});
  await call(path+'/reopen',{body:{revision:hidden.revision,stage:'Self-review',deadline:future(),reason:'Change'},status:409});
  review=await call(path+'/acknowledge',{user:'employee',body:{revision:hidden.revision,comment:'Read'}});
  cycle=await call('cycles/'+cycle.id+'/close',{body:{revision:cycle.revision}});assert.equal(cycle.status,'Closed');
  const changes=sqlite.prepare('SELECT * FROM appraisal_payroll_changes').all();assert.equal(changes.length,1);
  const pay=appraisalPayrollRows(changes,2026,10);assert.deepEqual(pay.map(r=>r.amount),[3000,10000]);assert.deepEqual(appraisalPayrollRows(changes,2026,11).map(r=>r.amount),[6000]);assert.deepEqual(appraisalPayrollRows(changes,2026,9),[]);
  const salary={custom_earnings:[{name:'Transport',amount:100}]};assert.deepEqual(withAppraisalRows(withAppraisalRows(salary,pay),pay),withAppraisalRows(salary,pay));
  const notes=await call('notifications',{user:'employee'});assert.ok(notes.some(n=>n.title.includes('published')));await call('notifications/read',{user:'employee',body:{}});assert.ok((await call('notifications',{user:'employee'})).every(n=>!n.unread));

  // Deadline guard, explicit reopening, concurrent writes and direct-manager changes.
  let c2=await call('cycles',{body:{...cycleBody(t.id),peer_enabled:false,enforce_distribution:true}});c2=await call('cycles/'+c2.id+'/launch',{body:{revision:c2.revision}});
  let r2=(await call('reviews?cycle='+c2.id))[0],p2='reviews/'+r2.id;
  const expired=new Date(Date.now()-3*86400000).toISOString();sqlite.prepare('UPDATE appraisal_reviews SET payload=? WHERE id=?').run(JSON.stringify({reopened:{self:expired}}),r2.id);
  await call(p2+'/respond',{user:'employee',body:{revision:r2.revision,rater_type:'self',answers:answers(4),submit:true},status:409});
  await processAppraisalTimers(db);const count=sqlite.prepare('SELECT count(*) n FROM appraisal_notifications').get().n;await processAppraisalTimers(db);assert.equal(sqlite.prepare('SELECT count(*) n FROM appraisal_notifications').get().n,count,'Timer idempotency');
  r2=await call(p2+'/reopen',{body:{revision:r2.revision,stage:'Self-review',deadline:future(),reason:'Approved extension'}});
  const statuses=await Promise.all([3,4].map(async rating=>(await worker.fetch(new Request('https://test.invalid/api/v1/appraisals/'+p2+'/respond',{method:'POST',headers:{Authorization:'Bearer '+tokens.employee,'Content-Type':'application/json'},body:JSON.stringify({revision:r2.revision,rater_type:'self',answers:answers(rating),submit:true})}),env)).status));assert.deepEqual(statuses.sort(),[200,409]);
  r2=await call(p2);sqlite.prepare('UPDATE employees SET profile=? WHERE user_id=?').run(JSON.stringify({joining_date:'2025-01-01',reports_to_userid:'replacement'}),'employee');
  await call(p2,{user:'manager',status:404});assert.equal((await call('reviews?cycle='+c2.id,{user:'manager'})).length,0);
  await call(p2,{user:'replacement',status:404});
  r2=await call(p2+'/reassign',{body:{revision:r2.revision,manager_id:'replacement',deadline:future(),reason:'Reporting line changed'}});
  beforeBatch=()=>sqlite.prepare('UPDATE employees SET profile=? WHERE user_id=?').run(JSON.stringify({reports_to_userid:'manager'}),'employee');
  await call(p2+'/respond',{user:'replacement',body:{revision:r2.revision,rater_type:'manager',answers:answers(3),summary:'Changed during submission',submit:true},status:409});
  sqlite.prepare('UPDATE employees SET profile=? WHERE user_id=?').run(JSON.stringify({reports_to_userid:'replacement'}),'employee');
  r2=await call(p2+'/respond',{user:'replacement',body:{revision:r2.revision,rater_type:'manager',answers:answers(3),summary:'Reassigned manager review',submit:true}});assert.equal(r2.status,'Calibration');
  await call('roles',{body:{user_id:'employee',role:'hr'}});
  await call(p2+'/calibrate',{user:'employee',body:{revision:r2.revision,score:5,reason:'Own change'},status:403});
  assert.equal((await call('reviews?cycle='+c2.id,{user:'employee'}))[0].scores.final_score,undefined,'HR cannot see own unpublished score');
  r2=await call(p2+'/calibrate',{body:{revision:r2.revision,score:5,reason:'Calibration evidence'}});
  r2=await call(p2+'/finalize',{body:{revision:r2.revision,...outcome}});
  await call('cycles/'+c2.id+'/publish',{body:{revision:c2.revision},status:409});
  r2=await call(p2+'/reopen',{body:{revision:r2.revision,stage:'Calibration',deadline:future(),reason:'Revisit distribution'}});assert.equal(r2.outcome.rating_band,undefined,'Reopening removes the old outcome');
  r2=await call(p2+'/calibrate',{body:{revision:r2.revision,score:3,reason:'Cross-team comparison'}});
  r2=await call(p2+'/finalize',{body:{revision:r2.revision,...outcome,increment_percent:5}});
  c2=await call('cycles/'+c2.id+'/publish',{body:{revision:c2.revision}});assert.equal(c2.status,'Published');
  // Exercise the largest supported cycle with real launch and publish SQL.
  const bulkIds=Array.from({length:500},(_,i)=>'bulk-'+i);
  for(const id of bulkIds){
    sqlite.prepare("INSERT INTO users(user_id,company_id,username,password_hash,role,must_change_password) VALUES(?,'a',?,'test','employee',0)").run(id,id);
    sqlite.prepare("INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,profile) VALUES(?,'a',?,?,?,?)").run('e-'+id,id,id,id,JSON.stringify({reports_to_userid:'manager',joining_date:'2025-01-01'}));
  }
  let bulk=await call('cycles',{body:{...cycleBody(t.id),scope:{departments:[],designations:[],employees:bulkIds,exclude_probation:false,joined_before:''},peer_enabled:false}});
  bulk=await call('cycles/'+bulk.id+'/launch',{body:{revision:bulk.revision}});
  const bulkReviews=sqlite.prepare('SELECT id FROM appraisal_reviews WHERE cycle_id=?').all(bulk.id);assert.equal(bulkReviews.length,500);
  for(const r of bulkReviews){sqlite.prepare("UPDATE appraisal_reviews SET status='Finalize' WHERE id=?").run(r.id);sqlite.prepare("INSERT INTO appraisal_outcomes(company_id,review_id,payload) VALUES('a',?,?)").run(r.id,JSON.stringify({...outcome,rating_band:'Outstanding',revised_ctc:672000}));}
  bulk=await call('cycles/'+bulk.id+'/publish',{body:{revision:bulk.revision}});assert.equal(bulk.status,'Published');assert.equal(sqlite.prepare('SELECT count(*) n FROM appraisal_payroll_changes').get().n,502);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM appraisal_write_checks').get().n,0,'Transaction assertions cleaned up');
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  console.log(`Appraisal tests passed: ${checks} API checks plus scoring, privacy, concurrency, deadlines, timers, reassignment and payroll assertions.`);
}finally{sqlite.close();}
