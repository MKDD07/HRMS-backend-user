import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentHandle } from './documents.mjs';
const doc = { document_id: 'doc', company_id: 'company', employee_id: null, metadata: '{"draft":true,"origin":"ai"}', title: 'Letter', size_bytes: 100 };
function database(record = doc) {
  return { prepare(sql) { return { bind(...params) {
    return { first: async () => record, run: async () => { assert.equal(params.at(-2), 'company'); assert.equal(params.at(-1), 'doc'); } };
  } }; } };
}
const base = { env: {}, db: database(), actor: { role: 'company_admin', company_id: 'company', user_id: 'admin' }, path: '/api/v1/documents/doc/approve', method: 'POST', url: new URL('https://example.org/api/v1/documents/doc/approve'), request: new Request('https://example.org', { method: 'POST' }) };
test('employees cannot access or approve company drafts', async () => {
  await assert.rejects(documentHandle({ ...base, actor: { ...base.actor, role: 'employee' } }), error => error.status === 404);
});
test('approval rejects personnel documents and missing records', async () => {
  await assert.rejects(documentHandle({ ...base, db: database({ ...doc, employee_id: 'employee' }) }), error => error.status === 400);
  await assert.rejects(documentHandle({ ...base, db: database(null) }), error => error.status === 404);
});
test('approval and deletion bind the company and document together', async () => {
  await documentHandle(base);
  assert.deepEqual(await documentHandle({ ...base, path: '/api/v1/documents/doc', method: 'DELETE' }), { archived: true });
});
test('editing an approved policy returns it to drafts and preserves its origin', async () => {
  let savedMetadata;
  const record = { ...doc, metadata: '{"draft":false,"origin":"ai","approved_by":"admin"}' };
  const db = { prepare: () => ({ bind: (...params) => ({ first: async () => record, run: async () => { savedMetadata = JSON.parse(params[1]); } }) }) };
  await documentHandle({ ...base, db, path: '/api/v1/documents/doc', method: 'PATCH', request: new Request('https://example.org', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Updated policy', description: 'Updated wording' }) }) });
  assert.equal(savedMetadata.draft, true);
  assert.equal(savedMetadata.review_status, 'draft');
  assert.equal(savedMetadata.origin, 'ai');
  assert.equal(savedMetadata.approved_by, null);
});

test('company-issued employee drafts require approval and stay private to HR', async()=>{
 const shared={...doc,employee_id:'employee-1',metadata:'{"draft":true,"delivery":"company","origin":"ai"}'};
 await documentHandle({...base,db:database(shared)});
 await assert.rejects(documentHandle({...base,db:database(shared),path:'/api/v1/documents/doc/download',method:'GET',actor:{...base.actor,role:'employee',employee_id:'employee-1'}}),error=>error.status===404);
});
test('approved personal company letters cannot be downloaded by another employee',async()=>{
 const shared={...doc,employee_id:'employee-1',metadata:'{"draft":false,"delivery":"company"}'};
 await assert.rejects(documentHandle({...base,db:database(shared),path:'/api/v1/documents/doc/download',method:'GET',actor:{...base.actor,role:'employee',employee_id:'employee-2'}}),error=>error.status===404);
});
