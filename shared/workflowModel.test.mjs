import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyConfiguration,defaultResponsibilities,resolveRoute,activeApprovers,decide,validateConfiguration } from './workflowModel.mjs';
const people=['employee','manager','hr','backup'].map(id=>({id,name:id,status:'Active',account_status:'active',department:'Engineering',location:'Mumbai'}));
function setup(mode='any') {
 const config=emptyConfiguration();config.nodes=people.map(p=>({id:p.id,position:{x:0,y:0}}));
 config.policies[0].mode=mode;
 config.links=['manager','hr'].map((id,index)=>({id,manager:id,employee:'employee',type:'direct',responsibilities:{...defaultResponsibilities(),leave:{enabled:true,role:'approver',step:index+1,backup:'',unavailable:false,from:'',until:''}}}));return config;
}
test('any, all, and sequential approval semantics',()=>{
 for (const mode of ['any','all','sequential']) {
  const route=resolveRoute(setup(mode),people,{requester:'employee',kind:'leave',days:2});
  assert.equal(activeApprovers(route).length,mode==='sequential'?1:2);
  const first=decide(route,'manager','Approved',new Date().toISOString());
  assert.equal(first.status,mode==='any'?'Approved':'Pending');
  if(mode!=='any')assert.equal(decide(first.route,'hr','Approved',new Date().toISOString()).status,'Approved');
 }
});
test('disabled responsibilities block instead of approving',()=>{
 const config=setup();config.links.forEach(link=>link.responsibilities.leave.enabled=false);
 assert.ok(resolveRoute(config,people,{requester:'employee',kind:'leave',days:2}).blocked);
});
test('effective dates and active backups are respected',()=>{
 const config=setup();config.links[0].responsibilities.leave={...config.links[0].responsibilities.leave,unavailable:true,backup:'backup'};
 config.links[1].responsibilities.leave.from='2030-01-01';
 const route=resolveRoute(config,people,{requester:'employee',kind:'leave',days:2},'2026-09-27T00:00:00Z');
 assert.deepEqual(activeApprovers(route).map(p=>p.userId),['backup']);
 config.links[0].responsibilities.leave.backup='';assert.ok(resolveRoute(config,people,{requester:'employee',kind:'leave',days:2},'2026-09-27T00:00:00Z').blocked);
});
test('longer leave can require HR through a conditional policy',()=>{
 const config=setup('sequential');config.policies[0].maxDays=3;config.policies[0].maxStep=1;
 config.policies.push({...config.policies[0],id:'long',name:'Long leave',minDays:4,maxDays:366,maxStep:2,priority:10});
 assert.equal(resolveRoute(config,people,{requester:'employee',kind:'leave',days:2}).participants.length,1);
 assert.equal(resolveRoute(config,people,{requester:'employee',kind:'leave',days:5}).participants.length,2);
});
test('configuration rejects cross-company IDs, self-approval, cycles, and invalid dates',()=>{
 const config=setup();assert.equal(validateConfiguration(config,people),'');
 const bad=structuredClone(config);bad.links[0].manager='foreign';assert.ok(validateConfiguration(bad,people));
 bad.links[0].manager='employee';assert.ok(validateConfiguration(bad,people));
 const cycle=structuredClone(config);cycle.links.push({...config.links[0],id:'cycle',manager:'employee',employee:'manager'});assert.ok(validateConfiguration(cycle,people));
 config.links[0].responsibilities.leave.from='2026-02-30';assert.ok(validateConfiguration(config,people));
});
test('reviewers and CC cannot approve; duplicate recipients cannot gain duplicate votes',()=>{
 const config=setup();config.links[1].responsibilities.leave.role='cc';
 const route=resolveRoute(config,people,{requester:'employee',kind:'leave',days:2});
 assert.throws(()=>decide(route,'hr','Approved',new Date().toISOString()));
 config.links[0].responsibilities.leave.unavailable=true;config.links[0].responsibilities.leave.backup='hr';
 assert.equal(resolveRoute(config,people,{requester:'employee',kind:'leave',days:2}).participants.length,1);
});
