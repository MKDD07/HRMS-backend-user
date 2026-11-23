import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { PolicyGenerationRunner } from './policyGenerationRunner.mjs';
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE talent_records(company_id TEXT,collection TEXT,id TEXT,payload TEXT,revision INTEGER DEFAULT 0,created_at TEXT,updated_at TEXT,PRIMARY KEY(company_id,collection,id));CREATE TABLE companies(company_id TEXT,status TEXT);CREATE TABLE users(company_id TEXT,user_id TEXT,role TEXT,status TEXT);CREATE TABLE employees(company_id TEXT,user_id TEXT,dashboard_access INTEGER,dashboard_pages TEXT);CREATE TABLE documents(document_id TEXT PRIMARY KEY,company_id TEXT,employee_id TEXT,title TEXT,object_key TEXT,content_type TEXT,size_bytes INTEGER,uploaded_by TEXT,metadata TEXT);INSERT INTO companies VALUES('a','active');INSERT INTO users VALUES('a','hr','company_admin','active');`);
 const job={id:'job',profile:{legal_name:'Example Ltd',registered_address:'Example address'},departments:[],items:[{id:'1',title:'Conduct',category:'People',purpose:'Shared expectations',sections:[],status:'planned',savedId:null}]};sql.prepare('INSERT INTO talent_records VALUES(?,?,?,?,0,?,?)').run('a','company_policy_job','a:company_policy_job',JSON.stringify(job),'now','now');
 const DB={prepare:q=>({bind:(...args)=>({first:async()=>sql.prepare(q).get(...args)||null,all:async()=>({results:sql.prepare(q).all(...args)}),run:async()=>sql.prepare(q).run(...args)})})};
 let value,alarm=null,uploads=0;const storage={get:async()=>structuredClone(value),put:async(_k,v)=>{value=structuredClone(v);},setAlarm:async v=>{alarm=v;},getAlarm:async()=>alarm,deleteAlarm:async()=>{alarm=null;}};
 const ctx={storage,blockConcurrencyWhile:fn=>fn()},env={DB,GROQ_API_KEY:'test-only',AI_RATE_LIMITER:{limit:async()=>({success:true})},HRMS_DOCUMENTS:{put:async(_key,bytes)=>{assert.ok(bytes.length>100);uploads++;}}};
 const request=action=>new Request('https://internal',{method:'POST',body:JSON.stringify({actor:{company_id:'a',user_id:'hr',role:'company_admin'},jobId:'job',action})});
 return {sql,ctx,env,request,job:()=>JSON.parse(sql.prepare('SELECT payload FROM talent_records').get().payload),uploads:()=>uploads,alarm:()=>alarm};
}
test('server alarms finish and export a draft across runner restarts without a browser',async()=>{
 const f=fixture(),original=globalThis.fetch;globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({title:'Conduct',text:'Employees should follow shared expectations and contact HR for guidance.',letter_type:'company-policy'})}}]});
 try{await new PolicyGenerationRunner(f.ctx,f.env).fetch(f.request('start'));assert.equal(f.job().runState,'queued');for(let step=0;step<5;step++)await new PolicyGenerationRunner(f.ctx,f.env).alarm();assert.equal(f.job().runState,'complete');assert.equal(f.job().items[0].savedId,'policy-job-1');assert.equal(f.uploads(),1);assert.equal(f.alarm(),null);await new PolicyGenerationRunner(f.ctx,f.env).alarm();assert.equal(f.uploads(),1);}finally{globalThis.fetch=original;}
});
test('pause prevents subsequent work and revoked access stops a queued job',async()=>{
 const f=fixture(),runner=new PolicyGenerationRunner(f.ctx,f.env);await runner.fetch(f.request('start'));await runner.fetch(f.request('pause'));await runner.alarm();assert.equal(f.job().runState,'paused');assert.equal(f.job().items[0].sections.length,0);await runner.fetch(f.request('start'));f.sql.exec("UPDATE users SET status='inactive'");await runner.alarm();assert.equal(f.job().runState,'failed');assert.equal(f.alarm(),null);
});
test('provider rate limits checkpoint a retry rather than abandoning the job',async()=>{
 const f=fixture(),original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:{message:'Rate limited'}},{status:429});try{const runner=new PolicyGenerationRunner(f.ctx,f.env);await runner.fetch(f.request('start'));await runner.alarm();assert.equal(f.job().runState,'waiting');assert.ok(f.alarm()>Date.now()+60000);assert.equal(f.job().items[0].sections.length,0);}finally{globalThis.fetch=original;}
});
