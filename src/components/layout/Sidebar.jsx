import { canUsePage } from '../../../shared/dashboardAccess.mjs';
import React, { useEffect } from 'react';
import { LayoutDashboard, Users, Clock, CalendarDays, CreditCard, Briefcase, UserPlus, UserMinus, Target, GraduationCap, FolderLock, MessagesSquare, Sliders, MapPin, DollarSign, GitBranch, ChevronRight, X, PanelsTopLeft } from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'Core Administration',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'employees', label: 'Employee Directory', icon: Users },
      { id: 'hierarchy', label: 'Org Hierarchy Matrix', icon: GitBranch },
      { id: 'attendance', label: 'Attendance & Logs', icon: Clock },
      { id: 'geofence-rules', label: 'Geofence & Photo Rules', icon: MapPin },
      { id: 'leave', label: 'Leaves & Holidays', icon: CalendarDays },
      { id: 'company-calendar', label: 'Company Calendar', icon: CalendarDays },
      { id: 'payroll', label: 'Payroll & CTC', icon: CreditCard },
      { id: 'salary-structure', label: 'Edit Salary & Structure', icon: DollarSign }
    ]
  },
  {
    title: 'Talent & Operations',
    items: [
      { id: 'recruitment', label: 'Recruitment & ATS', icon: Briefcase },
      { id: 'onboarding', label: 'Onboarding & Checklists', icon: UserPlus },
      { id: 'offboarding', label: 'Offboarding & Exit', icon: UserMinus },
      { id: 'performance', label: 'Goals & OKRs', icon: Target },
      { id: 'assets', label: 'Assets', icon: Briefcase },
      { id: 'reports', label: 'Reports', icon: PanelsTopLeft },
      { id: 'learning', label: 'Learning & Development', icon: GraduationCap }
    ]
  },
  {
    title: 'Organization Governance',
    items: [
      { id: 'documents', label: 'Document Vault', icon: FolderLock },
      { id: 'helpdesk', label: 'HR Connect', icon: MessagesSquare },
      { id: 'shifts', label: 'Shifts', icon: Clock },
      { id: 'settings', label: 'Settings', icon: Sliders },
      { id: 'dashboard-users', label: 'Dashboard Users', icon: Users }
    ]
  }
];

export function Sidebar({ activeTab, onNavigate, isOpen, onClose, isCollapsed = false, currentUser }) {
  useEffect(() => {
    if (!isOpen) return;
    const close = event => { if (event.key === 'Escape') { onClose?.(); document.getElementById('btn-toggle-sidebar')?.focus(); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [isOpen, onClose]);
  return <>
    {isOpen && <button type="button" className="tenant-sidebar-backdrop" onClick={onClose} aria-label="Close navigation" />}
    <aside id="tenant-admin-sidebar" className={['tenant-sidebar', isOpen && 'tenant-sidebar--open', isCollapsed && 'tenant-sidebar--collapsed'].filter(Boolean).join(' ')} aria-label="Administration sidebar">
      <nav className="tenant-sidebar__nav" aria-label="Main navigation">
        {NAV_SECTIONS.map(section => ({ ...section, items: section.items.filter(item => canUsePage(currentUser, item.id)) })).filter(section => section.items.length).map(section => <section key={section.title} className="tenant-sidebar__section"><h2>{section.title}</h2>{section.items.map(item => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return <button type="button" key={item.id} className={'tenant-sidebar__link' + (active ? ' is-active' : '')} aria-current={active ? 'page' : undefined} aria-label={item.label} title={isCollapsed ? item.label : undefined} onClick={() => { onNavigate(item.id); onClose?.(); }}><Icon size={18} /><span>{item.label}</span>{active && <ChevronRight size={14} className="tenant-sidebar__active-arrow" />}</button>;
        })}</section>)}
      </nav>
    </aside>
  </>;
}
