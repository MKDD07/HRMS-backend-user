import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { workflowHandle, createWorkflow, processWorkflowTimers, reviewWorkflow } from './workflows.mjs';
import { emptyConfiguration } from '../shared/workflowModel.mjs';

test('department lifecycle and leave backup persist with tenant checks, notifications and audit',async()=>{
  const sql=new DatabaseSync(':memory:');
  try {
    for(const file of readdirSync(new URL('../migrations/hrms/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort()) sql.exec(readFileSync(new URL('../migrations/hrms/'+file,import.meta.url),'utf8'));
    function prepare(query,values=[]) {return {bind:(...args)=>prepare(query,args),async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return sql.prepare(query).run(...values);}};}
    const db={prepare,async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};
    sql.exec("INSERT INTO companies(company_id,name) VALUES('a','A'),('b','B')");
    for(const id of ['employee','head','backup']) {
      sql.prepare("INSERT INTO users(user_id,company_id,username,email,password_hash,role) VALUES(?,'a',?,?, 'test','employee')").run(id,id,id+'@example.com');
      sql.prepare("INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,department) VALUES(?,'a',?,?,?,'Engineering')").run(id,id,id,id);
    }
    const config={...emptyConfiguration(),departments:[{name:'Engineering',head:'head',targets:'',responsibilities:'',approvals:{attendance:{enabled:true,primary:'',backup:'backup',unavailable:false}}},{name:'Empty',head:'',targets:'',responsibilities:''}]};
    sql.prepare("INSERT INTO workflow_configuration(company_id,payload,revision,updated_at) VALUES('a',?,1,?)").run(JSON.stringify(config),new Date().toISOString());
    const actor={company_id:'a',user_id:'employee',role:'company_admin'};
    const call=(name,action,revision,who=actor)=>workflowHandle({db,actor:who,path:'/api/v1/workflows/department-lifecycle',method:'POST',body:{name,action,revision}});
    await assert.rejects(call('Engineering','delete',1),/Move all/);
    sql.exec("UPDATE users SET status='disabled' WHERE company_id='a'");
    await assert.rejects(call('Engineering','delete',1),/Move all/);
    sql.exec("UPDATE users SET status='active' WHERE company_id='a'");
    await assert.rejects(call('Empty','archive',1,{...actor,role:'employee'}),/administrator/);
    await assert.rejects(call('Empty','archive',1,{...actor,company_id:'b'}),/changed/);
    const archived=await call('Empty','archive',1);
    assert.equal(archived.configuration.departments.find(row=>row.name==='Empty').archived,true);
    await assert.rejects(call('Empty','restore',1),/changed/);
    const restored=await call('Empty','restore',2);
    assert.equal(restored.configuration.departments.find(row=>row.name==='Empty').archived,false);
    await call('Empty','delete',3);
    const created=await createWorkflow(db,actor,{kind:'attendance',payload:{reason:'Correct clock',date:'2026-11-16',check_in:'09:00',check_out:'18:00',timezone:'+05:30'}});
    assert.equal(created.status,'Pending');
    const request=()=>sql.prepare('SELECT * FROM workflow_requests WHERE request_id=?').get(created.request_id);
    assert.equal(JSON.parse(request().route).participants[0].userId,'head');
    sql.prepare("INSERT INTO leave_requests(leave_id,company_id,employee_id,leave_type,start_date,end_date,reason,status) VALUES('absent','a','head','Casual Leave','2020-01-01','2099-01-01','Leave','Approved')").run();
    await processWorkflowTimers(db,new Date().toISOString());
    assert.equal(JSON.parse(request().route).participants[0].userId,'backup');
    assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM workflow_audit WHERE request_id=? AND action='backup-activated'").get(created.request_id).n,1);
    assert.ok(sql.prepare("SELECT COUNT(*) AS n FROM workflow_notifications WHERE request_id=? AND recipient_id='backup'").get(created.request_id).n>0);
    await processWorkflowTimers(db,new Date().toISOString());
    assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM workflow_audit WHERE request_id=? AND action='backup-activated'").get(created.request_id).n,1);
    await assert.rejects(reviewWorkflow(db,{...actor,user_id:'head'},created.request_id,'Approved'),/unavailable/);
    await reviewWorkflow(db,{...actor,user_id:'backup'},created.request_id,'Approved');
    assert.equal(request().status,'Approved');
    const next=await createWorkflow(db,actor,{kind:'attendance',payload:{reason:'Correct again',date:'2026-11-17',check_in:'09:00',check_out:'18:00',timezone:'+05:30'}});
    assert.equal(JSON.parse(sql.prepare('SELECT route FROM workflow_requests WHERE request_id=?').get(next.request_id).route).participants[0].userId,'backup');
  } finally {sql.close();}
});
