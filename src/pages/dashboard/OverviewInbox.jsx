import React, { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, ClipboardCheck, X } from 'lucide-react';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { Button } from '../../components/ui/Button';
import { ExpandableList } from '../../components/ui/ExpandableList';
import { subscribeNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/realtimeNotifications';
import { workflowApi } from '../../lib/workflowApi';
import { operationsApi } from '../../lib/operationsApi';

export function OverviewNotifications() {
  const [feed, setFeed] = useState({ items: [], connected: false, loading: true });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => subscribeNotifications((items, connected, loading) => setFeed({ items, connected, loading })), []);
  async function read(id) { setBusy(true); setError(''); try { await (id ? markNotificationRead(id) : markAllNotificationsRead()); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  const unread = feed.items.filter(item => item.unread).length;
  return <TenantPanel title="Notifications" icon={Bell} className="overview-card overview-card--blue" actions={[{ id: 'read', label: 'Read all', icon: CheckCheck, onClick: () => read(), disabled: busy || !unread || !feed.connected }]}>
    {error && <p className="overview-inline-error" role="alert">{error}</p>}
    {!feed.connected && !feed.loading && <p className="overview-inline-error" role="status">Notification feed unavailable. Reconnecting…</p>}
    <ExpandableList items={feed.items} limit={3} empty={feed.loading ? 'Loading notifications…' : 'You are all caught up.'} renderItem={item => <article key={item.id} className={`overview-list-row ${item.unread ? 'is-unread' : ''}`}><div className="overview-row-copy"><strong>{item.title}</strong><p>{item.message}</p><small>{item.timestamp ? new Date(item.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : item.timeAgo}</small></div>{item.unread && <Button size="sm" variant="fadeout" iconOnly icon={Check} aria-label={`Mark ${item.title} read`} disabled={busy || !feed.connected} onClick={() => read(item.id)} />}</article>} />
  </TenantPanel>;
}

export function OverviewApprovals({ data, currentUser, onChanged, onNavigate }) {
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [rejecting, setRejecting] = useState(null), [reason, setReason] = useState('');
  const userId = currentUser?.user_id || currentUser?.userid;
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    async function load() {
      const workflows = async () => { const rows = []; for (let offset = 0; ; offset += 100) { const page = await workflowApi.requests('approvals', offset); rows.push(...page); if (page.length < 100) return rows; } };
      const results = await Promise.allSettled([workflows(), currentUser?.role === 'company_admin' && data.permissions.expenses ? operationsApi.list('expenses') : Promise.resolve([])]);
      if (!alive) return;
      const people = new Set((data.lists.employees || []).map(row => row.user_id));
      const expenseIds = new Set((data.lists.expenses || []).map(row => row.id));
      const requests = results[0].status === 'fulfilled' ? results[0].value.filter(row => row.canApprove && ['leave', 'attendance'].includes(row.kind) && people.has(row.requester_id)).map(row => ({ id: row.request_id, title: row.payload.requesterName, kind: row.kind === 'attendance' ? 'Regularization' : 'Leave', detail: row.payload.reason, date: row.payload.date || row.payload.start_date, record: row, source: 'workflow' })) : [];
      const expenses = results[1].status === 'fulfilled' ? results[1].value.filter(row => expenseIds.has(row.id) && row.status === 'Submitted' && row.employee_id !== userId).map(row => ({ id: row.id, title: row.title, kind: 'Expense', detail: `${row.currency || 'INR'} ${row.amount || ''}`, date: row.expense_date, record: row, source: 'expense' })) : [];
      setItems([...requests, ...expenses]);
      setError(results.filter(result => result.status === 'rejected').map(result => result.reason.message).join(' ')); setLoading(false);
    }
    load().catch(e => { if (alive) { setError(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, [data.refreshed_at, currentUser?.role, userId]);
  async function decide(item, decision) {
    setBusy(true); setError('');
    try {
      if (item.source === 'expense') await operationsApi.action('expenses', item.record, 'review', { decision, note: decision === 'Rejected' ? reason : '' });
      else await workflowApi.decide(item.id, decision, decision === 'Rejected' ? reason : '');
      setItems(old => old.filter(row => row.id !== item.id || row.source !== item.source)); setRejecting(null); setReason(''); onChanged();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!items.length) return error ? <p role="alert" className="overview-inline-error">{error}</p> : null;

  return <TenantPanel title="Pending approvals" subtitle="Requests you can approve" icon={ClipboardCheck} className="overview-card overview-card--amber" controls={data.permissions.departments && <Button id="dashboard-pending-approvals" variant="outline" viewAll aria-label="Open pending approvals" title="Open pending approvals" onClick={() => onNavigate('departments')} />}>
    {error && <p role="alert" className="overview-inline-error">{error}</p>}
    <ExpandableList items={items} limit={3} empty={loading ? 'Loading approvals…' : 'No actionable requests assigned to you.'} renderItem={item => <article className="overview-approval-row" key={item.source + item.id}><div className="overview-list-row"><div className="overview-row-copy"><small>{item.kind} · {item.date}</small><strong>{item.title}</strong><p>{item.detail}</p></div></div><div className="overview-row-actions"><Button size="sm" variant="outline" icon={Check} disabled={busy || loading} onClick={() => decide(item, 'Approved')}>Approve</Button><Button size="sm" variant="fadeout" icon={X} disabled={busy || loading} onClick={() => {
  setRejecting(item);
  setReason('');
}}>Reject</Button></div></article>} />
    {rejecting && <form className="overview-rejection" onSubmit={event => { event.preventDefault(); decide(rejecting, 'Rejected'); }}><label>Reason for rejecting {rejecting.title}<textarea autoFocus required maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></label><div className="overview-row-actions"><Button size="sm" variant="outline" disabled={busy || loading} onClick={() => setRejecting(null)}>Cancel</Button><Button size="sm" variant="danger" type="submit" disabled={busy || !reason.trim()}>Confirm rejection</Button></div></form>}
    {data.permissions.leave && <div className="overview-card-footer"><Button size="sm" variant="fadeout" onClick={() => onNavigate('leave')}>All leave requests</Button></div>}
  </TenantPanel>;
}
