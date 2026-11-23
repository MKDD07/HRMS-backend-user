import { companyPolicyHandle } from './companyPolicyAssistant.mjs';
import { savePolicyDraft } from './policyDraftExport.mjs';
import { canUsePage,parsePages } from '../shared/dashboardAccess.mjs';
import { POLICY_SECTIONS } from '../shared/companyPolicyProfile.mjs';

export class PolicyGenerationRunner {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async state(jobId,company,state,phase,error='',nextRunAt=null){await this.env.DB.prepare("UPDATE talent_records SET payload=json_set(payload,'$.runState',?,'$.phase',?,'$.lastError',?,'$.nextRunAt',?,'$.updatedAt',?),revision=revision+1,updated_at=datetime('now') WHERE company_id=? AND collection='company_policy_job' AND id=? AND json_extract(payload,'$.id')=?").bind(state,phase,error,nextRunAt,new Date().toISOString(),company,`${company}:company_policy_job`,jobId).run();}
 async job(actor){return companyPolicyHandle({db:this.env.DB,env:this.env,actor,section:'policy-job',method:'GET',body:{},internal:true});}
 async fetch(request){
  return this.ctx.blockConcurrencyWhile(async()=>{const {actor,jobId,action}=await request.json();if(!actor?.company_id||!actor?.user_id||!['start','pause'].includes(action))return Response.json({error:'Invalid job request.'},{status:400});const job=await this.job(actor);if(!job||job.id!==jobId)return Response.json({error:'Policy plan changed. Reload it.'},{status:409});const old=await this.ctx.storage.get('runner');
   if(action==='pause'){if(old?.jobId===jobId){await this.ctx.storage.put('runner',{...old,status:'paused'});await this.ctx.storage.deleteAlarm();}await this.state(jobId,actor.company_id,'paused','Paused by HR');return Response.json(await this.job(actor));}
   if(job.items.every(item=>item.savedId)){await this.state(jobId,actor.company_id,'complete','All policies saved in AI drafts');return Response.json(await this.job(actor));}
   if(old?.jobId===jobId&&old.status==='running'){if(!await this.ctx.storage.getAlarm())await this.ctx.storage.setAlarm(Date.now()+1000);return Response.json(job);}
   await this.ctx.storage.put('runner',{actor,jobId,status:'running',failures:0});await this.state(jobId,actor.company_id,'queued','Queued for background generation');await this.ctx.storage.setAlarm(Date.now()+1000);return Response.json(await this.job(actor));
  });
 }
 async alarm(){
  let runner=await this.ctx.storage.get('runner');if(!runner||runner.status!=='running')return;const {jobId}=runner,company=runner.actor.company_id;
  // Arm recovery before external I/O. Successful steps replace this alarm.
  await this.ctx.storage.setAlarm(Date.now()+90000);
  try{
   const user=await this.env.DB.prepare("SELECT u.role,u.status,c.status AS company_status,e.dashboard_access,e.dashboard_pages FROM users u JOIN companies c ON c.company_id=u.company_id LEFT JOIN employees e ON e.company_id=u.company_id AND e.user_id=u.user_id WHERE u.company_id=? AND u.user_id=?").bind(company,runner.actor.user_id).first();
   const access={...user,dashboard_pages:parsePages(user?.dashboard_pages)};if(!user||user.status!=='active'||user.company_status!=='active'||!canUsePage(access,'documents'))throw Object.assign(Error('Document access is no longer available. HR must restart this task.'),{status:403});
   const actor={...runner.actor,...access,original_role:user.role,role:'company_admin'};
   let job=await this.job(actor);if(!job||job.id!==jobId){await this.ctx.storage.put('runner',{...runner,status:'paused'});await this.ctx.storage.deleteAlarm();return;}
   const item=job.items.find(item=>!item.savedId);
   if(!item){await this.state(jobId,company,'complete','All policies saved in AI drafts');await this.ctx.storage.put('runner',{...runner,status:'complete'});await this.ctx.storage.deleteAlarm();return;}
   if(item.sections.length<POLICY_SECTIONS.length){await this.state(jobId,company,'generating',`${item.title}: section ${item.sections.length+1}/${POLICY_SECTIONS.length}`);job=await companyPolicyHandle({db:this.env.DB,env:this.env,actor,section:'policy-section',method:'POST',body:{jobId,itemId:item.id,sectionIndex:item.sections.length},internal:true});}
   else{await this.state(jobId,company,'saving',`Saving ${item.title}`);const row=await this.env.DB.prepare("SELECT payload FROM talent_records WHERE company_id=? AND collection='document_settings'").bind(company).first();const branding=row?JSON.parse(row.payload).branding:{};const id=await savePolicyDraft(this.env,actor,job,item,branding);job=await companyPolicyHandle({db:this.env.DB,env:this.env,actor,section:'policy-saved',method:'POST',body:{jobId,itemId:item.id,documentId:id},internal:true});}
   const latest=await this.ctx.storage.get('runner');if(latest?.status!=='running'||latest.jobId!==jobId){await this.state(jobId,company,'paused','Paused by HR');await this.ctx.storage.deleteAlarm();return;}
   if(job.items.every(item=>item.savedId)){await this.state(jobId,company,'complete','All policies saved in AI drafts');await this.ctx.storage.put('runner',{...latest,status:'complete'});await this.ctx.storage.deleteAlarm();return;}
   const next=Date.now()+15000;await this.ctx.storage.put('runner',{...latest,failures:0});await this.state(jobId,company,'waiting','Generating in background; waiting between requests','',next);await this.ctx.storage.setAlarm(next);
  }catch(error){const latest=await this.ctx.storage.get('runner');if(latest?.status!=='running'||latest.jobId!==jobId){await this.ctx.storage.deleteAlarm();return;}const failures=(latest.failures||0)+1;const terminal=[400,403,404,409].includes(error.status)||/not configured|Groq key and model|Unsupported|Invalid/.test(error.message);const message=error.status?error.message:'Temporary generation issue. Automatic retry scheduled.';if(terminal){await this.ctx.storage.put('runner',{...latest,status:'failed',failures});await this.state(jobId,company,'failed','Generation needs attention',message);await this.ctx.storage.deleteAlarm();}else{const delay=error.status===429?Math.min(900000,65000*Math.ceil(failures/3)):Math.min(600000,30000*2**Math.min(failures,4));const next=Date.now()+delay;await this.ctx.storage.put('runner',{...latest,failures});await this.state(jobId,company,'waiting','Waiting to retry in background',message,next);await this.ctx.storage.setAlarm(next);}}
 }
}

