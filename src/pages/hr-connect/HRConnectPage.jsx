import { SectionSkeleton } from '../../components/ui/SectionSkeleton';
import { MetricOverview, MetricOverviewSkeleton, MetricCard } from '../../components/ui/MetricOverview';
import { Button } from '../../components/ui/Button';
import { WorkspaceFilters } from '../../components/ui/WorkspaceFilters';
import { TenantPanel as Panel } from '../../components/ui/TenantPanel';
import { TenantHeader } from '../../components/ui/TenantHeader';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Megaphone, Mail, MessageSquare, Bell, ShieldCheck, Plus, ArrowUpRight, FileText, CalendarDays, Users, CheckCheck, Download, Inbox } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { hrConnectApi } from '../../lib/hrConnectApi';
import { subscribeNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/realtimeNotifications';
import '../dashboard/DashboardPage.scss';
import './HRConnectPage.scss';

const sections = [ ['overview', 'Overview', LayoutIcon], ['announcement', 'Announcements', Megaphone], ['message', 'Employee messages', MessageSquare], ['email', 'Email drafts', Mail], ['drafts', 'All drafts', FileText], ['grievance', 'Grievance reviews', ShieldCheck], ['notifications', 'Notifications', Bell] ];
function LayoutIcon(props) { return <Inbox {...props} />; }
const names = { announcement: 'Announcement', message: 'Employee message', email: 'Email draft', grievance: 'Grievance' };
const date = value => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const personName = p => [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.userid || 'Employee';
function Empty({ title, children }) { return <div className="hr-empty"><Inbox size={28} /><h3>{title}</h3><p>{children}</p></div>; }

function Composer({ kind, employees, onClose, onSave }) {
  const [scope, setScope] = useState('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const departments = [...new Set(employees.map(p => p.department).filter(Boolean))].sort();
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true); setError('');
    try {
      const record = await hrConnectApi.create({ ...values, kind, scope, status: event.nativeEvent.submitter?.value || 'Draft' });
      onSave(record);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <Modal isOpen busy={saving} onClose={() => !saving && onClose()} title={kind === 'grievance' ? 'Register a grievance' : `Create ${names[kind].toLowerCase()}`} size="lg"><form className="hr-form" onSubmit={submit}>
    <p className="hr-form-hint">{kind === 'email' ? 'Prepare an email and download it for your mail application. No email is sent from this workspace.' : kind === 'grievance' ? 'Record an employee concern for a private HR review. Review notes remain visible to company administrators only.' : 'Published messages are available to the selected employees through their authenticated HR Connect feed.'}</p>
    <label>{kind === 'announcement' ? 'Announcement title' : 'Subject'}<input name="title" required maxLength={200} disabled={saving} placeholder={kind === 'grievance' ? 'Briefly describe the concern' : 'Give your update a clear subject'} /></label>
    <div className="hr-form-grid">
      {kind === 'grievance' ? <label>Employee<select name="requester_id" required disabled={saving}><option value="">Select an employee</option>{employees.map(p => <option key={p.userid} value={p.userid}>{personName(p)}</option>)}</select></label> : <label>Audience<select value={scope} onChange={e => setScope(e.target.value)} disabled={saving}><option value="all">All employees</option><option value="department">A department</option><option value="employee">An employee</option></select></label>}
      <label>Priority<select name="priority" disabled={saving}><option>Normal</option><option>High</option><option>Urgent</option></select></label>
      {kind !== 'grievance' && scope !== 'all' && <label className="hr-form-recipient">{scope === 'department' ? 'Department' : 'Employee'}<select key={scope} name="target" required disabled={saving}><option value="">Choose recipient</option>{scope === 'department' ? departments.map(d => <option key={d}>{d}</option>) : employees.map(p => <option key={p.userid} value={p.userid}>{personName(p)}</option>)}</select></label>}
    </div>
    <label>{kind === 'grievance' ? 'Details' : 'Message'}<textarea name="body" rows={5} required maxLength={10000} disabled={saving} placeholder="Include the information and next steps the reader needs." /></label>
    {error && <p className="hr-error" role="alert">{error}</p>}
    <div className="hr-form-actions"><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>{kind !== 'grievance' && <Button type="submit" value="Draft" variant="outline" disabled={saving}>{saving ? 'Saving...' : 'Save draft'}</Button>}{kind !== 'email' && <Button type="submit" value="Published" disabled={saving}>{saving ? 'Saving...' : kind === 'grievance' ? 'Register grievance' : 'Publish to employee feed'}</Button>}</div>
  </form></Modal>;
}

export function HRConnectPage({ api, onShowToast, onNavigate }) {
  const [tab, setTab] = useState('overview');
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [peopleError, setPeopleError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [compose, setCompose] = useState(null);
  const [selected, setSelected] = useState(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true); setError(''); setPeopleError('');
    const [items, people] = await Promise.allSettled([hrConnectApi.list(), api.getAllUsers({ liveOnly: true })]);
    if (id !== sequence.current) return;
    if (items.status === 'fulfilled') setRecords(items.value); else { setRecords([]); setError(items.reason.message); }
    if (people.status === 'fulfilled' && Array.isArray(people.value.data)) setEmployees(people.value.data); else { setEmployees([]); setPeopleError('Employee directory unavailable. Refresh before choosing recipients.'); }
    setLoading(false);
  }, [api]);
  useEffect(() => { refresh(); return () => { sequence.current++; }; }, [refresh]);
  useEffect(() => subscribeNotifications((items, live, pending) => { setNotifications(items); setConnected(live); setNotificationsLoading(pending); }), []);
  const switchTab = next => { setTab(next); setSearch(''); setStatus('All'); };
  const save = record => { setRecords(items => [record, ...items.filter(p => p.id !== record.id)]); setCompose(null); setSelected(null); onShowToast?.({ type: 'success', title: 'Saved', message: record.status === 'Published' ? 'Published to the employee feed.' : record.kind === 'grievance' ? 'Grievance registered for HR review.' : 'Draft saved.' }); };
  const run = async action => { setWorking(true); setActionError(''); try { await action(); } catch (err) { setActionError(err.message); } finally { setWorking(false); } };
  const open = record => { setActionError(''); setSelected(record); };
  const grievances = records.filter(r => r.kind === 'grievance' && r.status !== 'Resolved');
  const announcements = records.filter(r => r.kind === 'announcement' && r.status === 'Published');
  const drafts = records.filter(r => r.status === 'Draft');
  const unread = notifications.filter(n => n.unread);
  const visible = records.filter(r => r.kind === tab && (status === 'All' || r.status === status) && `${r.title} ${r.body} ${r.audience}`.toLowerCase().includes(search.trim().toLowerCase()));
  const stats = [ [Megaphone, 'Published announcements', announcements.length, 'Updates in the employee feed', 'announcement'], [ShieldCheck, 'Open grievances', grievances.length, 'Awaiting HR review or resolution', 'grievance'], [FileText, 'Communication drafts', drafts.length, 'Announcements, messages and emails', 'drafts'], [Bell, 'Unread notifications', unread.length, 'Your workflow activity', 'notifications'] ];
  const link = (next, label = 'View all') => [{ id: next, label, viewAll: true, endIcon: ArrowUpRight, onClick: () => switchTab(next) }];
  const rows = (items, emptyTitle, emptyText) => items.length ? <div className="hr-records">{items.map(item => <Button className="hr-record" key={item.id} onClick={() => open(item)} variant="outline" type="button" wrapContent={false} layout="row"><span className="hr-record-icon">{item.kind === 'grievance' ? <ShieldCheck size={18} /> : item.kind === 'email' ? <Mail size={18} /> : item.kind === 'message' ? <MessageSquare size={18} /> : <Megaphone size={18} />}</span><span className="hr-record-copy"><strong>{item.title}</strong><span>{item.kind === 'grievance' ? personName(employees.find(p => p.userid === item.requester_id)) : item.audience} · {date(item.updated_at)}</span><p>{item.body}</p></span><span className={`hr-badge ${item.priority === 'Urgent' ? 'hr-badge--urgent' : ''}`}>{item.kind === 'grievance' ? item.priority : item.status}</span><ArrowUpRight size={15} /></Button>)}</div> : <Empty title={emptyTitle}>{emptyText}</Empty>;
  const downloadEmail = record => {
    const bytes = new TextEncoder().encode(record.title);
    const subject = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
    const content = `X-Unsent: 1\r\nSubject: =?UTF-8?B?${subject}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${record.body.replace(/\r?\n/g, '\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'message/rfc822' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'hr-email-draft.eml'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <main className="tenant-dashboard hr-connect">
    <TenantHeader settings={{ subheading: "WORKSPACE / PEOPLE & COMMUNICATIONS", heading: "HR Connect", paragraph: "Keep employees informed, listen to concerns, and bring every conversation closer.", buttons: [{ id: 'create', label: 'Create announcement' }], refresh: true }} actions={{ refresh: { onClick: refresh, loading }, create: { icon: Plus, disabled: loading || !!peopleError || !!error, onClick: () => setCompose('announcement') } }} />
    <MetricOverview className="hr-connect-metrics" loading={loading} aria-label="HR Connect overview">{stats.map(([Icon, label, value, note, next]) => next === 'notifications' && notificationsLoading ? <MetricOverviewSkeleton key={label} count={1} /> : <MetricCard key={label} onClick={() => switchTab(next)} as="button" label={label} icon={Icon} value={next === 'notifications' ? connected ? value : '—' : loading || error ? '—' : value} caption={note} />)}</MetricOverview>
    <nav className="card hr-tabs" aria-label="HR Connect sections">{sections.map(([id, label, Icon]) => <Button key={id} aria-pressed={tab === id} onClick={() => switchTab(id)} variant={tab === id ? "colored" : "fadeout"} type="button" wrapContent={false}><Icon size={15} />{label}{id === 'grievance' && grievances.length > 0 && <span>{grievances.length}</span>}</Button>)}</nav>
    {(error || peopleError) && <div className="tenant-warning" role="alert"><span>{error && `HR Connect records could not be loaded. ${error}`} {peopleError}</span><Button onClick={refresh} variant="outline" type="button" wrapContent={false}>Retry</Button></div>}
    {tab === 'overview' ? <>
      <div className="workspace-grid hr-overview-grid"><Panel title="Announcement board" subtitle="The latest updates shared with your employees" actions={link('announcement')}><SectionSkeleton loading={loading}>{loading ? <Empty title="Loading announcements" /> : rows(announcements.slice(0, 4), error ? 'Announcements unavailable' : 'Keep everyone in the loop', 'Share company news, policy changes, and upcoming events.')}</SectionSkeleton></Panel><Panel className="overview-card overview-card--amber card--amber" icon={ShieldCheck} title="Needs your attention" subtitle="Employee concerns awaiting a response" actions={link('grievance')}><SectionSkeleton loading={loading}>{loading ? <Empty title="Loading reviews" /> : rows(grievances.slice(0, 4), error ? 'Grievances unavailable' : 'No open grievances', 'New employee concerns will appear here for HR review.')}</SectionSkeleton></Panel></div>
      <div className="workspace-grid hr-overview-grid"><Panel title="Start a conversation" subtitle="Choose the right channel for your update"><div className="hr-quick-actions">{[[Megaphone, 'announcement', 'Company announcement', 'Share news and policy updates'], [MessageSquare, 'message', 'Employee message', 'Reach a person or department'], [Mail, 'email', 'Prepare an email', 'Write and export a mail draft'], [ShieldCheck, 'grievance', 'Register a concern', 'Create a private HR review']].map(([Icon, kind, label, hint]) => <Button key={kind} disabled={loading || !!error || !!peopleError} onClick={() => setCompose(kind)} variant="outline" type="button" wrapContent={false}><Icon size={20} /><span><strong>{label}</strong><small>{hint}</small></span><ArrowUpRight size={14} /></Button>)}</div></Panel><Panel className="card--purple" icon={Users} title="HR essentials" subtitle="Helpful resources for everyday employee support"><div className="hr-resources">{[[FileText, 'Policies & documents', 'documents'], [CalendarDays, 'Company calendar', 'company-calendar'], [Users, 'Employee directory', 'employees']].map(([Icon, label, page]) => <Button key={page} onClick={() => onNavigate(page)} variant="outline" type="button" wrapContent={false}><Icon size={17} />{label}<ArrowUpRight size={14} /></Button>)}</div><div className="hr-mail-note"><Mail size={17} /><div><strong>Email workspace</strong><p>Draft emails here, then add recipients and send from your mail application.</p></div></div></Panel></div>
      <Panel title="Continue a draft" subtitle="Pick up an unfinished announcement, message, or email" actions={link('drafts', 'View all drafts')}><SectionSkeleton loading={loading}>{loading ? <Empty title="Loading drafts" /> : rows(drafts.slice(0, 3), error ? 'Drafts unavailable' : 'No unfinished drafts', 'Saved drafts appear here when you need to finish an update.')}</SectionSkeleton></Panel>
    </> : tab === 'notifications' ? <Panel title="Your notifications" subtitle="Workflow requests, reminders, and decisions" actions={[{ id: 'read', label: 'Mark all read', icon: CheckCheck, disabled: working || !connected || !unread.length, onClick: () => run(markAllNotificationsRead) }]}>{!connected && <p className="hr-inline-note" role="status">Notification feed is unavailable. Reconnecting automatically.</p>}{actionError && <p className="hr-error" role="alert">{actionError}</p>}<div className="hr-records">{notifications.map(n => <div className="hr-record" key={n.id}><Bell size={18} /><div className="hr-record-copy"><strong>{n.title}</strong><p>{n.message}</p><span>{n.timestamp ? date(n.timestamp) : n.timeAgo || ''}</span></div>{n.unread ? <Button className="tenant-link" disabled={working || !connected} onClick={() => run(() => markNotificationRead(n.id))} variant="fadeout" type="button" wrapContent={false}>Mark read</Button> : <span className="hr-badge">Read</span>}</div>)}</div>{!notifications.length && <Empty title={connected ? 'You’re all caught up' : 'No notifications loaded'}>Your workflow notifications appear here.</Empty>}</Panel> : <Panel title={tab === 'drafts' ? 'Communication drafts' : sections.find(s => s[0] === tab)?.[1]} subtitle={tab === 'email' ? 'Saved email content. Download a draft and add recipients in your mail application.' : tab === 'grievance' ? 'Private employee concerns, review notes, and resolution history.' : 'Manage your employee communications.'} actions={[{ id: 'create', label: tab === 'grievance' ? 'Register grievance' : 'Create new', icon: Plus, visible: tab !== 'drafts', disabled: loading || !!peopleError || !!error, onClick: () => setCompose(tab) }]}>
      <WorkspaceFilters search={search} searchLabel="Search subjects and messages" onSearch={setSearch} status={status} allStatus="All" onStatus={tab !== 'drafts' && tab !== 'email' ? setStatus : undefined} statuses={tab === 'grievance' ? ['Open', 'In review', 'Resolved'] : ['Draft', 'Published']} active={!!search || status !== 'All'} onReset={()=>{setSearch('');setStatus('All');}} />
      <SectionSkeleton loading={loading}>{loading ? <Empty title="Loading records" /> : rows(tab === 'drafts' ? drafts.filter(r => `${r.title} ${r.body}`.toLowerCase().includes(search.trim().toLowerCase())) : visible, error ? 'Records unavailable' : search || status !== 'All' ? 'No matching records' : 'Nothing here yet', search || status !== 'All' ? 'Try another search or status.' : 'Create your first record to get started.')}</SectionSkeleton>
    </Panel>}
    <footer className="tenant-freshness">Grievance review notes are private to company administrators. Published communications are available in the employee feed.</footer>
    {compose && <Composer kind={compose} employees={employees} onClose={() => setCompose(null)} onSave={save} />}
    {selected && <Modal isOpen busy={working} onClose={() => !working && setSelected(null)} title={names[selected.kind]} size="lg"><div className="hr-detail"><div className="hr-detail-meta"><span className="hr-badge">{selected.status}</span><span>{selected.priority} priority</span><span>{date(selected.created_at)}</span></div><h2>{selected.title}</h2><p className="hr-form-hint">{selected.audience}{selected.kind !== 'grievance' && ` · ${selected.recipients.length} selected recipients`}</p><p className="hr-message-body">{selected.body}</p>{selected.kind === 'grievance' && <><h3>Review history</h3>{selected.history.length ? selected.history.map((h, index) => <div className="hr-history" key={index}><strong>{h.status} · {h.actor}</strong><small>{date(h.at)}</small><p>{h.note}</p></div>) : <p className="hr-form-hint">No review notes yet.</p>}<form className="hr-form" onSubmit={event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); run(async () => save(await hrConnectApi.review(selected.id, { ...values, revision: selected.revision }))); }}><label>Review status<select name="status" defaultValue={selected.status} disabled={working}><option>Open</option><option>In review</option><option>Resolved</option></select></label><label>Private review note<textarea name="note" required maxLength={4000} rows={4} disabled={working} placeholder="Record your findings and next steps." /></label><Button className="tenant-button hr-primary" disabled={working} variant="colored" type="submit" wrapContent={false}>Save review</Button></form></>}{selected.kind === 'email' && <Button className="tenant-button" onClick={() => downloadEmail(selected)} variant="outline" type="button" wrapContent={false}><Download size={15} />Download email draft</Button>}{['announcement', 'message'].includes(selected.kind) && selected.status === 'Draft' && <Button className="tenant-button hr-primary" disabled={working} onClick={() => run(async () => save(await hrConnectApi.review(selected.id, {
  status: 'Published',
  revision: selected.revision
})))} variant="colored" type="button" wrapContent={false}>Publish to employee feed</Button>}{actionError && <p className="hr-error" role="alert">{actionError}</p>}</div></Modal>}
  </main>;
}
