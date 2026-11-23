import test from 'node:test';
import assert from 'node:assert/strict';
import { departmentLeadershipLinks, applyDepartmentLeadership } from './departmentHierarchy.mjs';
const members = ['a', 'b', 'c', 'd'].map(id => ({ id }));
test('manager leads team leader, who leads remaining members', () => {
  const links = departmentLeadershipLinks({ name: 'Sales', memberRoles: { a: 'Manager', b: 'Team leader', c: 'Mentor' } }, members);
  assert.deepEqual(links.map(link => [link.manager, link.employee]), [['a', 'b'], ['b', 'c'], ['b', 'd']]);
  assert.equal(new Set(links.map(link => link.id)).size, 3);
});
test('manager reassignment and role disabling rebuild the hierarchy', () => {
  assert.deepEqual(departmentLeadershipLinks({ name: 'Sales', memberRoles: { d: 'Manager' } }, members).map(link => [link.manager, link.employee]), [['d', 'a'], ['d', 'b'], ['d', 'c']]);
  assert.equal(departmentLeadershipLinks({ name: 'Sales', memberRoles: {} }, members).length, 0);
  assert.equal(departmentLeadershipLinks({ name: 'General', memberRoles: { a: 'Manager' } }, members).length, 0);
  assert.equal(departmentLeadershipLinks({ name: 'Sales', memberRoles: { foreign: 'Manager' } }, members).length, 0);
});

test('saving leaders publishes reporting links and preserves unrelated settings and unchanged responsibilities',()=>{
  const people=['a','b','c'].map(id=>({id,department:'Sales'}));
  const config={nodes:[],links:[{id:'old',manager:'a',employee:'b',type:'direct',responsibilities:{leave:{enabled:true}}},{id:'outside',manager:'outside',employee:'c',type:'indirect'}],policies:[],departments:[]};
  const updated=applyDepartmentLeadership(config,{name:'Sales',head:'b',memberRoles:{a:'Manager',b:'Team leader'}},people);
  assert.deepEqual(updated.links.filter(link=>link.type==='direct').map(link=>[link.manager,link.employee]),[['a','b'],['b','c']]);
  assert.equal(updated.links.find(link=>link.employee==='b').responsibilities.leave.enabled,true);
  assert.ok(updated.links.some(link=>link.id==='outside'));
  assert.equal(updated.nodes.length,3);
  const changed=applyDepartmentLeadership(updated,{name:'Sales',head:'a',memberRoles:{c:'Manager',a:'Team leader'}},people);
  assert.deepEqual(changed.links.filter(link=>link.type==='direct').map(link=>[link.manager,link.employee]),[['c','a'],['a','b']]);
  assert.equal(changed.nodes.length,3);
});
