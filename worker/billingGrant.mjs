import { billingUsage, nextMonth } from './billing.mjs';

// Operator-only function. Never expose this as a customer-facing billing route.
// The order retains the catalogue price; the snapshot records a full waiver.
export async function grantComplimentaryPlan(db, { companyId, planId, authorizedBy, reason }) {
  if (!companyId || !planId || !authorizedBy || !reason) throw new Error('Grant authorization and reason are required.');
  const plan = await db.prepare('SELECT * FROM billing_plans WHERE id=? AND enabled=1').bind(planId).first();
  if (!plan?.amount || !plan.employee_limit || !plan.dashboard_limit) throw new Error('A fixed-capacity plan is required.');
  const usage = await billingUsage(db, companyId);
  if (usage.employees > plan.employee_limit || usage.dashboard_users > plan.dashboard_limit) throw new Error('Company usage exceeds this plan.');
  const now = new Date().toISOString(), endsAt = nextMonth(now);
  const orderId = crypto.randomUUID(), subscriptionId = crypto.randomUUID();
  const snapshot = JSON.stringify({ ...plan, activation_source: 'complimentary', amount_charged: 0, authorized_by: authorizedBy, grant_reason: reason });
  const guard = "NOT EXISTS(SELECT 1 FROM company_subscriptions WHERE company_id=? AND mode='live') AND NOT EXISTS(SELECT 1 FROM billing_orders WHERE company_id=? AND mode='live' AND status IN ('creating','pending'))";
  await db.batch([
    db.prepare(`INSERT INTO billing_orders(id,company_id,plan_id,plan_snapshot,amount,currency,mode,status,created_at,activated_at,created_by,key_id) SELECT ?,?,?,?,?,?,'live','activated',?,?,?,'complimentary' WHERE ${guard}`).bind(orderId,companyId,planId,snapshot,plan.amount,plan.currency,now,now,authorizedBy,companyId,companyId),
    db.prepare("INSERT INTO company_subscriptions(company_id,mode,id,plan_id,employee_limit,dashboard_limit,starts_at,ends_at,last_order_id) SELECT ?,'live',?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM billing_orders WHERE id=?)").bind(companyId,subscriptionId,planId,plan.employee_limit,plan.dashboard_limit,now,endsAt,orderId,orderId),
    db.prepare("INSERT INTO subscription_audit(id,company_id,order_id,action,created_at) SELECT ?,?,?,'complimentary_subscription_granted',? WHERE EXISTS(SELECT 1 FROM billing_orders WHERE id=?)").bind(crypto.randomUUID(),companyId,orderId,now,orderId)
  ]);
  const subscription = await db.prepare("SELECT * FROM company_subscriptions WHERE company_id=? AND mode='live'").bind(companyId).first();
  if (subscription?.last_order_id !== orderId) throw new Error('No grant created: a subscription or unfinished purchase already exists.');
  return { plan_id: planId, source: 'complimentary', amount_charged: 0, starts_at: now, ends_at: endsAt };
}
