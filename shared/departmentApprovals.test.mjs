import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyConfiguration, resolveRoute, transferUnavailableApprovers, validateConfiguration } from './workflowModel.mjs';
import { changeDepartmentLifecycle } from './departmentLifecycle.mjs';
const people = ['employee','head','backup'].map(id=>({id,name:id,department:'Engineering',status:'Active',account_status:'active'}));
const configuration = () => ({...emptyConfiguration(),departments:[{name:'Engineering',head:'head',targets:'',responsibilities:'',approvals:{leave:{enabled:true,primary:'',backup:'backup',unavailable:false}}}]});
const input = {requester:'employee',kind:'leave',days:1};
const day = '2026-11-16T10:00:00Z';

test('department head and one backup work without graph or reporting links',()=>{
  const config=configuration();
  assert.equal(validateConfiguration(config,people),'');
  const route=resolveRoute(config,people,input,day);
  assert.equal(route.participants.length,1);
  assert.equal(route.participants[0].userId,'head');
  const absent=people.map(person=>person.id==='head'?{...person,approvedLeave:[{from:'2026-11-16',until:'2026-11-18'}]}:person);
  const delegated=resolveRoute(config,absent,input,day);
  assert.equal(delegated.participants[0].userId,'backup');
  assert.equal(delegated.participants[0].delegated,true);
  assert.equal(resolveRoute(config, absent, input, '2026-11-15T18:30:00Z').participants[0].userId, 'backup', 'Coverage starts at midnight in India');
  assert.equal(resolveRoute(config, absent, input, '2026-11-18T18:30:00Z').participants[0].userId, 'head', 'New requests return to the primary at the end of leave');
  assert.equal(resolveRoute(config,people,{...input,requester:'head'},day).participants[0].userId,'backup');
  const both=absent.map(person=>({...person,approvedLeave:[{from:'2026-11-16',until:'2026-11-18'}]}));
  assert.ok(resolveRoute(config,both,input,day).blocked);
  config.departments[0].approvals.leave.backup='head';
  assert.match(validateConfiguration(config,people),/different active backup/);
  config.departments[0].approvals.leave.backup='outside-company';
  assert.match(validateConfiguration(config,people),/different active backup/);
});

test('pending work transfers once, preserves decisions, and never picks a third person or requester',()=>{
  const config=configuration(),route=resolveRoute(config,people,input,day);
  const absent=people.map(person=>person.id==='head'?{...person,approvedLeave:[{from:'2026-11-16',until:'2026-11-18'}]}:person);
  const next=transferUnavailableApprovers(route,absent,config,'employee',day);
  assert.equal(next.participants[0].userId,'backup');
  assert.equal(route.participants[0].userId,'head');
  assert.equal(transferUnavailableApprovers(next,absent,config,'employee',day),null);
  assert.equal(transferUnavailableApprovers(route,absent,config,'backup',day),null);
  route.participants[0].decision='Approved';
  assert.equal(transferUnavailableApprovers(route,absent,config,'employee',day),null);
  const pending=resolveRoute(config,people,input,day);
  config.departments[0].approvals.leave.unavailable=true;
  assert.equal(transferUnavailableApprovers(pending,people,config,'employee',day).participants[0].userId,'backup');
});

test('archive and restore preserve settings; deletion needs an empty department and removes scoped policies',()=>{
  const config=configuration();
  const archived=changeDepartmentLifecycle(config,'Engineering','archive',people);
  assert.equal(archived.departments[0].archived,true);
  assert.deepEqual(archived.departments[0].approvals,config.departments[0].approvals);
  assert.equal(changeDepartmentLifecycle(archived,'Engineering','restore',people).departments[0].archived,false);
  assert.throws(()=>changeDepartmentLifecycle(config,'Engineering','delete',people),/Move all/);
  assert.throws(()=>changeDepartmentLifecycle({...config,departments:[{...config.departments[0],temporaryMembers:['backup']}]},'Engineering','delete',[]),/Move all/);
  assert.throws(()=>changeDepartmentLifecycle(config,'General','delete',people),/cannot be removed/);
  config.policies.push({...config.policies[0],id:'scoped',department:'Engineering'});
  const deleted=changeDepartmentLifecycle(config,'Engineering','delete',[]);
  assert.equal(deleted.departments.length,0);
  assert.ok(!deleted.policies.some(policy=>policy.id==='scoped'));
});
