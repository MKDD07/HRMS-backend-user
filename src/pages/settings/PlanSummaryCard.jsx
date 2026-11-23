import React from 'react';
import { ArrowUpRight, CalendarDays, CreditCard, Sparkles, Users } from 'lucide-react';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { Button } from '../../components/ui/Button';
import './PlanSubscription.scss';

function Capacity({ icon: Icon, label, used, limit }) {
  const hasLimit = Number.isFinite(limit) && limit > 0;
  const full = hasLimit && used >= limit;
  return <div className={`billing-capacity ${full ? 'is-full' : ''}`}>
    <div><span><Icon size={15} aria-hidden="true" />{label}</span><strong>{used == null ? '—' : used}<small>{hasLimit ? ` / ${limit}` : limit === 0 ? ' / 0' : ''}</small></strong></div>
    {hasLimit ? <progress aria-label={`${label} capacity used`} value={Math.min(used || 0, limit)} max={limit} /> : <div className="billing-capacity-track" aria-hidden="true" />}
    <small>{used == null ? 'View billing for capacity details' : hasLimit ? full ? 'Capacity reached' : `${Math.max(0, limit - used)} available` : limit === 0 ? 'No additional capacity' : 'No fixed limit shown'}</small>
  </div>;
}

/** One shared plan summary for Settings discovery and the billing workspace. */
export function PlanSummaryCard({ overview, onOpen, disabled = false, children, heading, subtitle, className = '', controls, plain = false }) {
  const capacity = overview?.policy?.testEnabled ? {employee_limit:overview.policy.employeeLimit,dashboard_limit:overview.policy.dashboardLimit} : overview?.capacity;
  const subscription = overview?.policy?.subscription || overview?.liveSubscription;
  const planName = overview?.plans?.find(plan => plan.id === subscription?.plan_id)?.name;
  const title = !capacity ? 'Your workspace plan' : capacity.expired ? 'Subscription expired' : capacity.legacy ? 'Existing company workspace' : planName ? `${planName} plan` : 'Company subscription';
  return <TenantPanel className={`billing-summary ${plain ? '' : 'card--blue'} ${className}`.trim()} icon={heading ? undefined : plain ? CreditCard : Sparkles} title={heading || "Plan & billing"} subtitle={subtitle || "Workspace capacity, plans and payment history."} controls={controls || (onOpen && <Button className="billing-manage-button" variant="colored" size="sm" endIcon={ArrowUpRight} onClick={onOpen} disabled={disabled}>View plans & billing</Button>)}>
    {!overview ? <div className="billing-summary-content" aria-busy="true" aria-label="Loading subscription details"><div className="billing-summary-loading" aria-hidden="true"><div className="skeleton skeleton--text" style={{width:120}}/><div className="skeleton skeleton--text" style={{width:190,height:28}}/><div className="skeleton skeleton--text" style={{width:210}}/></div><div className="billing-summary-loading" aria-hidden="true">{[0,1].map(row=><div key={row} className="billing-summary-loading"><div className="skeleton skeleton--text" style={{width:'45%'}}/><div className="skeleton skeleton--text" style={{width:'100%',height:6}}/></div>)}</div></div> : <div className="billing-summary-content">
      <div className="billing-summary-intro"><span className={`billing-summary-state ${!capacity ? 'is-unknown' : capacity.expired ? 'is-expired' : overview?.policy?.testEnabled ? 'is-test' : ''}`}><span aria-hidden="true" />{!capacity ? 'Plan overview' : capacity.expired ? 'Action needed' : overview?.policy?.testEnabled ? 'Test mode' : 'Current subscription'}</span><h3>{title}</h3>{overview?.policy?.testEnabled && <p>Test billing is enabled for this workspace.</p>}<div className="billing-summary-details">{subscription?.source === 'complimentary' && <span className="billing-summary-detail"><CreditCard size={14} aria-hidden="true" />Complimentary access</span>}{subscription?.ends_at ? <span className="billing-summary-detail"><CalendarDays size={14} aria-hidden="true" /><span>Valid until <time dateTime={subscription.ends_at}>{new Date(subscription.ends_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})}</time></span></span> : subscription?.source !== 'complimentary' && <span className="billing-summary-detail"><CreditCard size={14} aria-hidden="true" />Company subscription</span>}</div></div>
      <div className="billing-summary-usage"><Capacity icon={Users} label="Active employees" used={overview?.usage?.employees} limit={capacity?.employee_limit} /><Capacity icon={CreditCard} label="Dashboard users" used={overview?.usage?.dashboard_users} limit={capacity?.dashboard_limit} /></div>
    </div>}
    {children}
  </TenantPanel>;
}
