import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLink, visiblePeople, reconcileMatrix, placeDepartment } from './reportingMatrix.js';

test('adding departments preserves roles and settings and gives groups separate positions', () => {
  const record = { name: 'Engineering', head: 'lead', targets: 'Ship', responsibilities: 'Build', themeIndex: 4, memberRoles: { lead: 'Team leader' }, customRoles: ['Reviewer'], members: [{ id: 'lead' }, { id: 'new' }] };
  const original = { nodes: [{ id: 'lead', position: { x: 12, y: 15 } }], links: [link('lead','new')], departments: [record] };
  const next = placeDepartment(original, record);
  assert.equal(next.nodes.length, 2);
  assert.deepEqual(next.nodes[0].position, original.nodes[0].position);
  assert.equal(next.links, original.links);
  assert.deepEqual(next.departments[0].memberRoles, record.memberRoles);
  assert.deepEqual(next.departments[0].customRoles, ['Reviewer']);
  assert.equal(next.departments[0].themeIndex, 4);
  assert.equal('members' in next.departments[0], false);
  const second = placeDepartment(next, { name: 'Finance', head: '', targets: '', responsibilities: '', members: [] });
  assert.notDeepEqual(second.departmentChart[0].position, second.departmentChart[1].position);
});

test('expansion adds new department members and repositions them without losing reporting links', () => {
  const record = { name: 'Engineering', head: 'lead', targets: '', responsibilities: '', members: [{ id: 'lead' }, { id: 'new' }] };
  const original = { nodes: [{ id: 'lead', position: { x: 0, y: 0 } }], links: [], departmentChart: [{ name: record.name, position: { x: 100, y: 20 }, expanded: false }] };
  const expanded = placeDepartment(original, record, undefined, true);
  assert.equal(expanded.nodes.length, 2);
  assert.equal(expanded.departmentChart[0].expanded, true);
  assert.notDeepEqual(expanded.nodes[0].position, expanded.nodes[1].position);
  const collapsed = placeDepartment(expanded, record, undefined, false);
  assert.deepEqual(collapsed.nodes, expanded.nodes);
  const moved = placeDepartment(expanded, record, { x: 500, y: 100 });
  assert.equal(moved.departmentChart[0].expanded, true);
  assert.equal(moved.departmentChart.length, 1);
});

test('adding an expanded department preserves other teams and avoids their occupied positions', () => {
  const old = { nodes: [{ id: 'old', position: { x: 900, y: 200 } }], links: [], departmentChart: [{ name: 'Existing', position: { x: 600, y: 0 }, expanded: true }] };
  const team = { name: 'New', head: '', targets: '', responsibilities: '', members: [{ id: 'new' }, { id: 'new2' }] };
  const next = placeDepartment(old, team, undefined, true);
  assert.deepEqual(next.departmentChart[0], old.departmentChart[0]);
  assert.deepEqual(next.nodes[0], old.nodes[0]);
  assert.equal(next.departmentChart[1].expanded, true);
  for (const node of next.nodes.filter(node => node.id !== 'old')) assert.ok(node.position.x > 1200);
  assert.equal(new Set(next.nodes.map(node => node.id)).size, 3);
});
const link = (manager, employee, type = 'direct') => ({ id: `${manager}-${employee}`, manager, employee, type });
test('reject self, duplicates and direct cycles; allow indirect collaboration and edits', () => {
 const links = [link('a','b'), link('b','c','indirect')];
 assert.ok(validateLink(links, link('a','a')));
 assert.ok(validateLink(links, link('a','b','indirect')));
 assert.equal(validateLink(links, link('c','a')), '');
 assert.ok(validateLink([link('a','b'),link('b','c')],link('c','a')));
 assert.equal(validateLink([link('a','b')],link('b','a','indirect')), '');
 assert.equal(validateLink(links, link('a','b','indirect'), 'a-b'), '');
});
test('focused traversal stops at six steps above and below, including indirect links', () => {
 const nodes = Array.from({length: 17}, (_, i) => ({ id: String(i) }));
 const links = nodes.slice(1).map((node,i) => link(String(i),node.id,i % 2 ? 'indirect' : 'direct'));
 const visible = visiblePeople(nodes, links, '8', 99);
 assert.equal(visible.size, 13); assert.ok(visible.has('2')); assert.ok(visible.has('14')); assert.ok(!visible.has('1')); assert.ok(!visible.has('15'));
});
test('empty data stays empty and records outside the live directory are excluded', () => {
 assert.deepEqual(reconcileMatrix(undefined, [{id:'a'}]), {nodes:[],links:[]});
 assert.deepEqual(reconcileMatrix({nodes:[{id:'a'},{id:'fake'}], links:[link('a','fake')]},[{id:'a'}]), {nodes:[{id:'a'}], links:[]});
});
