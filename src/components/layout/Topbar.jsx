import { canUseDashboard } from '../../../shared/dashboardAccess.mjs';
import { Button } from '../ui/Button';
import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Menu, Search, LogOut, ChevronDown, CalendarDays, X, ArrowUpRight, Users, PanelLeftClose } from 'lucide-react';
import { UniversalSearch } from '../ui/UniversalSearch';
import { Avatar } from '../ui/Avatar';
import { NotificationDropdown } from './NotificationDropdown';
import { HeaderCalendar } from './HeaderCalendar';
import './Topbar.scss';
import { getBrandLogo, onBrandLogoChange } from '../../lib/brandStore';

export function Topbar({
  onRefresh, onToggleSidebar, currentUser, onSwitchUser, allUsers = [], onSearch,
  onSelectEmployee, onOpenNotifications, onLogout, onNavigate,
  tenantName, isCollapsed = false
}) {
  const [brandLogo, setBrandLogo] = useState(getBrandLogo);
  useEffect(() => onBrandLogoChange(setBrandLogo), []);
  const [now, setNow] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const profileRef = useRef(null);
  const profileButtonRef = useRef(null);
  const name = ([currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ').trim() || currentUser?.name || currentUser?.username || 'Admin').toLocaleUpperCase();
  const workspace = tenantName || currentUser?.company_name || 'PulseHRMS';
  const role = currentUser?.type || 'Tenant Admin';
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const query = searchQuery.trim().toLowerCase();
  const matches = query ? allUsers.filter(user =>
    `${user.first_name || ''} ${user.last_name || ''} ${user.department || ''} ${user.userid || ''}`.toLowerCase().includes(query)
  ).slice(0, 5) : [];

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const outside = event => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const keyboard = event => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setProfileOpen(false);
        if (profileRef.current?.contains(document.activeElement)) profileButtonRef.current?.focus();
        else if (searchRef.current?.contains(document.activeElement)) inputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', keyboard);
    };
  }, []);

  const updateSearch = value => {
    setSearchQuery(value);
    setSearchOpen(Boolean(value.trim()));
    onSearch?.(value);
  };

  return (
    <header id="tenant-admin-header-bar" className="tenant-topbar">
      <div className="tenant-topbar__identity">
        <div className="tenant-topbar__brand">
          {brandLogo ? <img src={brandLogo} alt="Company Logo" /> : <strong>{workspace}</strong>}
        </div>
        <Button id="btn-toggle-sidebar" type="button" className="tenant-topbar__icon-button" onClick={onToggleSidebar} aria-controls="tenant-admin-sidebar" aria-expanded={!isCollapsed} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title="Toggle sidebar (Ctrl / ⌘ B)" variant="fadeout" wrapContent={false}>
          {isCollapsed ? <Menu size={19} /> : <PanelLeftClose size={19} />}
        </Button>
      </div>

      <div ref={searchRef} className="tenant-topbar__search" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
      }}>
        <UniversalSearch ref={inputRef} id="input-global-employee-search" scope="header"
          value={searchQuery} onChange={updateSearch} onFocus={() => setSearchOpen(Boolean(query))}
          label="Search employees by name, ID, or department" placeholder="Search employees..."
          aria-expanded={searchOpen} aria-controls={searchOpen ? 'search-lookup-dropdown' : undefined}
          shortcut="k" />
        {searchOpen && (
          <div id="search-lookup-dropdown" className="tenant-topbar__search-results">
            <div className="tenant-topbar__results-heading"><span>People in your workspace</span><span>{matches.length} found</span></div>
            {matches.length ? matches.map(employee => (
              <Button key={employee.userid} type="button" className="tenant-topbar__result" onClick={() => {
  updateSearch('');
  onSelectEmployee?.(employee.userid);
}} variant="outline" wrapContent={false} layout="row">
                <Avatar name={`${employee.first_name || ''} ${employee.last_name || ''}`} src={employee.profile_pic_url} avatarId={employee.avatar_id} size="sm" userid={employee.userid} />
                <span><strong>{employee.first_name} {employee.last_name}</strong><small>{[employee.userid, employee.department].filter(Boolean).join(' · ')}</small></span>
                <ArrowUpRight size={15} />
              </Button>
            )) : <div className="tenant-topbar__empty"><Users size={24} /><strong>No employees found</strong><p>Try another name, employee ID, or department.</p></div>}
            <div className="tenant-topbar__search-footer">Search by name, ID, or department <span>Esc to close</span></div>
          </div>
        )}
      </div>

      <div className="tenant-topbar__actions">
        {canUseDashboard(currentUser) && <Button type="button" variant="outline" size="sm" title="Open component snippet library" onClick={() => onNavigate?.('search-design')}>Snippets</Button>}
        <div id="header-date-greeting" className="tenant-topbar__date">
          <span>{greeting}</span>
          <time dateTime={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`}><CalendarDays size={13} />{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</time>
        </div>
        <HeaderCalendar currentUser={currentUser} allUsers={allUsers} onNavigate={onNavigate} />
        <NotificationDropdown onOpenNotificationsCenter={onOpenNotifications} />
        <Button id="btn-header-refresh" type="button" className="tenant-topbar__icon-button" variant="fadeout" iconOnly icon={RefreshCw} aria-label="Refresh current page" title="Refresh current page" onClick={onRefresh} />
        <span className="tenant-topbar__action-rule" aria-hidden="true" />
        <div className="tenant-topbar__account" ref={profileRef} onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false);
        }}>
          <Button ref={profileButtonRef} id="btn-header-profile-menu" type="button" className="tenant-topbar__profile" aria-label={`Account menu for ${name}`} aria-expanded={profileOpen} aria-controls={profileOpen ? 'header-account-panel' : undefined} onClick={() => setProfileOpen(open => !open)} variant="fadeout" wrapContent={false} iconOnly>
            <Avatar className="tenant-topbar__profile-avatar" name={name} src={currentUser?.profile_pic_url} size="sm" avatarId={currentUser?.avatar_id} userid={currentUser?.userid || currentUser?.username} />
          </Button>
          {profileOpen && <div id="header-account-panel" className="tenant-topbar__account-panel">
            <div className="tenant-topbar__account-summary"><span className="tenant-topbar__eyebrow">YOUR ACCOUNT</span><strong>{name}</strong>{currentUser?.email && <span>{currentUser.email}</span>}<small>{role} · {workspace}</small></div>
            {allUsers.length > 1 && onSwitchUser && <div className="tenant-topbar__personas"><span className="tenant-topbar__eyebrow">SWITCH PERSONA</span>{allUsers.map(user => <Button type="button" key={user.userid} onClick={() => {
  onSwitchUser(user);
  setProfileOpen(false);
}} variant="outline" wrapContent={false}><span>{user.first_name} {user.last_name}</span><small>{user.type}</small></Button>)}</div>}
            <Button type="button" className="tenant-topbar__logout" onClick={() => {
  setProfileOpen(false);
  onLogout?.();
}} variant="outline" wrapContent={false}><LogOut size={16} />Sign out<ArrowUpRight size={14} /></Button>
          </div>}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
