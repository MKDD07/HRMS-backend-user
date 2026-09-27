import React, { useState, useEffect, useRef } from 'react';
import { Menu, Search, LogOut, ChevronDown, CalendarDays, X, ArrowUpRight, Users, PanelLeftClose } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { NotificationDropdown } from './NotificationDropdown';
import './Topbar.scss';
import { getBrandLogo, onBrandLogoChange } from '../../lib/brandStore';

export function Topbar({
  onToggleSidebar, currentUser, onSwitchUser, allUsers = [], onSearch,
  onSelectEmployee, onOpenNotifications, onLogout,
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
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
        <button id="btn-toggle-sidebar" type="button" className="tenant-topbar__icon-button" onClick={onToggleSidebar}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Toggle sidebar'} title="Toggle sidebar (Ctrl / ⌘ B)">
          {isCollapsed ? <Menu size={19} /> : <PanelLeftClose size={19} />}
        </button>
      </div>

      <div ref={searchRef} className="tenant-topbar__search" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
      }}>
        <Search size={17} aria-hidden="true" />
        <input ref={inputRef} id="input-global-employee-search" type="search" value={searchQuery}
          onChange={event => updateSearch(event.target.value)} onFocus={() => setSearchOpen(Boolean(query))}
          aria-label="Search employees by name, ID, or department" aria-expanded={searchOpen}
          aria-controls={searchOpen ? 'search-lookup-dropdown' : undefined}
          placeholder="Search employees…" autoComplete="off" />
        {searchQuery ? (
          <button type="button" className="tenant-topbar__clear" aria-label="Clear employee search" onClick={() => { updateSearch(''); inputRef.current?.focus(); }}><X size={15} /></button>
        ) : <kbd title="Press Control or Command and K">⌘ / Ctrl K</kbd>}
        {searchOpen && (
          <div id="search-lookup-dropdown" className="tenant-topbar__search-results">
            <div className="tenant-topbar__results-heading"><span>People in your workspace</span><span>{matches.length} found</span></div>
            {matches.length ? matches.map(employee => (
              <button key={employee.userid} type="button" className="tenant-topbar__result" onClick={() => {
                updateSearch(''); onSelectEmployee?.(employee.userid);
              }}>
                <Avatar name={`${employee.first_name || ''} ${employee.last_name || ''}`} src={employee.profile_pic_url} avatarId={employee.avatar_id} size="sm" userid={employee.userid} />
                <span><strong>{employee.first_name} {employee.last_name}</strong><small>{[employee.userid, employee.department].filter(Boolean).join(' · ')}</small></span>
                <ArrowUpRight size={15} />
              </button>
            )) : <div className="tenant-topbar__empty"><Users size={24} /><strong>No employees found</strong><p>Try another name, employee ID, or department.</p></div>}
            <div className="tenant-topbar__search-footer">Search by name, ID, or department <span>Esc to close</span></div>
          </div>
        )}
      </div>

      <div className="tenant-topbar__actions">
        <div id="header-date-greeting" className="tenant-topbar__date">
          <span>{greeting}</span>
          <time dateTime={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`}><CalendarDays size={13} />{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</time>
        </div>
        <NotificationDropdown onOpenNotificationsCenter={onOpenNotifications} />
        <span className="tenant-topbar__action-rule" aria-hidden="true" />
        <div className="tenant-topbar__account" ref={profileRef} onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false);
        }}>
          <button ref={profileButtonRef} id="btn-header-profile-menu" type="button" className="tenant-topbar__profile"
            aria-label={`Account menu for ${name}`} aria-expanded={profileOpen} aria-controls={profileOpen ? 'header-account-panel' : undefined}
            onClick={() => setProfileOpen(open => !open)}>
            <Avatar name={name} src={currentUser?.profile_pic_url} size="sm" avatarId={currentUser?.avatar_id} userid={currentUser?.userid || currentUser?.username} />
            <span className="tenant-topbar__profile-copy"><strong>{name}</strong><small>{role}</small></span>
            <ChevronDown size={14} className={profileOpen ? 'is-open' : ''} />
          </button>
          {profileOpen && <div id="header-account-panel" className="tenant-topbar__account-panel">
            <div className="tenant-topbar__account-summary"><span className="tenant-topbar__eyebrow">YOUR ACCOUNT</span><strong>{name}</strong>{currentUser?.email && <span>{currentUser.email}</span>}<small>{role} · {workspace}</small></div>
            {allUsers.length > 1 && onSwitchUser && <div className="tenant-topbar__personas"><span className="tenant-topbar__eyebrow">SWITCH PERSONA</span>{allUsers.map(user => <button type="button" key={user.userid} onClick={() => { onSwitchUser(user); setProfileOpen(false); }}><span>{user.first_name} {user.last_name}</span><small>{user.type}</small></button>)}</div>}
            <button type="button" className="tenant-topbar__logout" onClick={() => { setProfileOpen(false); onLogout?.(); }}><LogOut size={16} />Sign out<ArrowUpRight size={14} /></button>
          </div>}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
