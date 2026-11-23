import { BANDS, bandFor, validateTemplate, weightedScore, distributionTargets, inScope, isDate, isInstant, stageDeadline } from '../shared/appraisalModel.mjs';
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const stmt = (db,sql,params=[]) => db.prepare(sql).bind(...params);
const rows = async (db,sql,params=[]) => (await stmt(db,sql,params).all()).results;
const now = () => new Date().toISOString();
const json = JSON.stringify;
const parse = value => value ? JSON.parse(value) : {};
const admin = actor => (actor.original_role || actor.role)==='company_admin';
const clean = (value,label,max=5000,required=false) => {
  if (typeof value!=='string' || value.length>max || required && !value.trim()) fail(`${label} ${required?'is required and ':''}must be text of at most ${max} characters.`);
  return value.trim();
};
const unpack = row => row && ({...parse(row.payload),...Object.fromEntries(Object.entries(row).filter(([key])=>key!=='payload'))});
async function privileges(db,actor) { return {admin:admin(actor),hr:admin(actor)||!!await stmt(db,"SELECT 1 FROM appraisal_roles WHERE company_id=? AND user_id=? AND role='hr'",[actor.company_id,actor.user_id]).first()}; }
const needHR = permissions => { if(!permissions.hr) fail('HR or company administrator access required.',403); };
const needAdmin = permissions => { if(!permissions.admin) fail('Only company administrators configure templates and HR access.',403); };
const requireRevision = (record,body) => { if(!Number.isInteger(body.revision)||body.revision!==record.revision) fail('This record changed. Refresh before saving.',409); };
function audit(db,actor,type,id,action,before,after) { return stmt(db,'INSERT INTO appraisal_audit(id,company_id,entity_type,entity_id,actor_id,action,before_data,after_data,created_at) VALUES(?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),actor.company_id,type,id,actor.user_id,action,before?json(before):null,after?json(after):null,now()]); }
function notify(db,company,recipient,review,title,event) { return stmt(db,'INSERT OR IGNORE INTO appraisal_notifications(id,company_id,recipient_id,review_id,title,event_key,created_at) VALUES(?,?,?,?,?,?,?)',[crypto.randomUUID(),company,recipient,review,title,event,now()]); }
async function commit(db,checks,statements) {
  const id=crypto.randomUUID(), sql=checks.map(c=>`EXISTS(${c.sql})`).join(' AND ')||'1';
  try { await db.batch([stmt(db,`INSERT INTO appraisal_write_checks(id,valid) VALUES(?,CASE WHEN ${sql} THEN 1 ELSE 0 END)`,[id,...checks.flatMap(c=>c.params)]),...statements,stmt(db,'DELETE FROM appraisal_write_checks WHERE id=?',[id])]); }
  catch(error) { if(/CHECK constraint|UNIQUE constraint/.test(error.message)) fail('The record or stage changed. Refresh before trying again.',409); throw error; }
}
const versionCheck = (table,company,record) => ({sql:`SELECT 1 FROM ${table} WHERE company_id=? AND id=? AND revision=?`,params:[company,record.id,record.revision]});
async function directory(db,company) {
  const people=await rows(db,"SELECT e.user_id,e.first_name,e.last_name,e.department,e.designation,e.status,e.profile,u.username FROM employees e JOIN users u ON u.user_id=e.user_id AND u.company_id=e.company_id WHERE e.company_id=? AND u.status='active' ORDER BY e.first_name,e.user_id",[company]);
  const configuration=await stmt(db,'SELECT payload FROM workflow_configuration WHERE company_id=?',[company]).first();
  const links=parse(configuration?.payload).links||[];
  return people.map(p=>{const profile=parse(p.profile),managers=[...new Set(links.filter(l=>l.employee===p.user_id&&l.type==='direct').map(l=>l.manager))];return {user_id:p.user_id,name:[p.first_name,p.last_name].filter(Boolean).join(' ')||p.username,department:p.department,designation:p.designation,status:p.status,joining_date:profile.joining_date||profile.date_of_joining||'',manager_id:managers.length===1?managers[0]:managers.length?'':profile.reports_to_userid||'',manager_ambiguous:managers.length>1};});
}
// Recheck reporting authority inside the same transaction as rating writes.
const managerCheck = (company,employee,manager) => ({sql:`SELECT 1 FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND e.user_id=? AND u.status='active' AND e.status<>'Inactive' AND (SELECT CASE WHEN count(DISTINCT json_extract(l.value,'$.manager'))=0 THEN json_extract(e.profile,'$.reports_to_userid') WHEN count(DISTINCT json_extract(l.value,'$.manager'))=1 THEN min(json_extract(l.value,'$.manager')) ELSE '' END FROM json_each(COALESCE((SELECT payload FROM workflow_configuration WHERE company_id=e.company_id),'{}'),'$.links') l WHERE json_extract(l.value,'$.employee')=e.user_id AND json_extract(l.value,'$.type')='direct')=?`,params:[company,employee,manager]});
const cycleGet = async(db,company,id)=>unpack(await stmt(db,'SELECT * FROM appraisal_cycles WHERE company_id=? AND id=?',[company,id]).first());
const reviewGet = async(db,company,id)=>unpack(await stmt(db,'SELECT * FROM appraisal_reviews WHERE company_id=? AND id=?',[company,id]).first());
const templateGet = async(db,company,id)=>unpack(await stmt(db,'SELECT * FROM appraisal_templates WHERE company_id=? AND id=?',[company,id]).first());
const reviewPayload = record => Object.fromEntries(Object.entries(record).filter(([k])=>!['company_id','id','cycle_id','employee_id','manager_id','status','revision','created_at','updated_at'].includes(k)));
function updateReview(db,company,record,changes={}) {
  const next={...record,...changes};
  return stmt(db,'UPDATE appraisal_reviews SET manager_id=?,status=?,payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND id=?',[next.manager_id,next.status,json(reviewPayload(next)),now(),company,record.id]);
}
function deadlineFor(cycle,review,stage=review.status) { const key=stageDeadline(stage);return review.reopened?.[key]||cycle.deadlines?.[key]; }
function unlocked(cycle,review,stage=review.status) {
  if(cycle.status!=='Launched') fail('This cycle is not open for review changes.',409);
  const deadline=deadlineFor(cycle,review,stage);
  if(!deadline || Date.parse(deadline)<Date.now()) fail('This stage is locked after its deadline. HR must reopen it.',409);
}
const safeTemplate = template => ({name:template.name,rating_scale:5,sections:template.sections});
function safeAudit(row) {
  if(row.action.startsWith('peer'))return {...row,actor_id:'Anonymous peer',created_at:row.created_at.slice(0,10),before_data:null,after_data:null};
  if(['stage_reopened','manager_reassigned'].includes(row.action)){const before=parse(row.before_data);return {...row,before_data:json({...before,responses:(before.responses||[]).filter(r=>r.rater_type!=='peer')})};}
  return row;
}
async function reviewAccess(db,actor,permissions,review,people) {
  const own=review.employee_id===actor.user_id,person=people.find(p=>p.user_id===review.employee_id);
  const manager=review.manager_id===actor.user_id && person?.manager_id===actor.user_id;
  const peer=!!await stmt(db,'SELECT 1 FROM appraisal_peer_assignments WHERE company_id=? AND review_id=? AND user_id=?',[actor.company_id,review.id,actor.user_id]).first();
  const hr=permissions.hr&&!own;
  if(!own&&!manager&&!peer&&!hr) fail('Review not found.',404);
  return {own,manager,peer,hr};
}
async function detail(db,actor,permissions,review,people) {
  const access=await reviewAccess(db,actor,permissions,review,people),cycle=await cycleGet(db,actor.company_id,review.cycle_id);
  const published=['Published','Closed'].includes(review.status),canSee=access.hr||access.manager||access.own&&published;
  const responseRows=await rows(db,'SELECT question_id,rater_id,rater_type,rating,comment FROM appraisal_responses WHERE company_id=? AND review_id=?',[actor.company_id,review.id]);
  const responses=responseRows.filter(r=>r.rater_type==='self'&&(access.own||access.manager||access.hr)||r.rater_type==='manager'&&canSee||r.rater_type==='peer'&&r.rater_id===actor.user_id).map(({rater_id,...r})=>r);
  const score=await stmt(db,'SELECT self_score,manager_score,final_score,calibration_reason FROM appraisal_scores WHERE company_id=? AND review_id=?',[actor.company_id,review.id]).first()||{};
  const outcome=canSee?parse((await stmt(db,'SELECT payload FROM appraisal_outcomes WHERE company_id=? AND review_id=?',[actor.company_id,review.id]).first())?.payload):null;
  const peers=await rows(db,'SELECT user_id,submitted_at FROM appraisal_peer_assignments WHERE company_id=? AND review_id=?',[actor.company_id,review.id]);
  const peerResponses=responseRows.filter(r=>r.rater_type==='peer'&&peers.some(p=>p.user_id===r.rater_id&&p.submitted_at));
  const peerCount=peers.filter(p=>p.submitted_at).length;
  const peerSummary=canSee&&peerCount>=3?cycle.template_snapshot.sections.flatMap(s=>s.questions.map(q=>{const answers=peerResponses.filter(r=>r.question_id===q.id);return {question_id:q.id,average:answers.length?answers.reduce((sum,r)=>sum+r.rating,0)/answers.length:null,comments:answers.map(r=>r.comment).filter(Boolean).sort()};})):[];
  const employee=people.find(p=>p.user_id===review.employee_id),manager=people.find(p=>p.user_id===review.manager_id);
  return {id:review.id,cycle_id:review.cycle_id,employee_id:review.employee_id,manager_id:review.manager_id,employee_name:employee?.name||review.employee_id,manager_name:manager?.name||review.manager_id,status:review.status,revision:review.revision,acknowledged_at:review.acknowledged_at||null,
    achievements:access.own||access.manager||access.hr?review.achievements||'':'',self_summary:access.own||access.manager||access.hr?review.self_summary||'':'',manager_summary:canSee?review.manager_summary||'':undefined,
    scores:canSee?score:access.own?{self_score:score.self_score}:null,outcome,responses,peer_summary:peerSummary,peer_count:canSee?peerCount:undefined,
    peers:access.hr?peers.map(p=>({...p,name:people.find(person=>person.user_id===p.user_id)?.name||p.user_id})):undefined,peer_submitted:!!peers.find(p=>p.user_id===actor.user_id)?.submitted_at,
    access,deadline:deadlineFor(cycle,review),manager_changed:access.hr&&employee?.manager_id!==review.manager_id,
    cycle:{id:cycle.id,name:cycle.name,status:cycle.status,period:cycle.period,start_date:cycle.start_date,end_date:cycle.end_date,deadlines:cycle.deadlines,peer_enabled:cycle.peer_enabled,template_snapshot:access.hr?cycle.template_snapshot:safeTemplate(cycle.template_snapshot)},reopened:review.reopened||{}};
}
function validateCycle(body) {
  const name=clean(body.name,'Cycle name',120,true);
  if(!['Annual','Half-yearly','Quarterly'].includes(body.period)||!isDate(body.start_date)||!isDate(body.end_date)||body.end_date<body.start_date) fail('Choose a valid period and review dates.');
  const scope=body.scope;
  if(!scope||!['departments','designations','employees'].every(k=>Array.isArray(scope[k])&&scope[k].length<=500&&scope[k].every(v=>typeof v==='string'&&v.length<=200))||typeof scope.exclude_probation!=='boolean'||scope.joined_before&&!isDate(scope.joined_before)) fail('Provide valid scope filters and joining cutoff date.');
  const keys=['self','manager',...(body.peer_enabled?['peer']:[]),'calibration','publish'];
  if(keys.some(k=>!isInstant(body.deadlines?.[k]))||keys.some((k,i)=>i>0&&Date.parse(body.deadlines[k])<Date.parse(body.deadlines[keys[i-1]]))) fail('Stage deadlines must be valid and follow self-review, manager, peer, calibration, then publication.');
  if(!Number.isInteger(body.reminder_hours)||body.reminder_hours<1||body.reminder_hours>720||!Number.isInteger(body.escalation_hours)||body.escalation_hours<1||body.escalation_hours>720) fail('Reminder and escalation intervals must be 1–720 hours.');
  return {name,period:body.period,start_date:body.start_date,end_date:body.end_date,scope:{departments:[...new Set(scope.departments)],designations:[...new Set(scope.designations)],employees:[...new Set(scope.employees)],exclude_probation:scope.exclude_probation,joined_before:scope.joined_before||''},deadlines:Object.fromEntries(keys.map(k=>[k,new Date(body.deadlines[k]).toISOString()])),peer_enabled:body.peer_enabled===true,enforce_distribution:body.enforce_distribution===true,reminder_hours:body.reminder_hours,escalation_hours:body.escalation_hours};
}
export async function appraisalsHandle({db,actor,path,method,url,body={}}) {
  const permissions=await privileges(db,actor),company=actor.company_id;
  const parts=path.slice('/api/v1/appraisals'.length).split('/').filter(Boolean),[resource,id,action,extra]=parts;
  if(extra) fail('Appraisal route not found.',404);
  if(resource==='notifications') {
    if(method==='GET'&&!id) return (await rows(db,'SELECT * FROM appraisal_notifications WHERE company_id=? AND recipient_id=? ORDER BY created_at DESC,id LIMIT 100',[company,actor.user_id])).map(r=>({id:'appraisal:'+r.id,title:r.title,message:r.title,category:'Personnel',timestamp:r.created_at,timeAgo:new Date(r.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}),created_at:r.created_at,unread:!!r.unread,reviewId:r.review_id,canApprove:false}));
    if(method==='POST'&&id==='read') {await stmt(db,`UPDATE appraisal_notifications SET unread=0 WHERE company_id=? AND recipient_id=?${body.id?' AND id=?':''}`,[company,actor.user_id,...(body.id?[String(body.id).replace(/^appraisal:/,'')]:[])]).run();return {saved:true};}
  }
  const people=await directory(db,company);
  if(resource==='context'&&method==='GET') return {...permissions,user_id:actor.user_id,directory:permissions.hr?people:people.filter(p=>p.user_id===actor.user_id||p.manager_id===actor.user_id)};
  if(resource==='roles') {
    needAdmin(permissions);
    if(method==='GET') return rows(db,'SELECT user_id,role FROM appraisal_roles WHERE company_id=?',[company]);
    if(method==='POST'&&!id) {
      if(!people.some(p=>p.user_id===body.user_id)||!['hr','employee'].includes(body.role)) fail('Choose a company employee and valid role.');
      const previous=await stmt(db,'SELECT user_id,role FROM appraisal_roles WHERE company_id=? AND user_id=?',[company,body.user_id]).first();
      await commit(db,[],[body.role==='hr'?stmt(db,"INSERT INTO appraisal_roles(company_id,user_id,role) VALUES(?,?,'hr') ON CONFLICT(company_id,user_id) DO UPDATE SET role='hr'",[company,body.user_id]):stmt(db,'DELETE FROM appraisal_roles WHERE company_id=? AND user_id=?',[company,body.user_id]),audit(db,actor,'role',body.user_id,'role_changed',previous,body)]);return {saved:true};
    }
  }
  if(resource==='templates') {
    needHR(permissions);
    if(method==='GET'&&!id) return (await rows(db,'SELECT * FROM appraisal_templates WHERE company_id=? ORDER BY updated_at DESC',[company])).map(unpack);
    needAdmin(permissions);
    if(method==='POST'&&!action) {
      let value;try{value=validateTemplate(body);}catch(e){fail(e.message);}
      const old=id?await templateGet(db,company,id):null;if(id&&!old)fail('Template not found.',404);if(old)requireRevision(old,body);
      const templateId=id||crypto.randomUUID();
      await commit(db,old?[versionCheck('appraisal_templates',company,old)]:[],[old?stmt(db,'UPDATE appraisal_templates SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND id=?',[json(value),now(),company,id]):stmt(db,'INSERT INTO appraisal_templates(company_id,id,payload,created_at,updated_at) VALUES(?,?,?,?,?)',[company,templateId,json(value),now(),now()]),audit(db,actor,'template',templateId,'template_saved',old,value)]);
      return templateGet(db,company,templateId);
    }
  }
  if(resource==='cycles') {
    if(method==='GET'&&!id) {
      const all=(await rows(db,`SELECT DISTINCT c.* FROM appraisal_cycles c${permissions.hr?'':" JOIN appraisal_reviews r ON r.company_id=c.company_id AND r.cycle_id=c.id LEFT JOIN appraisal_peer_assignments p ON p.company_id=r.company_id AND p.review_id=r.id"} WHERE c.company_id=?${permissions.hr?'':" AND (r.employee_id=? OR r.manager_id=? OR p.user_id=?)"} ORDER BY c.created_at DESC`,[company,...(permissions.hr?[]:[actor.user_id,actor.user_id,actor.user_id])])).map(unpack);
      return permissions.hr?all:all.map(c=>({id:c.id,name:c.name,status:c.status,period:c.period,start_date:c.start_date,end_date:c.end_date}));
    }
    needHR(permissions);
    let cycle=id?await cycleGet(db,company,id):null;if(id&&!cycle)fail('Cycle not found.',404);
    if(method==='POST'&&!action) {
      if(cycle){requireRevision(cycle,body);if(cycle.status!=='Draft')fail('Only draft cycles can be edited. Use reopen for deadlines.',409);}
      const value=validateCycle(body),templateId=clean(body.template_id||'','Template',100,true),template=await templateGet(db,company,templateId);if(!template)fail('Choose a company review template.');
      if(value.scope.employees.some(id=>!people.some(p=>p.user_id===id)))fail('Scope includes an employee outside this company.');
      const cycleId=id||crypto.randomUUID();
      await commit(db,cycle?[versionCheck('appraisal_cycles',company,cycle)]:[],[cycle?stmt(db,'UPDATE appraisal_cycles SET name=?,template_id=?,payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND id=?',[value.name,template.id,json(value),now(),company,id]):stmt(db,"INSERT INTO appraisal_cycles(company_id,id,name,status,template_id,payload,created_at,updated_at) VALUES(?,?,?,'Draft',?,?,?,?)",[company,cycleId,value.name,template.id,json(value),now(),now()]),audit(db,actor,'cycle',cycleId,'cycle_saved',cycle,value)]);
      return cycleGet(db,company,cycleId);
    }
    if(method==='GET'&&action==='scope') return people.filter(p=>inScope(p,cycle.scope)).map(p=>({...p,ready:!!p.manager_id&&p.manager_id!==p.user_id&&people.some(m=>m.user_id===p.manager_id&&m.status!=='Inactive')}));
    if(method==='POST'&&cycle) {
      requireRevision(cycle,body);
      if(action==='launch') {
        if(cycle.status!=='Draft')fail('Only a draft cycle can be launched.',409);
        if(Date.parse(cycle.deadlines.self)<=Date.now())fail('Self-review deadline must be in the future before launch.');
        const selected=people.filter(p=>inScope(p,cycle.scope));if(!selected.length||selected.length>500)fail('Select between 1 and 500 eligible employees per cycle.');
        if(selected.some(p=>!p.manager_id||p.manager_id===p.user_id||!people.some(m=>m.user_id===p.manager_id&&m.status!=='Inactive')))fail('Every selected employee needs one active direct reporting manager. Update Departments hierarchy or narrow the scope.');
        const template=await templateGet(db,company,cycle.template_id),snapshot=validateTemplate(template),time=now();
        const reviews=selected.map(p=>({id:crypto.randomUUID(),employee_id:p.user_id,manager_id:p.manager_id}));
        const payload={...cycle,template_snapshot:snapshot};delete payload.company_id;delete payload.revision;
        const messages=reviews.flatMap(r=>[r.employee_id,r.manager_id].map(recipient=>({id:crypto.randomUUID(),recipient,review_id:r.id,title:`${cycle.name}: review launched`,event:'launch:'+r.id})));
        await commit(db,[versionCheck('appraisal_cycles',company,cycle),versionCheck('appraisal_templates',company,template)],[stmt(db,"UPDATE appraisal_cycles SET status='Launched',payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND id=?",[json(payload),time,company,id]),stmt(db,"INSERT INTO appraisal_reviews(company_id,id,cycle_id,employee_id,manager_id,status,payload,created_at,updated_at) SELECT ?,json_extract(value,'$.id'),?,json_extract(value,'$.employee_id'),json_extract(value,'$.manager_id'),'Self-review','{}',?,? FROM json_each(?)",[company,id,time,time,json(reviews)]),stmt(db,"INSERT INTO appraisal_scores(company_id,review_id) SELECT ?,json_extract(value,'$.id') FROM json_each(?)",[company,json(reviews)]),stmt(db,"INSERT OR IGNORE INTO appraisal_notifications(id,company_id,recipient_id,review_id,title,event_key,created_at) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.recipient'),json_extract(value,'$.review_id'),json_extract(value,'$.title'),json_extract(value,'$.event'),? FROM json_each(?)",[company,time,json(messages)]),audit(db,actor,'cycle',id,'launched',cycle,{template:snapshot,employees:reviews})]);
        return cycleGet(db,company,id);
      }
      if(action==='publish'||action==='close') {
        const reviews=(await rows(db,'SELECT * FROM appraisal_reviews WHERE company_id=? AND cycle_id=?',[company,id])).map(unpack);
        if(!reviews.length)fail('This cycle has no reviews.');
        if(action==='publish') {
          if(cycle.status!=='Launched'||reviews.some(r=>r.status!=='Finalize'))fail('Finalize every review before publishing.',409);
          if(Date.parse(cycle.deadlines.publish)<Date.now())fail('Publication deadline passed. Reopen the publication deadline first.',409);
          const outcomes=await rows(db,'SELECT o.review_id,o.payload FROM appraisal_outcomes o JOIN appraisal_reviews r ON r.company_id=o.company_id AND r.id=o.review_id WHERE r.company_id=? AND r.cycle_id=?',[company,id]);
          if(outcomes.length!==reviews.length)fail('Every review needs a finalized outcome.',409);
          if(cycle.enforce_distribution) {const targets=distributionTargets(reviews.length,cycle.template_snapshot.distribution);if(BANDS.some(b=>outcomes.filter(o=>parse(o.payload).rating_band===b).length!==targets[b]))fail('Rating distribution does not match the configured targets. Calibrate ratings before publishing.',409);}
          await commit(db,[versionCheck('appraisal_cycles',company,cycle),{sql:"SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM json_each(?) v LEFT JOIN appraisal_reviews r ON r.company_id=? AND r.id=json_extract(v.value,'$.id') WHERE r.id IS NULL OR r.revision<>json_extract(v.value,'$.revision'))",params:[json(reviews.map(r=>({id:r.id,revision:r.revision}))),company]}],[stmt(db,"UPDATE appraisal_cycles SET status='Published',revision=revision+1,updated_at=? WHERE company_id=? AND id=?",[now(),company,id]),stmt(db,"UPDATE appraisal_reviews SET status='Published',revision=revision+1,updated_at=? WHERE company_id=? AND cycle_id=?",[now(),company,id]),stmt(db,"INSERT INTO appraisal_payroll_changes(company_id,review_id,employee_id,effective_date,base_ctc,revised_ctc,bonus,payload,created_at) SELECT o.company_id,o.review_id,r.employee_id,json_extract(o.payload,'$.effective_date'),json_extract(o.payload,'$.base_ctc'),json_extract(o.payload,'$.revised_ctc'),json_extract(o.payload,'$.bonus'),o.payload,? FROM appraisal_outcomes o JOIN appraisal_reviews r ON r.company_id=o.company_id AND r.id=o.review_id WHERE r.company_id=? AND r.cycle_id=? AND (json_extract(o.payload,'$.increment_percent')>0 OR json_extract(o.payload,'$.bonus')>0)",[now(),company,id]),stmt(db,"INSERT OR IGNORE INTO appraisal_notifications(id,company_id,recipient_id,review_id,title,event_key,created_at) SELECT lower(hex(randomblob(16))),company_id,employee_id,id,?,'published:'||id,? FROM appraisal_reviews WHERE company_id=? AND cycle_id=?",[`${cycle.name}: your result is published. Please acknowledge it.`,now(),company,id]),audit(db,actor,'cycle',id,'published',{status:cycle.status},{reviews:reviews.map(r=>r.id)})]);
        } else {
          if(cycle.status!=='Published'||reviews.some(r=>!r.acknowledged_at))fail('All published reviews must be acknowledged before closing.',409);
          await commit(db,[versionCheck('appraisal_cycles',company,cycle),{sql:"SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM json_each(?) v LEFT JOIN appraisal_reviews r ON r.company_id=? AND r.id=json_extract(v.value,'$.id') WHERE r.id IS NULL OR r.revision<>json_extract(v.value,'$.revision'))",params:[json(reviews.map(r=>({id:r.id,revision:r.revision}))),company]}],[stmt(db,"UPDATE appraisal_cycles SET status='Closed',revision=revision+1,updated_at=? WHERE company_id=? AND id=?",[now(),company,id]),stmt(db,"UPDATE appraisal_reviews SET status='Closed',revision=revision+1,updated_at=? WHERE company_id=? AND cycle_id=?",[now(),company,id]),audit(db,actor,'cycle',id,'closed',null,{status:'Closed'})]);
        }
        return cycleGet(db,company,id);
      }
      if(action==='reopen-publication') {
        if(cycle.status!=='Launched'||!isInstant(body.deadline)||Date.parse(body.deadline)<=Date.now())fail('Choose a future publication deadline for a launched cycle.');
        const reason=clean(body.reason,'Reason',2000,true),payload={...cycle,deadlines:{...cycle.deadlines,publish:new Date(body.deadline).toISOString()}};
        await commit(db,[versionCheck('appraisal_cycles',company,cycle)],[stmt(db,'UPDATE appraisal_cycles SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND id=?',[json(payload),now(),company,id]),audit(db,actor,'cycle',id,'publication_reopened',{deadline:cycle.deadlines.publish},{deadline:payload.deadlines.publish,reason})]);return cycleGet(db,company,id);
      }
    }
  }
  if(resource==='reviews') {
    if(method==='GET'&&!id) {
      const cycleId=url.searchParams.get('cycle');
      const all=(await rows(db,`SELECT DISTINCT r.*,s.self_score,s.manager_score,s.final_score,c.payload AS cycle_payload FROM appraisal_reviews r JOIN appraisal_cycles c ON c.company_id=r.company_id AND c.id=r.cycle_id LEFT JOIN appraisal_scores s ON s.company_id=r.company_id AND s.review_id=r.id LEFT JOIN appraisal_peer_assignments p ON p.company_id=r.company_id AND p.review_id=r.id WHERE r.company_id=?${cycleId?' AND r.cycle_id=?':''}${permissions.hr?'':' AND (r.employee_id=? OR r.manager_id=? OR p.user_id=?)'} ORDER BY r.created_at DESC,r.id`,[company,...(cycleId?[cycleId]:[]),...(permissions.hr?[]:[actor.user_id,actor.user_id,actor.user_id])])).map(unpack);
      const peerIds=new Set((await rows(db,'SELECT review_id FROM appraisal_peer_assignments WHERE company_id=? AND user_id=?',[company,actor.user_id])).map(r=>r.review_id));
      return all.flatMap(r=>{const person=people.find(p=>p.user_id===r.employee_id),access={own:r.employee_id===actor.user_id,manager:r.manager_id===actor.user_id&&person?.manager_id===actor.user_id,hr:permissions.hr&&r.employee_id!==actor.user_id,peer:peerIds.has(r.id)};if(!Object.values(access).some(Boolean))return [];const visible=access.hr||access.manager||access.own&&['Published','Closed'].includes(r.status);return [{id:r.id,cycle_id:r.cycle_id,employee_id:r.employee_id,manager_id:r.manager_id,employee_name:person?.name||r.employee_id,manager_name:people.find(p=>p.user_id===r.manager_id)?.name||r.manager_id,status:r.status,revision:r.revision,acknowledged_at:r.acknowledged_at||null,deadline:deadlineFor(parse(r.cycle_payload),r),scores:visible?{self_score:r.self_score,manager_score:r.manager_score,final_score:r.final_score}:access.own?{self_score:r.self_score}:null,manager_changed:access.hr&&person?.manager_id!==r.manager_id,access}];});
    }
    const review=await reviewGet(db,company,id);if(!review)fail('Review not found.',404);
    const access=await reviewAccess(db,actor,permissions,review,people),cycle=await cycleGet(db,company,review.cycle_id);
    if(method==='GET'&&!action)return detail(db,actor,permissions,review,people);
    if(method==='GET'&&action==='audit') {
      if(!access.hr)fail('Only HR may view the review audit trail.',403);
      return (await rows(db,"SELECT actor_id,action,before_data,after_data,created_at FROM appraisal_audit WHERE company_id=? AND entity_type='review' AND entity_id=? ORDER BY created_at,id",[company,id])).map(safeAudit);
    }
    if(method!=='POST')fail('Route not found.',404);
    requireRevision(review,body);
    const checks=[versionCheck('appraisal_reviews',company,review),versionCheck('appraisal_cycles',company,cycle)];
    if(action==='respond') {
      if(body.rater_type==='manager')checks.push(managerCheck(company,review.employee_id,actor.user_id));
      const type=body.rater_type;
      if(!['self','manager','peer'].includes(type)||type==='self'&&!access.own||type==='manager'&&!access.manager||type==='peer'&&!access.peer)fail('You cannot submit this type of response.',403);
      const expected={self:'Self-review',manager:'Manager review',peer:'Peer/360'}[type];
      if(review.status!==expected)fail('This response stage is not open.',409);unlocked(cycle,review);
      if(type==='peer'&&(await stmt(db,'SELECT submitted_at FROM appraisal_peer_assignments WHERE company_id=? AND review_id=? AND user_id=?',[company,id,actor.user_id]).first()).submitted_at)fail('Your peer feedback is already submitted.',409);
      if(!body.answers||typeof body.answers!=='object'||Array.isArray(body.answers))fail('Provide answers for this template.');
      const answers={};for(const question of cycle.template_snapshot.sections.flatMap(s=>s.questions)) {
        const value=body.answers[question.id]||{},rating=value.rating===''||value.rating==null?null:Number(value.rating);
        if(rating!==null&&(!['number','string'].includes(typeof value.rating)||!Number.isInteger(rating)||rating<1||rating>5))fail('Ratings must be whole numbers between 1 and 5.');
        if(body.submit&&rating===null)fail('Rate every question before submitting.');
        answers[question.id]={rating,comment:clean(value.comment||'','Comment',3000)};
      }
      const previous={answers:await rows(db,'SELECT question_id,rating,comment FROM appraisal_responses WHERE company_id=? AND review_id=? AND rater_type=? AND rater_id=?',[company,id,type,actor.user_id]),summary:type==='self'?review.self_summary||'':type==='manager'?review.manager_summary||'':'',achievements:type==='self'?review.achievements||'':''};
      const score=weightedScore(cycle.template_snapshot,answers),changes={};
      if(type==='self'){changes.achievements=clean(body.achievements||'','Achievements',5000);changes.self_summary=clean(body.summary||'','Self summary',5000);if(body.submit)changes.status='Manager review';}
      if(type==='manager'){changes.manager_summary=clean(body.summary||'','Manager feedback',5000);if(body.submit){if(!changes.manager_summary)fail('Add overall manager feedback before submitting.');changes.status=cycle.peer_enabled?'Peer/360':'Calibration';}}
      if(type==='peer'&&body.submit){const remaining=await stmt(db,'SELECT count(*) AS n FROM appraisal_peer_assignments WHERE company_id=? AND review_id=? AND user_id<>? AND submitted_at IS NULL',[company,id,actor.user_id]).first();if(!remaining.n)changes.status='Calibration';}
      const statements=[updateReview(db,company,review,changes),stmt(db,'DELETE FROM appraisal_responses WHERE company_id=? AND review_id=? AND rater_type=? AND rater_id=?',[company,id,type,actor.user_id]),stmt(db,"INSERT INTO appraisal_responses(company_id,review_id,question_id,rater_id,rater_type,rating,comment,updated_at) SELECT ?,?,key,?,?,json_extract(value,'$.rating'),json_extract(value,'$.comment'),? FROM json_each(?)",[company,id,actor.user_id,type,now(),json(answers)]),audit(db,actor,'review',id,type+(body.submit?'_submitted':'_saved'),previous,{answers,summary:body.summary||'',achievements:changes.achievements||''})];
      if(type==='self')statements.push(stmt(db,'UPDATE appraisal_scores SET self_score=? WHERE company_id=? AND review_id=?',[score,company,id]));
      if(type==='manager')statements.push(stmt(db,"UPDATE appraisal_scores SET manager_score=?,final_score=?,calibration_reason='',calibrated_by=NULL WHERE company_id=? AND review_id=?",[score,score,company,id]));
      if(type==='peer'&&body.submit)statements.push(stmt(db,'UPDATE appraisal_peer_assignments SET submitted_at=? WHERE company_id=? AND review_id=? AND user_id=?',[now(),company,id,actor.user_id]));
      if(body.submit&&type==='self')statements.push(notify(db,company,review.manager_id,id,`${cycle.name}: manager review is ready.`,'manager-ready:'+id+':'+review.revision));
      if(body.submit&&type==='manager'&&cycle.peer_enabled){const peers=await rows(db,'SELECT user_id FROM appraisal_peer_assignments WHERE company_id=? AND review_id=?',[company,id]);if(peers.length<3)fail('HR must assign at least three peers before the manager submits.');statements.push(...peers.map(p=>notify(db,company,p.user_id,id,`${cycle.name}: anonymous peer feedback is ready.`,'peer-ready:'+id+':'+review.revision)));}
      await commit(db,checks,statements);return detail(db,actor,permissions,await reviewGet(db,company,id),people);
    }
    if(action==='acknowledge') {
      if(!access.own||review.status!=='Published')fail('Only the employee may acknowledge a published review.',403);
      if(review.acknowledged_at)return detail(db,actor,permissions,review,people);
      const changes={acknowledged_at:now(),acknowledgement:clean(body.comment||'','Acknowledgement',2000)};
      await commit(db,checks,[updateReview(db,company,review,changes),audit(db,actor,'review',id,'acknowledged',null,changes)]);return detail(db,actor,permissions,await reviewGet(db,company,id),people);
    }
    if(!access.hr)fail('HR access is required; you cannot manage your own outcome.',403);
    if(['Published','Closed'].includes(review.status)||cycle.status!=='Launched')fail('Published and archived reviews are locked.',409);
    if(action==='peers') {
      if(!cycle.peer_enabled||!['Self-review','Manager review'].includes(review.status))fail('Assign peers before the peer-feedback stage begins.',409);
      const peers=body.peers;if(!Array.isArray(peers)||peers.length<3||peers.length>10||new Set(peers).size!==peers.length||peers.some(p=>[review.employee_id,review.manager_id].includes(p)||!people.some(person=>person.user_id===p&&person.status!=='Inactive')))fail('Choose 3–10 distinct active peers, excluding the employee and manager.');
      const previous=await rows(db,'SELECT user_id FROM appraisal_peer_assignments WHERE company_id=? AND review_id=?',[company,id]);
      await commit(db,checks,[updateReview(db,company,review),stmt(db,'DELETE FROM appraisal_peer_assignments WHERE company_id=? AND review_id=?',[company,id]),stmt(db,'INSERT INTO appraisal_peer_assignments(company_id,review_id,user_id) SELECT ?,?,value FROM json_each(?)',[company,id,json(peers)]),audit(db,actor,'review',id,'assignments_changed',previous,{peers})]);
    } else if(action==='calibrate') {
      if(review.status!=='Calibration')fail('Only reviews in calibration can be calibrated.',409);unlocked(cycle,review);
      const score=Math.round(Number(body.score)*100)/100,reason=clean(body.reason,'Calibration reason',2000,true);
      if(!Number.isFinite(score)||score<1||score>5)fail('Final score must be between 1 and 5.');
      const previous=await stmt(db,'SELECT * FROM appraisal_scores WHERE company_id=? AND review_id=?',[company,id]).first();
      await commit(db,checks,[updateReview(db,company,review),stmt(db,'UPDATE appraisal_scores SET final_score=?,calibration_reason=?,calibrated_by=? WHERE company_id=? AND review_id=?',[score,reason,actor.user_id,company,id]),audit(db,actor,'review',id,'calibrated',previous,{final_score:score,reason})]);
    } else if(action==='finalize') {
      if(review.status!=='Calibration')fail('Finish manager and peer stages before finalizing.',409);unlocked(cycle,review);
      const score=await stmt(db,'SELECT * FROM appraisal_scores WHERE company_id=? AND review_id=?',[company,id]).first();if(score.manager_score==null||score.final_score==null)fail('A complete manager score is required.');
      const rating_band=bandFor(score.final_score),increment_percent=Number(body.increment_percent),base_ctc=Number(body.base_ctc),bonus=Number(body.bonus);
      if(![increment_percent,base_ctc,bonus].every(Number.isFinite)||increment_percent<0||increment_percent>100||base_ctc<0||base_ctc>1e10||bonus<0||bonus>1e9||increment_percent>0&&base_ctc<=0||!isDate(body.effective_date))fail('Provide a valid effective date, annual payroll CTC, increment percentage and bonus.');
      const outcome={rating_band,increment_percent,base_ctc,revised_ctc:Math.round(base_ctc*(1+increment_percent/100)*100)/100,bonus,effective_date:body.effective_date,promotion:clean(body.promotion||'','Promotion / role change',300),pip:body.pip===true,training_plan:clean(body.training_plan||'','Training plan',3000),comments:clean(body.comments||'','Outcome comments',5000,true),finalized_by:actor.user_id,finalized_at:now()};
      await commit(db,checks,[updateReview(db,company,review,{status:'Finalize'}),stmt(db,'INSERT INTO appraisal_outcomes(company_id,review_id,payload) VALUES(?,?,?) ON CONFLICT(company_id,review_id) DO UPDATE SET payload=excluded.payload',[company,id,json(outcome)]),audit(db,actor,'review',id,'finalized',null,outcome)]);
    } else if(action==='reopen'||action==='reassign') {
      const reason=clean(body.reason,'Reason',2000,true),stage=action==='reassign'?(review.status==='Self-review'?'Self-review':'Manager review'):body.stage;
      if(!['Self-review','Manager review','Peer/360','Calibration'].includes(stage)||stage==='Peer/360'&&!cycle.peer_enabled||!isInstant(body.deadline)||Date.parse(body.deadline)<=Date.now())fail('Choose a valid stage and a future deadline.');
      const scores=await stmt(db,'SELECT self_score,manager_score FROM appraisal_scores WHERE company_id=? AND review_id=?',[company,id]).first();
      if(stage==='Manager review'&&scores.self_score==null||['Peer/360','Calibration'].includes(stage)&&scores.manager_score==null)fail('Complete the preceding rating stage before reopening this stage.');
      if(stage==='Peer/360'&&(await stmt(db,'SELECT count(*) AS n FROM appraisal_peer_assignments WHERE company_id=? AND review_id=?',[company,id]).first()).n<3)fail('Assign at least three peers before opening peer feedback.');
      if(stage==='Calibration'&&cycle.peer_enabled){const participation=await stmt(db,'SELECT count(*) AS n,sum(submitted_at IS NULL) AS pending FROM appraisal_peer_assignments WHERE company_id=? AND review_id=?',[company,id]).first();if(participation.n<3||participation.pending)fail('All assigned peers (at least three) must submit before calibration.');}
      const changes={status:stage,reopened:{...(review.reopened||{}),[stageDeadline(stage)]:new Date(body.deadline).toISOString()}},statements=[];
      if(action==='reassign') {
        const current=people.find(p=>p.user_id===review.employee_id)?.manager_id;
        if(!current||body.manager_id!==current||current===review.employee_id||!people.some(p=>p.user_id===current&&p.status!=='Inactive'))fail('Select the current active direct manager from Departments hierarchy.');
        checks.push(managerCheck(company,review.employee_id,current));
        changes.manager_id=current;changes.manager_summary='';
        statements.push(stmt(db,'DELETE FROM appraisal_peer_assignments WHERE company_id=? AND review_id=? AND user_id=?',[company,id,current]));
      }
      if(['Self-review','Manager review'].includes(stage)) {
        statements.push(stmt(db,"DELETE FROM appraisal_responses WHERE company_id=? AND review_id=? AND rater_type IN ('manager','peer')",[company,id]),stmt(db,"UPDATE appraisal_scores SET manager_score=NULL,final_score=NULL,calibration_reason='',calibrated_by=NULL WHERE company_id=? AND review_id=?",[company,id]),stmt(db,'UPDATE appraisal_peer_assignments SET submitted_at=NULL WHERE company_id=? AND review_id=?',[company,id]));changes.manager_summary='';
      } else if(stage==='Peer/360') {
        statements.push(stmt(db,"DELETE FROM appraisal_responses WHERE company_id=? AND review_id=? AND rater_type='peer'",[company,id]),stmt(db,'UPDATE appraisal_peer_assignments SET submitted_at=NULL WHERE company_id=? AND review_id=?',[company,id]),stmt(db,"UPDATE appraisal_scores SET final_score=manager_score,calibration_reason='',calibrated_by=NULL WHERE company_id=? AND review_id=?",[company,id]));
      }
      const before={review,responses:await rows(db,'SELECT * FROM appraisal_responses WHERE company_id=? AND review_id=?',[company,id]),outcome:await stmt(db,'SELECT payload FROM appraisal_outcomes WHERE company_id=? AND review_id=?',[company,id]).first()};
      statements.push(updateReview(db,company,review,changes),stmt(db,'DELETE FROM appraisal_outcomes WHERE company_id=? AND review_id=?',[company,id]),audit(db,actor,'review',id,action==='reassign'?'manager_reassigned':'stage_reopened',before,{...changes,reason}),notify(db,company,stage==='Self-review'?review.employee_id:changes.manager_id||review.manager_id,id,`${cycle.name}: ${stage} reopened.`,'reopen:'+id+':'+review.revision));
      await commit(db,checks,statements);
    } else fail('Appraisal action not found.',404);
    return detail(db,actor,permissions,await reviewGet(db,company,id),people);
  }
  if(resource==='audit'&&method==='GET') {
    needHR(permissions);const offset=Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0));
    return (await rows(db,"SELECT a.* FROM appraisal_audit a LEFT JOIN appraisal_reviews r ON a.entity_type='review' AND r.company_id=a.company_id AND r.id=a.entity_id WHERE a.company_id=? AND (r.id IS NULL OR r.employee_id<>?) ORDER BY a.created_at DESC,a.id LIMIT 100 OFFSET ?",[company,actor.user_id,offset])).map(safeAudit);
  }
  fail('Appraisal route not found.',404);
}

