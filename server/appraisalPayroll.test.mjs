import assert from 'node:assert/strict';
import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { PAYROLL_SCHEMA } from './payrollDatabase.mjs';
import { createPayrollRouter } from './payrollRoutes.mjs';
import { newPayslipTemplate } from '../src/lib/payslipModel.js';
const sqlite=new DatabaseSync(':memory:');
for(const file of readdirSync(new URL('../migrations/hrms/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../migrations/hrms/'+file,import.meta.url),'utf8'));
for(const sql of PAYROLL_SCHEMA)sqlite.exec(sql);
const database={mode:'test',async ready(){},async query(sql,params=[]){const statement=sqlite.prepare(sql);return /^\s*(SELECT|PRAGMA)/i.test(sql)||/\bRETURNING\b/i.test(sql)?statement.all(...params):statement.run(...params);}};
sqlite.exec("INSERT INTO companies(company_id,name) VALUES('a','A'),('b','B'); INSERT INTO users(user_id,company_id,username,password_hash,role) VALUES('employee','a','employee','test','employee'); INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name) VALUES('e-employee','a','employee','EMP','Employee')");
// The workflow suite verifies publication creates these immutable rows. This suite checks their consumption.
sqlite.exec("INSERT INTO appraisal_templates(company_id,id,payload,created_at,updated_at) VALUES('a','template','{}','2026-10-10','2026-10-10'); INSERT INTO appraisal_cycles(company_id,id,name,status,template_id,payload,created_at,updated_at) VALUES('a','cycle','Annual','Published','template','{}','2026-10-10','2026-10-10'); INSERT INTO appraisal_reviews(company_id,id,cycle_id,employee_id,manager_id,status,created_at,updated_at) VALUES('a','review','cycle','employee','employee','Published','2026-10-10','2026-10-10')");
sqlite.prepare("INSERT INTO appraisal_payroll_changes(company_id,review_id,employee_id,effective_date,base_ctc,revised_ctc,bonus,payload,created_at) VALUES('a','review','employee','2026-11-16',600000,672000,10000,'{}','2026-10-10')").run();
const app=express();app.use('/api',createPayrollRouter({database,storage:{configured:false},authorize:async req=>req.headers.authorization==='Bearer own'?{userid:'employee',company_id:'a',admin:false}:{userid:'admin',company_id:req.headers.authorization==='Bearer foreign'?'b':'a',admin:true}}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
async function call(path,body,token='admin',status=200){const response=await fetch(`http://127.0.0.1:${server.address().port}/api`+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;}
try{
  const t=await call('/templates',{...newPayslipTemplate(),name:'Test payroll',company_name:'Company A'});
  await call('/assignments',{userid:'employee',template_id:t.id,auto_generate:false});
  await call('/appraisal-adjustments/employee?year=2026&month=November',null,'own',403);
  await call('/appraisal-adjustments/employee?year=2026&month=November',null,'foreign',400);
  const preview=await call('/appraisal-adjustments/employee?year=2026&month=November');assert.deepEqual(preview.rows.map(r=>r.amount),[3000,10000]);
  await call('/appraisal-adjustments/employee?year=2026&month=Bad',null,'admin',400);
  const input={employee:{userid:'employee',first_name:'Employee'},year:'2026',month:'November',salary_status:'Draft',apply_appraisals:true,salary:{basic:50000,custom_earnings:[{name:'Appraisal increment [review]',amount:99999},{name:'Transport',amount:1000}]}};
  const saved=await call('/salaries',input);assert.equal(saved.salary.monthly_gross,64000);assert.equal(saved.appraisal_applied,true);assert.equal(saved.appraisal_changes.length,1);assert.equal(saved.salary_status,'Draft');
  assert.equal((await call('/salaries',input)).id,saved.id,'Repeated imports are idempotent');
  await call('/salaries',input,'foreign',400);
  const next=await call('/salaries',{...input,month:'December'});assert.equal(next.salary.monthly_gross,57000,'Recurring increment, no repeated bonus');
  console.log('Appraisal payroll API tests passed: tenant ownership, permissions, authoritative amounts, proration, one-time bonus and repeated-save idempotency.');
}finally{await new Promise(resolve=>server.close(resolve));sqlite.close();}
