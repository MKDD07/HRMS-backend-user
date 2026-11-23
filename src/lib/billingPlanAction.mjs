export function billingPlanAction(plan, overview, now = Date.now()) {
  if (!plan.amount) return { label: 'Discuss Enterprise', disabled: false };
  const subscription = overview.policy?.subscription || (overview.mode === 'test' ? overview.subscription : overview.liveSubscription);
  const current = subscription?.plan_id === plan.id;
  const ranks={starter:1,team:2,business:3,enterprise:4};
  const activePlan=overview.plans?.find(item=>item.id===subscription?.plan_id);
  const activeRank=activePlan?.sort_order ?? ranks[subscription?.plan_id];
  const targetRank=plan.sort_order ?? ranks[plan.id];
  const changeLabel=!subscription?'Choose plan':targetRank>activeRank?`Upgrade to ${plan.name || plan.id}`:targetRank<activeRank?`Downgrade to ${plan.name || plan.id}`:'Change plan';
  if(overview.policy?.testEnabled) return {label:current?'Test plan active':`Test ${plan.name || plan.id}`,disabled:current,simulation:true};
  const downgrade=subscription && Date.parse(subscription.ends_at)>now && targetRank<activeRank;
  const renewal = overview.recurring;
  if (renewal && !['cancelled','completed','expired','failed'].includes(renewal.status)) return { label: current ? renewal.enabled ? 'Auto-renewal on' : 'Renewal setup pending' : changeLabel, disabled: true, reason: 'Turn off auto-renewal before making a manual purchase or changing plans.' };
  if (current && Date.parse(subscription.ends_at)-now>7*86400000) return { label: 'Active plan', disabled: true, reason: 'Manual renewal opens 7 days before expiry.' };
  const pending = overview.orders.find(order => ['pending','creating'].includes(order.status) && !(order.plan_id===subscription?.plan_id && Date.parse(subscription.ends_at)-now>7*86400000));
  if (pending) return { label: pending.plan_id === plan.id ? 'Resume checkout' : changeLabel, disabled: !overview.checkoutEnabled || pending.plan_id !== plan.id,reason:pending.plan_id!==plan.id?'Complete the unfinished checkout before choosing another plan.':undefined };
  if(downgrade) return {label:changeLabel,disabled:false,free:true};
  return { label: current ? 'Renew plan' : changeLabel, disabled: !overview.checkoutEnabled, ...(!overview.checkoutEnabled?{reason:overview.reason || 'Payment checkout is currently unavailable.'}:{}) };
}
