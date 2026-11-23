import { Button } from '../ui/Button';
import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Clock, ShieldCheck, FileText, X, ArrowUpRight, Users, Inbox } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { subscribeNotifications, markNotificationRead, markAllNotificationsRead, approveNotificationAction } from '../../lib/realtimeNotifications';
import './NotificationDropdown.scss';

const categories = ['All', 'Approvals', 'Payroll', 'Personnel', 'System'];
const categoryIcons = { All: Inbox, Approvals: CheckCheck, Payroll: FileText, Personnel: Users, System: ShieldCheck };

export function NotificationDropdown({ onOpenNotificationsCenter, onShowToast }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => subscribeNotifications((data, connected) => {
    setNotifications(data);
    setIsLiveConnected(connected);
  }), []);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const outside = event => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const keyboard = event => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', keyboard);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(item => item.unread).length;
  const filteredNotifications = notifications.filter(item =>
    (activeCategory === 'All' || item.category === activeCategory) && (!unreadOnly || item.unread)
  );
  const closePanel = () => { setIsOpen(false); triggerRef.current?.focus(); };
  const runAction = async operation => {
    setActionBusy(true); setActionError('');
    try { await operation(); }
    catch (error) { setActionError(error.message); }
    finally { setActionBusy(false); }
  };
  const markAllRead = () => runAction(markAllNotificationsRead);
  const approve = item => runAction(async () => {
    const result = await approveNotificationAction(item.id);
    onShowToast?.({type:'success',title:'Decision recorded',message:result.status === 'Approved' ? 'The request is approved.' : 'Your approval is recorded. Other approvals are still required.'});
  });

  return (
    <div ref={containerRef} className="notification-inbox" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
    }}>
      <Button ref={triggerRef} id="btn-header-notifications-dropdown" type="button" className="topbar__icon-btn notification-inbox__trigger" onClick={() => setIsOpen(open => !open)} aria-label={`Notifications, ${unreadCount} unread`} aria-expanded={isOpen} aria-haspopup="dialog" aria-controls={isOpen ? 'notification-dropdown-showcase-panel' : undefined} title="Notifications" variant="fadeout" wrapContent={false}>
        <Bell size={18} />
        {unreadCount > 0 && <span id="badge-unread-notifications" className="notification-inbox__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </Button>
      {isOpen && <section id="notification-dropdown-showcase-panel" className="notification-inbox__panel" role="dialog" aria-labelledby="notification-inbox-title">
        <div className="notification-inbox__heading">
          <div className="notification-inbox__heading-icon"><Bell size={21} /></div>
          <div className="notification-inbox__heading-copy"><h2 id="notification-inbox-title">Notifications <span>{unreadCount} unread</span></h2></div>
          <Button ref={closeRef} type="button" className="notification-inbox__close" onClick={closePanel} aria-label="Close notifications" variant="fadeout" wrapContent={false} iconOnly={true} size="sm"><X size={17} /></Button>
        </div>
        <div className="notification-inbox__toolbar">
          <Button type="button" className="notification-inbox__unread-toggle" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(value => !value)} variant="fadeout" wrapContent={false}><span aria-hidden="true" />Unread only</Button>
          <Button id="btn-mark-all-read" type="button" className="notification-inbox__mark-all" onClick={markAllRead} disabled={!unreadCount || actionBusy} variant="outline" wrapContent={false}><CheckCheck size={15} />Mark all read</Button>
        </div>
        <div className="notification-inbox__categories" role="group" aria-label="Filter notifications by category">
          {categories.map(category => {
            const Icon = categoryIcons[category];
            const count = notifications.filter(item => (category === 'All' || item.category === category) && (!unreadOnly || item.unread)).length;
            return <Button key={category} type="button" aria-label={category + ', ' + count + ' notifications'} title={category} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)} variant="fadeout" wrapContent={false}><Icon size={14} /><span className="notification-inbox__category-label">{category}</span>{count > 0 && <span className="notification-inbox__category-count">{count}</span>}</Button>;
          })}
        </div>
        {actionError && <p className="notification-inbox__action-error" role="alert">{actionError}</p>}
        <div className="notification-inbox__list" tabIndex={0} aria-label="Notification updates">
          <div className="notification-inbox__list-label"><span>{activeCategory === 'All' ? 'Latest updates' : activeCategory}</span><span aria-live="polite">{filteredNotifications.length} {filteredNotifications.length === 1 ? 'notification' : 'notifications'}</span></div>
          {filteredNotifications.length === 0 ? <div className="notification-inbox__empty"><span><Inbox size={29} strokeWidth={1.5} /></span><h3>{unreadOnly ? 'All caught up' : 'Nothing here yet'}</h3><p>{unreadOnly ? 'You have no unread notifications in this view.' : 'New updates will appear here as they arrive.'}</p>{(unreadOnly || activeCategory !== 'All') && <Button type="button" onClick={() => {
  setUnreadOnly(false);
  setActiveCategory('All');
}} variant="outline" wrapContent={false}>Show all notifications<ArrowUpRight size={14} /></Button>}</div> :
            filteredNotifications.map(item => {
              const Icon = categoryIcons[item.category] || Bell;
              return <article key={item.id} id={`notif-item-${item.id}`} className={`notification-inbox__card${item.unread ? ' notification-inbox__card--unread' : ''}`}>
                <div className="notification-inbox__avatar">{item.user ? <Avatar name={item.user.name} src={item.user.profile_pic_url} size="sm" /> : <span className="notification-inbox__category-icon"><Icon size={18} /></span>}</div>
                <div className="notification-inbox__content">
                  <div className="notification-inbox__meta"><span>{item.category || 'Update'}</span>{item.unread && <span className="notification-inbox__new">Unread</span>}<span className="notification-inbox__time"><Clock size={11} />{item.timeAgo || item.time}</span></div>
                  <h3>{item.title}</h3><p>{item.message}</p>
                  {item.systemTag && <span className="notification-inbox__system-tag"><ShieldCheck size={12} />{item.systemTag}</span>}
                  {(item.category === 'Approvals' || item.unread || item.location) && <div className="notification-inbox__card-actions">
                    {item.category === 'Approvals' && (item.approved ? <span className="notification-inbox__approved"><CheckCheck size={14} />Approved</span> : item.canApprove ? <Button disabled={actionBusy} id={`btn-notif-approve-${item.id}`} type="button" className="notification-inbox__approve" onClick={() => approve(item)} variant="outline" wrapContent={false}><Check size={13} />Approve</Button> : null)}
                    {item.location && <Button size="sm" variant="outline" icon={ArrowUpRight} onClick={() => { window.dispatchEvent(new CustomEvent('aster-document-location',{detail:item.location})); setIsOpen(false); }}>Open documents</Button>}
                    {item.unread && <Button id={`btn-notif-dismiss-${item.id}`} type="button" className="notification-inbox__read" disabled={actionBusy} onClick={() => runAction(() => markNotificationRead(item.id))} aria-label={`Mark ${item.title} as read`} variant="outline" wrapContent={false}>Mark as read</Button>}
                  </div>}
                </div>
              </article>;
            })}
        </div>
        <div className="notification-inbox__footer"><span className={`notification-inbox__connection${isLiveConnected ? ' is-connected' : ''}`}><i aria-hidden="true" />{isLiveConnected ? 'Updates connected' : 'Updates unavailable'}</span>{onOpenNotificationsCenter && <Button type="button" onClick={() => {
  setIsOpen(false);
  onOpenNotificationsCenter();
}} variant="outline" wrapContent={false} viewAll>View all notifications<ArrowUpRight size={14} /></Button>}</div>
      </section>}
    </div>
  );
}
