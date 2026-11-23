import { Button } from '../ui/Button';
import { canUsePage } from '../../../shared/dashboardAccess.mjs';
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Mail, Users, Clock, CalendarDays, CreditCard, Briefcase, UserPlus, UserMinus, Target, GraduationCap, FolderLock, MessagesSquare, Sliders, MapPin, DollarSign, ChevronRight, Search, X, PanelsTopLeft, ClipboardList } from 'lucide-react';
import './Sidebar.scss';
import { mailApi } from '../../lib/mailApi';
import { UniversalSearch } from '../ui/UniversalSearch';

const NAV_SECTIONS = [
  {
    title: 'Workforce & Org',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'employees', label: 'Employee Directory', icon: Users },
      { id: 'departments', label: 'Departments', icon: Users },
      { id: 'regularization', label: 'Regularization', icon: ClipboardList },
      { id: 'documents', label: 'Document Vault', icon: FolderLock }
    ]
  },
  {
    title: 'Time & Attendance',
    items: [
      { id: 'attendance', label: 'Attendance & Logs', icon: Clock },
      { id: 'shifts', label: 'Shifts & Schedules', icon: Clock },
      { id: 'leave', label: 'Leaves & Holidays', icon: CalendarDays },
      { id: 'company-calendar', label: 'Company Calendar', icon: CalendarDays },
      { id: 'hr-calendar', label: 'HR Calendar & Planner', icon: CalendarDays },
      { id: 'geofence-rules', label: 'Geofence & Photo Rules', icon: MapPin },
      { id: 'timesheets', label: 'Projects & Timesheets', icon: Clock }
    ]
  },
  {
    title: 'Payroll & Compensation',
    items: [
      { id: 'payroll', label: 'Salary & Payroll', icon: CreditCard },
      { id: 'salary-structure', label: 'Structures & Payslip Studio', icon: DollarSign },
      { id: 'expenses', label: 'Expenses & Claims', icon: CreditCard },
      { id: 'benefits', label: 'Benefits & Insurance', icon: Briefcase }
    ]
  },
  {
    title: 'Talent & Growth',
    items: [
      { id: 'recruitment', label: 'Recruitment & ATS', icon: Briefcase },
      { id: 'onboarding', label: 'Onboarding & Checklists', icon: UserPlus },
      { id: 'offboarding', label: 'Offboarding & Exit', icon: UserMinus },
      { id: 'performance', label: 'Goals & OKRs', icon: Target },
      { id: 'appraisals', label: 'Appraisal Reviews', icon: Target },
      { id: 'learning', label: 'Learning & Development', icon: GraduationCap }
    ]
  },
  {
    title: 'Workplace & Reports',
    items: [
      { id: 'mail', label: 'Mail', icon: Mail },
      { id: 'helpdesk', label: 'HR Connect', icon: MessagesSquare },
      { id: 'surveys', label: 'Employee Surveys', icon: MessagesSquare },
      { id: 'assets', label: 'Asset Management', icon: Briefcase },
      { id: 'reports', label: 'Reports', icon: PanelsTopLeft },
      { id: 'hr-analytics', label: 'HR Analytics', icon: PanelsTopLeft }
    ]
  },
  {
    title: 'System & Security',
    items: [
      { id: 'settings', label: 'Settings', icon: Sliders },
      { id: 'dashboard-users', label: 'Dashboard Users', icon: Users }
    ]
  }
];

export function Sidebar({ activeTab, onNavigate, isOpen, onClose, isCollapsed = false, currentUser }) {
  const [navSearch, setNavSearch] = useState('');
  const [unreadMail, setUnreadMail] = useState(0);
  useEffect(() => {
    setUnreadMail(0);
    if (!currentUser || !canUsePage(currentUser, 'mail')) return;
    let disposed = false, pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try { const folders = await mailApi.folders(); if (!disposed) setUnreadMail(Number(folders.find(folder => folder.path === 'INBOX')?.unread) || 0); }
      catch { /* Mail availability must not block navigation. */ }
      finally { pending = false; }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('mail:updated', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener('mail:updated', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [currentUser?.userid, currentUser?.user_id]);
  useEffect(() => {
    if (!isOpen) return;
    const close = event => { if (event.key === 'Escape') { onClose?.(); document.getElementById('btn-toggle-sidebar')?.focus(); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [isOpen, onClose]);
  return <>
    {isOpen && <div className="tenant-sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
    <aside id="tenant-admin-sidebar" className={['tenant-sidebar', isOpen && 'tenant-sidebar--open', isCollapsed && 'tenant-sidebar--collapsed'].filter(Boolean).join(' ')} aria-label="Administration sidebar">
      <div className="tenant-sidebar__search"><UniversalSearch scope="sidebar" variant="compact" label="Search navigation" placeholder="Search pages..." value={navSearch} onChange={setNavSearch} /></div>
      <nav className="tenant-sidebar__nav" aria-label="Main navigation">
        {NAV_SECTIONS.map(section => ({ ...section, items: section.items.filter(item => canUsePage(currentUser ? {...currentUser,plan_pages:undefined} : currentUser, item.id) && (!navSearch.trim() || `${section.title} ${item.label}`.toLowerCase().includes(navSearch.trim().toLowerCase()))) })).filter(section => section.items.length).map(section => <section key={section.title} className="tenant-sidebar__section"><h2>{section.title}</h2>{section.items.map(item => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return <Button type="button" key={item.id} className={'tenant-sidebar__link' + (active ? ' is-active' : '')} disabled={!canUsePage(currentUser,item.id)} aria-current={active ? 'page' : undefined} aria-label={item.id === 'mail' && unreadMail ? `Mail, ${unreadMail} unread messages` : item.label} title={isCollapsed ? item.label : undefined} onClick={() => {
  onNavigate(item.id);
  onClose?.();
}} variant={active ? "colored" : "fadeout"} wrapContent={false} layout="row"><Icon size={18} />{item.id==='mail'&&unreadMail>0&&<i className="tenant-sidebar__mail-dot" aria-hidden="true"/>}<span>{item.label}</span>{item.id==='mail'&&unreadMail>0&&!isCollapsed&&<small className="tenant-sidebar__mail-count" aria-hidden="true">{unreadMail>99?'99+':unreadMail}</small>}{active && <ChevronRight size={14} className="tenant-sidebar__active-arrow" />}</Button>;
        })}</section>)}
      </nav>
    </aside>
  </>;
}
