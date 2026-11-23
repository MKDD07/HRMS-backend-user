import { OPERATIONS } from '../shared/operationsModel.mjs';
import { TALENT_COLLECTIONS } from '../shared/talentModel.mjs';
import { DASHBOARD_PAGES, routePages } from '../shared/dashboardAccess.mjs';
import { PLAN_RANK, planPages } from '../shared/planFeatures.mjs';
const q=(db,sql,args=[])=>db.prepare(sql).bind(...args);
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
// Created inside one request only. Never share authorization state between requests.
export function createPlanPolicyReader(db) {
 const policies=new Map(),seats=new Map();
 return {
  policy(company) { if(!policies.has(company))policies.set(company,workspacePolicy(db,company));return policies.get(company); },
  seats(company,policy) { if(!seats.has(company))seats.set(company,seatAccess(db,company,policy));return seats.get(company); }
 };
}
export async function workspacePolicy(db,company) {
 const state=await q(db,'SELECT * FROM billing_workspace_policy WHERE company_id=?',[company]).first();
 const live=await q(db,"SELECT * FROM company_subscriptions WHERE company_id=? AND mode='live'",[company]).first();
 const testPlan=state?.test_enabled && await q(db,'SELECT * FROM billing_plans WHERE id=? AND enabled=1',[state.test_plan_id]).first();
 const subscription=testPlan?{...testPlan,plan_id:testPlan.id,ends_at:null,source:'simulation'}:live;
 const pages=planPages(subscription?.plan_id,DASHBOARD_PAGES.map(([id])=>id).concat('dashboard-users'));
 return {testEnabled:Boolean(testPlan),revision:state?.revision||0,subscription,live,pages,employeeLimit:subscription?.employee_limit??null,dashboardLimit:subscription?.dashboard_limit??3};
}
export async function seatAccess(db,company,policy) {
 const rows=(await q(db,"SELECT e.employee_id,e.user_id,e.employee_code,e.status,e.dashboard_access FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND u.role='employee' ORDER BY e.employee_code COLLATE NOCASE,e.employee_id",[company]).all()).results;
 let employee=0,dashboard=0;const access=new Map();
 for(const row of rows){const active=row.status!=='Inactive';const locked=active && policy.employeeLimit!==null && ++employee>policy.employeeLimit; const dashboardLocked=Boolean(row.dashboard_access && (locked || ++dashboard>policy.dashboardLimit));access.set(row.user_id,{...row,plan_locked:locked,dashboard_plan_locked:dashboardLocked});}
 return access;
}
export async function applyActorPolicy(db,user,reader=createPlanPolicyReader(db)) {
 const policy=await reader.policy(user.company_id);
 const seat=user.role==='company_admin'?null:(await reader.seats(user.company_id,policy)).get(user.user_id);
 if(seat?.plan_locked)fail('Your account is outside the current plan capacity. Contact your company administrator.',403);
 return {...user,plan_pages:policy.pages,plan_test:policy.testEnabled,dashboard_access:seat?.dashboard_plan_locked?0:user.dashboard_access};
}
export async function enforcePlanRequest(db,actor,path,method,body={},reader=createPlanPolicyReader(db)) {
 const policy=await reader.policy(actor.company_id);
 const pages=routePages(path,method);
 const recordPath=path.match(/^\/api\/v1\/(operations|talent)\/([^/]+)(?:\/([^/]+))?/);
 const config=recordPath && (recordPath[1]==='operations'?OPERATIONS:TALENT_COLLECTIONS)[recordPath[2]];
 if((config && !policy.pages.includes(config.page)) || (pages.length && !pages.some(page=>policy.pages.includes(page))))fail('This feature is not included in your workspace plan.',403);
 const targets=[];
 function collect(value,depth=0){if(!value || typeof value!=='object' || depth>8)return;for(const [key,item] of Object.entries(value)){if(['userid','user_id','employee_id','reviewer_id','manager_id','assigned_to'].includes(key) && typeof item==='string')targets.push(item);else if(key==='employee_ids' && Array.isArray(item))targets.push(...item.filter(id=>typeof id==='string'));else if(typeof item==='object')collect(item,depth+1);}}
 collect(body);
 if(config && recordPath[3] && /^[a-z_]+$/.test(config.table)){const saved=await q(db,`SELECT payload FROM ${config.table} WHERE company_id=? AND id=?`,[actor.company_id,recordPath[3]]).first();if(saved)collect(JSON.parse(saved.payload));}
 if(targets.length){const access=await reader.seats(actor.company_id,policy);for(const row of access.values())if(row.plan_locked && targets.some(id=>[row.user_id,row.employee_id,row.employee_code].includes(id)))fail('This employee is outside your current plan capacity.',403);}
 return policy;
}
export async function changeWorkspacePlan({db,actor,body,simulation=false}) {
 if(body.accepted!==true || body.confirmed!==true)fail('Accept the plan terms and confirm the change.',400);
 const policy=await workspacePolicy(db,actor.company_id);
 if(body.revision!==policy.revision)fail('Plan settings changed. Refresh and try again.');
 const plan=await q(db,'SELECT * FROM billing_plans WHERE id=? AND enabled=1',[body.plan_id]).first();
 if(!plan?.amount || !PLAN_RANK[plan.id])fail('Choose a self-service plan.',400);
 if(simulation && !policy.testEnabled)fail('Enable test mode before testing a plan.',403);
 if(!simulation){
  if(policy.testEnabled)fail('Turn off test mode before changing your paid subscription.');
  if(!policy.live || policy.live.ends_at<=new Date().toISOString())fail('An active subscription is required for a free downgrade.');
  if(PLAN_RANK[plan.id]>=PLAN_RANK[policy.live.plan_id])fail('Upgrades require verified payment.',403);
  if(await q(db,"SELECT id FROM billing_recurring WHERE company_id=? AND mode='live' AND status NOT IN ('cancelled','completed','expired','failed')",[actor.company_id]).first())fail('Turn off auto-renewal before changing plans.');
  if(await q(db,"SELECT id FROM billing_orders WHERE company_id=? AND mode='live' AND status IN ('creating','pending')",[actor.company_id]).first())fail('Resolve your unfinished payment before downgrading.');
 }
 const now=new Date().toISOString(), mutation=crypto.randomUUID();
 // Compare-and-swap the policy revision inside the same transaction as the change.
 const statements=[q(db,'INSERT INTO billing_workspace_policy(company_id,updated_at,updated_by) VALUES(?,?,?) ON CONFLICT(company_id) DO NOTHING',[actor.company_id,now,actor.user_id]),q(db,'UPDATE billing_workspace_policy SET revision=revision+1,updated_at=?,updated_by=?,mutation_id=?,test_plan_id=CASE WHEN ? THEN ? ELSE test_plan_id END WHERE company_id=? AND revision=? AND test_enabled=? AND (?=1 OR EXISTS(SELECT 1 FROM company_subscriptions WHERE company_id=? AND mode=? AND plan_id=? AND ends_at=? AND last_order_id=?))',[now,actor.user_id,mutation,simulation?1:0,plan.id,actor.company_id,body.revision,simulation?1:0,simulation?1:0,actor.company_id,'live',policy.live?.plan_id||'',policy.live?.ends_at||'',policy.live?.last_order_id||''])];
 const guard='EXISTS(SELECT 1 FROM billing_workspace_policy WHERE company_id=? AND revision=? AND mutation_id=?)';
 const args=[actor.company_id,body.revision+1,mutation];
 if(!simulation)statements.push(q(db,'UPDATE company_subscriptions SET plan_id=?,employee_limit=?,dashboard_limit=? WHERE company_id=? AND mode=? AND plan_id=? AND ends_at=? AND '+guard,[plan.id,plan.employee_limit,plan.dashboard_limit,actor.company_id,'live',policy.live.plan_id,policy.live.ends_at,...args]));
 statements.push(q(db,'INSERT INTO billing_plan_changes(id,company_id,actor_id,from_plan,to_plan,action,created_at,details) SELECT ?,?,?,?,?,?,?,? WHERE '+guard,[crypto.randomUUID(),actor.company_id,actor.user_id,policy.subscription?.plan_id||null,plan.id,simulation?'simulation_plan_changed':'free_downgrade',now,JSON.stringify({employee_limit:plan.employee_limit,dashboard_limit:plan.dashboard_limit,ends_at:policy.live?.ends_at||null}),...args]));
 const result=await db.batch(statements);if(!(result[1].meta?.changes??result[1].changes))fail('Plan settings changed. Refresh and try again.');
 return {saved:true,policy:await workspacePolicy(db,actor.company_id)};
}
export async function togglePlanTest(db,actor,body){
 if(typeof body.enabled!=='boolean')fail('Choose whether test mode is enabled.',400);
 const policy=await workspacePolicy(db,actor.company_id);if(body.revision!==policy.revision)fail('Plan settings changed. Refresh and try again.');
 const now=new Date().toISOString(), mutation=crypto.randomUUID();const plan=policy.live?.plan_id||'starter';
 const result=await db.batch([q(db,'INSERT INTO billing_workspace_policy(company_id,updated_at,updated_by) VALUES(?,?,?) ON CONFLICT(company_id) DO NOTHING',[actor.company_id,now,actor.user_id]),q(db,'UPDATE billing_workspace_policy SET test_enabled=?,test_plan_id=?,revision=revision+1,updated_at=?,updated_by=?,mutation_id=? WHERE company_id=? AND revision=?',[body.enabled?1:0,plan,now,actor.user_id,mutation,actor.company_id,body.revision]),q(db,'INSERT INTO billing_plan_changes(id,company_id,actor_id,from_plan,to_plan,action,created_at,details) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM billing_workspace_policy WHERE company_id=? AND revision=? AND mutation_id=?)',[crypto.randomUUID(),actor.company_id,actor.user_id,policy.subscription?.plan_id||null,plan,body.enabled?'simulation_enabled':'simulation_disabled',now,'{}',actor.company_id,body.revision+1,mutation])]);
 if(!(result[1].meta?.changes??result[1].changes))fail('Plan settings changed. Refresh and try again.');return {saved:true};
}
