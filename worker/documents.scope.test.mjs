import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { documentHandle } from './documents.mjs';
const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE employees(company_id TEXT,employee_id TEXT,user_id TEXT,department TEXT);CREATE TABLE users(company_id TEXT,user_id TEXT,username TEXT);CREATE TABLE documents(company_id TEXT,document_id TEXT,employee_id TEXT,uploaded_by TEXT,title TEXT,size_bytes INTEGER,created_at TEXT,metadata TEXT);INSERT INTO employees VALUES('a','employee','user','Fitness');INSERT INTO documents VALUES('a','fitness',NULL,'hr','Fitness policy',100,'2026-10-11','{"draft":false,"applicable_departments":["Fitness"]}'),('a','management',NULL,'hr','Management policy',100,'2026-10-11','{"draft":false,"applicable_departments":["Management"]}'),('a','all',NULL,'hr','All policy',100,'2026-10-11','{"draft":false}');`);
const db={prepare:query=>({bind:(...args)=>({first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)})})})};
const base={db,env:{},actor:{company_id:'a',role:'employee',employee_id:'employee'},path:'/api/v1/documents',method:'GET',url:new URL('https://example.org/api/v1/documents?scope=policies'),request:new Request('https://example.org')};
test('employee library excludes other departments while HR sees all',async()=>{assert.deepEqual((await documentHandle(base)).map(doc=>doc.id).sort(),['all','fitness']);assert.equal((await documentHandle({...base,actor:{...base.actor,role:'company_admin'}})).length,3);});
test('direct downloads cannot bypass department applicability',async()=>{await assert.rejects(documentHandle({...base,path:'/api/v1/documents/management/download'}),error=>error.status===404);});
