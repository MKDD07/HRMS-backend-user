import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { documentAssistantHandle } from './documentAssistant.mjs';
const sql=new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE talent_records(company_id TEXT,collection TEXT,id TEXT,payload TEXT,revision INTEGER DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(company_id,collection,id));
CREATE TABLE employees(company_id TEXT,employee_id TEXT,user_id TEXT,employee_code TEXT,first_name TEXT,last_name TEXT,department TEXT,designation TEXT,status TEXT,profile TEXT);
CREATE TABLE users(company_id TEXT,user_id TEXT,status TEXT,email TEXT);
CREATE TABLE documents(company_id TEXT,employee_id TEXT,title TEXT,document_id TEXT,metadata TEXT);
INSERT INTO employees VALUES('company','employee','user','EMP1','Laura','Prestin','Fitness','Trainer','Active','{}');
INSERT INTO users VALUES('company','user','active','laura@example.org');
INSERT INTO documents VALUES('company','employee','Passport','doc','{"category":"ID Proof","verified":true}');`);
const db={prepare:query=>({bind:(...args)=>({first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>sql.prepare(query).run(...args)})})};
const base={db,env:{},actor:{role:'company_admin',company_id:'company',user_id:'admin'},path:'/api/v1/documents/assistant/settings',method:'POST',body:{requiredCategories:['ID Proof','Tax Form'],branding:{company_name:'Example',company_address:'Office',signatory:'HR Manager',signatory_role:'HR'}}};
test('settings create persisted checklist and actionable HR notifications using the existing schema',async()=>{
  await documentAssistantHandle(base);
  const check=await documentAssistantHandle({...base,path:'/api/v1/documents/assistant/help',body:{prompt:'Which documents are missing for Laura Prestin?'}});
  assert.match(check.text,/Tax Form/);assert.equal(check.location.userid,'user');
  const alerts=await documentAssistantHandle({...base,path:'/api/v1/documents/assistant/alerts',method:'GET'});
  assert.equal(alerts.length,1);assert.equal(alerts[0].unread,true);assert.equal(alerts[0].location.userid,'user');
  await documentAssistantHandle({...base,path:'/api/v1/documents/assistant/alerts/read',body:{id:alerts[0].id}});
  assert.equal((await documentAssistantHandle({...base,path:'/api/v1/documents/assistant/alerts',method:'GET'}))[0].unread,false);
});
test('document assistant rejects unauthorized and cross-company employee selection',async()=>{
  await assert.rejects(documentAssistantHandle({...base,actor:{...base.actor,role:'employee'}}),err=>err.status===403);
  const result=await documentAssistantHandle({...base,actor:{...base.actor,company_id:'different'},path:'/api/v1/documents/assistant/help',body:{userid:'user',prompt:'Check missing documents'}});
  assert.match(result.text,/Select an employee/);
});
