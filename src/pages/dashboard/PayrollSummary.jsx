import React from 'react';
import { FileText, CircleCheck, Wallet } from 'lucide-react';

const formatMoney = (value, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

export function PayrollSummary({ payroll }) {
  if (payroll.unavailable) return <p className="tenant-empty" role="status">Payroll data unavailable. Refresh to retry.</p>;
  const stages = [
    { label: 'Draft', value: payroll.draft || 0, icon: FileText, tone: 'draft', note: 'Awaiting processing' },
    { label: 'Processed', value: payroll.processed || 0, icon: CircleCheck, tone: 'processed', note: 'Payment not recorded' },
    { label: 'Paid', value: payroll.paid || 0, icon: Wallet, tone: 'paid', note: 'Payment recorded' },
  ];
  const total = stages.reduce((sum, stage) => sum + stage.value, 0);
  const paidShare = total ? Math.round(stages[2].value / total * 100) : 0;
  return <div className="payroll-summary">
    <div className="payroll-summary__total"><div><span>Recorded gross cost</span>{payroll.totals?.length ? payroll.totals.map(item => <strong key={item.currency}>{formatMoney(item.gross, item.currency)}</strong>) : <strong className="payroll-summary__unavailable">Not available</strong>}<small>{payroll.missingAmounts ? `${payroll.missingAmounts} records have no amount` : 'Latest recorded salary per employee'}</small></div><span className="payroll-summary__badge">{total} {total === 1 ? 'record' : 'records'}</span></div>
    <div className="payroll-summary__progress"><div><span>Payment completion</span><strong>{paidShare}% paid</strong></div><div className="payroll-summary__track" aria-hidden="true">{stages.map(stage => <span key={stage.tone} className={`payroll-summary__segment--${stage.tone}`} style={{ width: `${total ? stage.value / total * 100 : 0}%` }} />)}</div></div>
    <dl className="payroll-summary__stages">{stages.map(({ label, value, icon: Icon, tone, note }) => <div key={tone} className={`payroll-summary__stage--${tone}`}><dt><Icon size={15} aria-hidden="true" />{label}</dt><dd>{value.toLocaleString('en-IN')}</dd><small>{note}</small></div>)}</dl>
    {!total && <p className="payroll-summary__note">No payroll records for this cycle.</p>}
    {payroll.nextPayDate && <p className="payroll-summary__note">Next recorded pay date <strong>{new Date(payroll.nextPayDate + 'T12:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</strong></p>}
  </div>;
}
