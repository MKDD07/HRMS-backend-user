import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLink, visiblePeople, reconcileMatrix } from './reportingMatrix.js';
const link = (manager, employee, type = 'direct') => ({ id: `${manager}-${employee}`, manager, employee, type });
test('reject self, duplicate, and mixed-type cycles; allow edits', () => {
 const links = [link('a','b'), link('b','c','indirect')];
 assert.ok(validateLink(links, link('a','a')));
 assert.ok(validateLink(links, link('a','b','indirect')));
 assert.ok(validateLink(links, link('c','a')));
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
