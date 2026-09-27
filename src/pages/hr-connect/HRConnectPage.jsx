import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Megaphone, Mail, MessageSquare, Bell, ShieldCheck, Plus, Search, RefreshCw, ArrowUpRight, FileText, CalendarDays, Users, CheckCheck, Download, Inbox } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { hrConnectApi } from '../../lib/hrConnectApi';
import { subscribeNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/realtimeNotifications';
import '../dashboard/DashboardPage.scss';
import './HRConnectPage.scss';

const sections = [ ['overview', 'Overview', LayoutIcon], ['announcement', 'Announcements', Megaphone], ['message', 'Employee messages', MessageSquare], ['email', 'Email drafts', Mail], ['grievance', 'Grievance reviews', ShieldCheck], ['notifications', 'Notifications', Bell] ];
function LayoutIcon(props) { return <Inbox {...props} />; }
const names = { announcement: 'Announcement', message: 'Employee message', email: 'Email draft', grievance: 'Grievance' };
const date = value => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const personName = p => [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.userid || 'Employee';
function Empty({ title, children }) { return <div className="hr-empty"><Inbox size={28} /><h3>{title}</h3><p>{children}</p></div>; }
function Panel({ title, subtitle, action, children }) { return <section className="tenant-panel"><div className="tenant-panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>{children}</section>; }

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
  return <Modal isOpen onClose={() => !saving && onClose()} title={kind === 'grievance' ? 'Register a grievance' : `Create ${names[kind].toLowerCase()}`} size="lg"><form className="hr-form" onSubmit={submit}>
    <p className="hr-form-hint">{kind === 'email' ? 'Prepare an email and download it for your mail application. No email is sent from this workspace.' : kind === 'grievance' ? 'Record an employee concern for a private HR review. Review notes remain visible to company administrators only.' : 'Published messages are available to the selected employees through their authenticated HR Connect feed.'}</p>
    <label>{kind === 'announcement' ? 'Announcement title' : 'Subject'}<input name="title" required maxLength={200} disabled={saving} placeholder={kind === 'grievance' ? 'Briefly describe the concern' : 'Give your update a clear subject'} /></label>
    {kind === 'grievance' ? <label>Employee<select name="requester_id" required disabled={saving}><option value="">Select an employee</option>{employees.map(p => <option key={p.userid} value={p.userid}>{personName(p)}</option>)}</select></label> : <div className="hr-form-grid"><label>Audience<select value={scope} onChange={e => setScope(e.target.value)} disabled={saving}><option value="all">All employees</option><option value="department">A department</option><option value="employee">An employee</option></select></label>{scope !== 'all' && <label>{scope === 'department' ? 'Department' : 'Employee'}<select key={scope} name="target" required disabled={saving}><option value="">Choose recipient</option>{scope === 'department' ? departments.map(d => <option key={d}>{d}</option>) : employees.map(p => <option key={p.userid} value={p.userid}>{personName(p)}</option>)}</select></label>}</div>}
    <label>Priority<select name="priority" disabled={saving}><option>Normal</option><option>High</option><option>Urgent</option></select></label>
    <label>{kind === 'grievance' ? 'Details' : 'Message'}<textarea name="body" rows={7} required maxLength={10000} disabled={saving} placeholder="Include the information and next steps the reader needs." /></label>
    {error && <p className="hr-error" role="alert">{error}</p>}
    <div className="hr-form-actions"><button type="button" className="tenant-button" onClick={onClose} disabled={saving}>Cancel</button>{kind !== 'grievance' && <button type="submit" value="Draft" className="tenant-button" disabled={saving}>{saving ? 'Saving...' : 'Save draft'}</button>}{kind !== 'email' && <button type="submit" value="Published" className="tenant-button hr-primary" disabled={saving}>{saving ? 'Saving...' : kind === 'grievance' ? 'Register grievance' : 'Publish to employee feed'}</button>}</div>
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
  useEffect(() => subscribeNotifications((items, live) => { setNotifications(items); setConnected(live); }), []);
  const switchTab = next => { setTab(next); setSearch(''); setStatus('All'); };
  const save = record => { setRecords(items => [record, ...items.filter(p => p.id !== record.id)]); setCompose(null); setSelected(null); onShowToast?.({ type: 'success', title: 'Saved', message: record.status === 'Published' ? 'Published to the employee feed.' : record.kind === 'grievance' ? 'Grievance registered for HR review.' : 'Draft saved.' }); };
  const run = async action => { setWorking(true); setActionError(''); try { await action(); } catch (err) { setActionError(err.message); } finally { setWorking(false); } };
  const open = record => { setActionError(''); setSelected(record); };
  const grievances = records.filter(r => r.kind === 'grievance' && r.status !== 'Resolved');
  const announcements = records.filter(r => r.kind === 'announcement' && r.status === 'Published');
  const drafts = records.filter(r => r.status === 'Draft');
  const unread = notifications.filter(n => n.unread);
  const visible = records.filter(r => r.kind === tab && (status === 'All' || r.status === status) && `${r.title} ${r.body} ${r.audience}`.toLowerCase().includes(search.toLowerCase()));
  const stats = [ [Megaphone, 'Published announcements', announcements.length, 'Updates in the employee feed', 'announcement'], [ShieldCheck, 'Open grievances', grievances.length, 'Awaiting HR review or resolution', 'grievance'], [FileText, 'Communication drafts', drafts.length, 'Announcements, messages and emails', 'drafts'], [Bell, 'Unread notifications', unread.length, 'Your workflow activity', 'notifications'] ];
  const link = (next, label = 'View all') => <button className="tenant-link" onClick={() => switchTab(next)}>{label}<ArrowUpRight size={14} /></button>;
  const rows = (items, emptyTitle, emptyText) => items.length ? <div className="hr-records">{items.map(item => <button className="hr-record" key={item.id} onClick={() => open(item)}><span className="hr-record-icon">{item.kind === 'grievance' ? <ShieldCheck size={18} /> : item.kind === 'email' ? <Mail size={18} /> : <Megaphone size={18} />}</span><span className="hr-record-copy"><strong>{item.title}</strong><span>{item.kind === 'grievance' ? personName(employees.find(p => p.userid === item.requester_id)) : item.audience} · {date(item.updated_at)}</span><p>{item.body}</p></span><span className={`hr-badge ${item.priority === 'Urgent' ? 'hr-badge--urgent' : ''}`}>{item.kind === 'grievance' ? item.priority : item.status}</span><ArrowUpRight size={15} /></button>)}</div> : <Empty title={emptyTitle}>{emptyText}</Empty>;
  const downloadEmail = record => {
    const bytes = new TextEncoder().encode(record.title);
    const subject = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
    const content = `X-Unsent: 1\r\nSubject: =?UTF-8?B?${subject}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${record.body.replace(/\r?\n/g, '\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'message/rfc822' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'hr-email-draft.eml'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <main className="tenant-dashboard hr-connect">
    <header className="tenant-header">
      <div>
        <span className="tenant-eyebrow">WORKSPACE / PEOPLE &amp; COMMUNICATIONS</span>
        <h1>HR Connect<span>.</span></h1>
        <p>Keep employees informed, listen to concerns, and bring every conversation closer.</p>
      </div>
      <div className="hr-header-actions">
        <Button variant="fadeout" size="md" iconOnly icon={RefreshCw} loading={loading} onClick={refresh} aria-label="Refresh data" />
        <Button variant="colored" size="md" icon={Plus} disabled={loading || !!peopleError || !!error} onClick={() => setCompose('announcement')}>
          Create announcement
        </Button>
      </div>
    </header>
    <div className="tenant-context"><span>Your people. One connected workplace.</span><span className="hr-context-note"><ShieldCheck size={14} />Employee communication &amp; HR care</span></div>
    <section className="tenant-stats" aria-label="HR Connect overview">{stats.map(([Icon, label, value, note, next]) => <button className="tenant-stat" key={label} onClick={() => switchTab(next)}><div>{label}<Icon size={17} /></div><strong>{next === 'notifications' ? connected ? value : '—' : loading || error ? '—' : value}</strong><p>{note}<ArrowUpRight size={13} /></p></button>)}</section>
    <nav className="hr-tabs" aria-label="HR Connect sections">{sections.map(([id, label, Icon]) => <button key={id} aria-pressed={tab === id} onClick={() => switchTab(id)}><Icon size={15} />{label}{id === 'grievance' && grievances.length > 0 && <span>{grievances.length}</span>}</button>)}</nav>
    {(error || peopleError) && <div className="tenant-warning" role="alert"><span>{error && `HR Connect records could not be loaded. ${error}`} {peopleError}</span><button onClick={refresh}>Retry</button></div>}
    {tab === 'overview' ? <>
      <div className="hr-main-grid"><Panel title="Announcement board" subtitle="The latest updates shared with your employees" action={link('announcement')}>{loading ? <Empty title="Loading announcements" /> : rows(announcements.slice(0, 4), error ? 'Announcements unavailable' : 'Keep everyone in the loop', 'Share company news, policy changes, and upcoming events.')}</Panel><Panel title="Needs your attention" subtitle="Employee concerns awaiting a response" action={link('grievance')}>{loading ? <Empty title="Loading reviews" /> : rows(grievances.slice(0, 4), error ? 'Grievances unavailable' : 'No open grievances', 'New employee concerns will appear here for HR review.')}</Panel></div>
      <div className="hr-main-grid hr-secondary"><Panel title="Start a conversation" subtitle="Choose the right channel for your update"><div className="hr-quick-actions">{[[Megaphone, 'announcement', 'Company announcement', 'Share news and policy updates'], [MessageSquare, 'message', 'Employee message', 'Reach a person or department'], [Mail, 'email', 'Prepare an email', 'Write and export a mail draft'], [ShieldCheck, 'grievance', 'Register a concern', 'Create a private HR review']].map(([Icon, kind, label, hint]) => <button key={kind} disabled={loading || !!error || !!peopleError} onClick={() => setCompose(kind)}><Icon size={20} /><span><strong>{label}</strong><small>{hint}</small></span><ArrowUpRight size={14} /></button>)}</div></Panel><Panel title="HR essentials" subtitle="Helpful resources for everyday employee support"><div className="hr-resources">{[[FileText, 'Policies & documents', 'documents'], [CalendarDays, 'Company calendar', 'company-calendar'], [Users, 'Employee directory', 'employees']].map(([Icon, label, page]) => <button key={page} onClick={() => onNavigate(page)}><Icon size={17} />{label}<ArrowUpRight size={14} /></button>)}</div><div className="hr-mail-note"><Mail size={17} /><div><strong>Email workspace</strong><p>Draft emails here, then add recipients and send from your mail application. Inbox sync is not connected.</p></div></div></Panel></div>
    </> : tab === 'notifications' ? <Panel title="Your notifications" subtitle="Workflow requests, reminders, and decisions" action={<button className="tenant-link" disabled={working || !connected || !unread.length} onClick={() => run(markAllNotificationsRead)}><CheckCheck size={14} />Mark all read</button>}>{!connected && <p className="hr-inline-note" role="status">Notification feed is unavailable. Reconnecting automatically.</p>}{actionError && <p className="hr-error" role="alert">{actionError}</p>}<div className="hr-records">{notifications.map(n => <div className="hr-record" key={n.id}><Bell size={18} /><div className="hr-record-copy"><strong>{n.title}</strong><p>{n.message}</p><span>{n.timestamp ? date(n.timestamp) : n.timeAgo || ''}</span></div>{n.unread ? <button className="tenant-link" disabled={working || !connected} onClick={() => run(() => markNotificationRead(n.id))}>Mark read</button> : <span className="hr-badge">Read</span>}</div>)}</div>{!notifications.length && <Empty title={connected ? 'You’re all caught up' : 'No notifications loaded'}>Your workflow notifications appear here.</Empty>}</Panel> : <Panel title={tab === 'drafts' ? 'Communication drafts' : sections.find(s => s[0] === tab)?.[1]} subtitle={tab === 'email' ? 'Saved email content. Download a draft and add recipients in your mail application.' : tab === 'grievance' ? 'Private employee concerns, review notes, and resolution history.' : 'Manage your employee communications.'} action={tab !== 'drafts' && <button className="tenant-button" disabled={loading || !!peopleError || !!error} onClick={() => setCompose(tab)}><Plus size={14} />{tab === 'grievance' ? 'Register grievance' : 'Create new'}</button>}>
      <div className="hr-toolbar"><label><Search size={16} /><input aria-label="Search HR records" placeholder="Search subjects and messages..." value={search} onChange={e => setSearch(e.target.value)} /></label>{tab !== 'drafts' && tab !== 'email' && <select aria-label="Filter status" value={status} onChange={e => setStatus(e.target.value)}><option value="All">All statuses</option>{(tab === 'grievance' ? ['Open', 'In review', 'Resolved'] : ['Draft', 'Published']).map(s => <option key={s}>{s}</option>)}</select>}</div>
      {loading ? <Empty title="Loading records" /> : rows(tab === 'drafts' ? drafts.filter(r => `${r.title} ${r.body}`.toLowerCase().includes(search.toLowerCase())) : visible, error ? 'Records unavailable' : search || status !== 'All' ? 'No matching records' : 'Nothing here yet', search || status !== 'All' ? 'Try another search or status.' : 'Create your first record to get started.')}
    </Panel>}
    <footer className="tenant-freshness">Grievance review notes are private to company administrators. Published communications are available in the employee feed.</footer>
    {compose && <Composer kind={compose} employees={employees} onClose={() => setCompose(null)} onSave={save} />}
    {selected && <Modal isOpen onClose={() => !working && setSelected(null)} title={names[selected.kind]} size="lg"><div className="hr-detail"><div className="hr-detail-meta"><span className="hr-badge">{selected.status}</span><span>{selected.priority} priority</span><span>{date(selected.created_at)}</span></div><h2>{selected.title}</h2><p className="hr-form-hint">{selected.audience}{selected.kind !== 'grievance' && ` · ${selected.recipients.length} selected recipients`}</p><p className="hr-message-body">{selected.body}</p>{selected.kind === 'grievance' && <><h3>Review history</h3>{selected.history.length ? selected.history.map((h, index) => <div className="hr-history" key={index}><strong>{h.status} · {h.actor}</strong><small>{date(h.at)}</small><p>{h.note}</p></div>) : <p className="hr-form-hint">No review notes yet.</p>}<form className="hr-form" onSubmit={event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); run(async () => save(await hrConnectApi.review(selected.id, { ...values, revision: selected.revision }))); }}><label>Review status<select name="status" defaultValue={selected.status} disabled={working}><option>Open</option><option>In review</option><option>Resolved</option></select></label><label>Private review note<textarea name="note" required maxLength={4000} rows={4} disabled={working} placeholder="Record your findings and next steps." /></label><button className="tenant-button hr-primary" disabled={working}>Save review</button></form></>}{selected.kind === 'email' && <button className="tenant-button" onClick={() => downloadEmail(selected)}><Download size={15} />Download email draft</button>}{['announcement', 'message'].includes(selected.kind) && selected.status === 'Draft' && <button className="tenant-button hr-primary" disabled={working} onClick={() => run(async () => save(await hrConnectApi.review(selected.id, { status: 'Published', revision: selected.revision })))}>Publish to employee feed</button>}{actionError && <p className="hr-error" role="alert">{actionError}</p>}</div></Modal>}
  </main>;
}
