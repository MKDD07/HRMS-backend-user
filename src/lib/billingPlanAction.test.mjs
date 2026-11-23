import assert from 'node:assert/strict';
import { billingPlanAction } from './billingPlanAction.mjs';
const now=Date.parse('2026-11-15T12:00:00Z');
const plan={id:'business',amount:100,employee_limit:200,dashboard_limit:10};
const overview={mode:'live',liveSubscription:{plan_id:'business',ends_at:'2026-12-15T12:00:00Z'},orders:[],usage:{employees:20,dashboard_users:1},checkoutEnabled:true};
assert.deepEqual(billingPlanAction(plan,overview,now),{label:'Active plan',disabled:true,reason:'Manual renewal opens 7 days before expiry.'});
assert.equal(billingPlanAction(plan,overview,Date.parse('2026-12-08T12:00:00Z')).label,'Renew plan');
assert.equal(billingPlanAction(plan,overview,Date.parse('2026-12-08T12:00:00Z')).disabled,false);
assert.equal(billingPlanAction(plan,{...overview,recurring:{enabled:true,status:'active'}},now).label,'Auto-renewal on');
assert.equal(billingPlanAction({...plan,id:'team'},{...overview,recurring:{enabled:true,status:'active'}},now).disabled,true);
assert.equal(billingPlanAction(plan,{...overview,recurring:{enabled:false,status:'created'}},now).label,'Renewal setup pending');
assert.equal(billingPlanAction(plan,{...overview,recurring:{enabled:false,status:'cancelled'}},Date.parse('2026-12-09T12:00:00Z')).label,'Renew plan');
assert.equal(billingPlanAction(plan,{...overview,checkoutEnabled:false},Date.parse('2026-12-09T12:00:00Z')).disabled,true);
console.log('Plan actions passed: early renewal hidden, 7-day window, expired renewal, and real mandate states.');

assert.equal(billingPlanAction(plan,{...overview,orders:[{plan_id:'business',status:'pending'}]},now).label,'Active plan');

const starter={id:'starter',name:'Starter',amount:100,employee_limit:10,dashboard_limit:2};
const team={id:'team',name:'Team',amount:100,employee_limit:50,dashboard_limit:5};
const downgrade=billingPlanAction(starter,overview,now);assert.equal(downgrade.label,'Downgrade to Starter');assert.equal(downgrade.disabled,false);assert.equal(downgrade.free,true);
assert.equal(billingPlanAction(team,overview,now).label,'Downgrade to Team');assert.equal(billingPlanAction(team,overview,now).disabled,false);
assert.equal(billingPlanAction({...plan,name:'Business'},{...overview,liveSubscription:{...overview.liveSubscription,plan_id:'team'}},now).label,'Upgrade to Business');
assert.equal(billingPlanAction(team,{...overview,orders:[{plan_id:'business',status:'pending'}]},now).disabled,false);