export async function processAppraisalTimers(db,time=Date.now()) {
  const pending=await rows(db,"SELECT r.*,c.payload AS cycle_payload,c.name AS cycle_name FROM appraisal_reviews r JOIN appraisal_cycles c ON c.company_id=r.company_id AND c.id=r.cycle_id WHERE c.status='Launched' AND r.status IN ('Self-review','Manager review','Peer/360','Calibration','Finalize')");
  if(!pending.length)return;
  const hrUsers=await rows(db,"SELECT company_id,user_id FROM users WHERE role='company_admin' AND status='active' UNION SELECT a.company_id,a.user_id FROM appraisal_roles a JOIN users u ON u.company_id=a.company_id AND u.user_id=a.user_id WHERE u.status='active'");
  const peers=await rows(db,"SELECT p.company_id,p.review_id,p.user_id FROM appraisal_peer_assignments p JOIN appraisal_reviews r ON r.company_id=p.company_id AND r.id=p.review_id JOIN appraisal_cycles c ON c.company_id=r.company_id AND c.id=r.cycle_id WHERE p.submitted_at IS NULL AND r.status='Peer/360' AND c.status='Launched'");
  const messages=[];
  for(const row of pending) {
    const review=unpack(row),cycle=parse(row.cycle_payload),deadline=Date.parse(deadlineFor(cycle,review));if(!Number.isFinite(deadline))continue;
    const hr=hrUsers.filter(u=>u.company_id===row.company_id).map(u=>u.user_id);
    const recipients=review.status==='Self-review'?[review.employee_id]:review.status==='Manager review'?[review.manager_id]:review.status==='Peer/360'?peers.filter(p=>p.company_id===row.company_id&&p.review_id===row.id).map(p=>p.user_id):hr;
    const add=(recipient,title,event)=>messages.push({id:crypto.randomUUID(),company:row.company_id,recipient,review:row.id,revision:row.revision,title,event});
    const bucket=Math.floor(time/(cycle.reminder_hours*3600000));
    if(time>=deadline-cycle.reminder_hours*3600000)for(const user of new Set(recipients))add(user,`${row.cycle_name}: ${review.status} ${time>deadline?'is overdue and locked':'is due soon'}.`,`reminder:${row.id}:${review.status}:${deadline}:${bucket}`);
    if(time>=deadline+cycle.escalation_hours*3600000)for(const user of new Set([...hr,review.manager_id]))add(user,`${row.cycle_name}: overdue ${review.status} requires HR attention.`,`escalation:${row.id}:${review.status}:${deadline}`);
  }
  // Bulk inserts avoid a query per recipient. Skip rows that progressed while reminders were prepared.
  for(let offset=0;offset<messages.length;offset+=500)await stmt(db,`INSERT OR IGNORE INTO appraisal_notifications(id,company_id,recipient_id,review_id,title,event_key,created_at)
    SELECT json_extract(v.value,'$.id'),r.company_id,json_extract(v.value,'$.recipient'),r.id,json_extract(v.value,'$.title'),json_extract(v.value,'$.event'),?
    FROM json_each(?) v JOIN appraisal_reviews r ON r.company_id=json_extract(v.value,'$.company') AND r.id=json_extract(v.value,'$.review') AND r.revision=json_extract(v.value,'$.revision')
    JOIN appraisal_cycles c ON c.company_id=r.company_id AND c.id=r.cycle_id WHERE c.status='Launched'`,[new Date(time).toISOString(),json(messages.slice(offset,offset+500))]).run();
}
