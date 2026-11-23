import { useStickyDashboardColumns } from './useStickyDashboardColumns';
import { EmployeeMovements } from './EmployeeMovements';
import { SigninActivity } from './SigninActivity';
import { HiringPipeline } from './HiringPipeline';
import { PayrollSummary } from './PayrollSummary';
import { UpcomingHolidays } from './UpcomingHolidays';
import { DepartmentHeadcount } from './DepartmentHeadcount';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import React, { useState } from 'react';
import { ArrowUpRight, BellRing, BriefcaseBusiness, Cake, CalendarDays, ClipboardCheck, CreditCard, Gift, Megaphone, PartyPopper, Plus, Sparkles, Users, UserCheck, TrendingDown, X } from 'lucide-react';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { Button } from '../../components/ui/Button';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { Avatar } from '../../components/ui/Avatar';

import { ExpandableList } from '../../components/ui/ExpandableList';
import { OverviewChart, ChartHelp } from './OverviewChart';
import { OverviewApprovals, OverviewNotifications } from './OverviewInbox';

const count = value => value == null ? '—' : value;

export function OverviewWorkspace({ data, loading, currentUser, onNavigate, onRefresh, onAddEmployee, onPostAnnouncement, onSelectPeriod }) {
  const columnsRef = useStickyDashboardColumns();
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const metric = key => data.metrics.find(item => item.key === key)?.value;
  const unavailable = keys => keys.some(key => data.errors[key]);
  const actions = (page, label, id = page) => data.permissions[page] ? <Button id={`dashboard-open-${id}`} variant="outline" viewAll aria-label={label} title={label} onClick={() => onNavigate(page)} /> : null;
  const payroll = data.payroll, workforce = data.workforce;
  const attendancePeople = data.lists.employees || [];
  const attendancePreview = data.lists.attendancePreview || attendancePeople.slice(0, 5);
  const attendanceOverflow = Math.max(0, attendancePeople.length - attendancePreview.length);
  const stages = data.recruitment ? ['Applied', 'Screening', 'Interview', 'Offer', 'Joined'].map(name => ({ name, count: data.recruitment.stages.filter(row => row.name === ({ Offer: 'Offered', Joined: 'Hired' }[name] || name)).reduce((total, row) => total + row.count, 0) })) : [];
  const sideList = (items, empty, renderItem) => <ExpandableList items={items} empty={empty} limit={3} renderItem={renderItem} />;
  const kpis = [
    { title: 'Total headcount', value: metric('employees'), note: 'Active employees', icon: Users, page: 'employees' },
    { title: data.to === data.today ? 'Present today' : 'Present · ' + data.to, value: unavailable(['attendance', 'shifts', 'calendar', 'leaves']) ? null : workforce?.present ?? data.trend.at(-1)?.present, note: `${count(metric('onLeave'))} on leave · ${count(metric('absent'))} absent`, icon: UserCheck, page: 'attendance' },
    { title: 'Open positions', value: unavailable(['talent']) ? null : data.recruitment?.positions, note: data.recruitment ? 'Across matching job openings' : 'Not available in this scope', icon: BriefcaseBusiness, page: 'recruitment' },
    { title: 'Pending approvals', value: workforce?.pendingApprovals, note: 'Leave · expenses · attendance', icon: ClipboardCheck, page: 'leave' },
    { title: 'Monthly attrition', value: workforce?.attritionRate == null ? null : workforce.attritionRate + '%', note: `${data.to.slice(0, 7)} · ${workforce?.incomplete ? 'Employee dates incomplete' : 'Month to date'}`, icon: TrendingDown, page: 'analytics' },
  ];
  return <>
    <MetricOverview loading={loading} aria-label="Workforce overview" aria-busy={loading}>
      {kpis.map(({ title, value, note, icon: Icon, page }) => {
        const canNavigate = page && data.permissions[page];
        return (
          <MetricCard key={title} onClick={canNavigate ? () => onNavigate(page) : undefined} title={canNavigate ? `Navigate to ${title}` : undefined} loading={loading} label={title} icon={Icon} value={count(value)} caption={note} />
        );
      })}
    </MetricOverview>
    <div className="workspace-grid overview-top-grid">
      <div className="overview-top-attendance">
        <TenantPanel title={<><span>Attendance trend</span><ChartHelp>Absence uses current shift schedules; holidays and approved leave are excluded.</ChartHelp></>} subtitle="Daily attendance across your selected dates." controls={<DateRangePicker label="Attendance date range" from={data.from} to={data.to} max={data.today} onChange={onSelectPeriod} />}>
          <OverviewChart kind="attendance" labelKey="date" label="Daily attendance" data={data.trend} series={[{ key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' }, { key: 'leave', label: 'On leave' }]} unavailable={unavailable(['attendance', 'shifts', 'calendar', 'leaves'])} />
        </TenantPanel>
      </div>
      <div className="overview-top-notifications"><OverviewNotifications /></div>
      {data.permissions.attendance && (
        <TenantPanel
          className="overview-attendance-banner"
          title="Attendance & Logs Console"
          subtitle="Review punch logs, check employee attendance, and submit corrections."
          controls={<>
            {attendancePreview.length > 0 && (
              <div>
                <span className="sr-only">{attendancePeople.length} employees in this view</span>
                <div className="overview-attendance-avatars" aria-hidden="true">
                  {attendancePreview.map(person => (
                    <Avatar key={person.user_id} name={person.name} src={person.profile_pic_url} userid={person.user_id} size="xs" />
                  ))}
                  {attendanceOverflow > 0 && <span className="overview-attendance-overflow">+{attendanceOverflow}</span>}
                </div>
              </div>
            )}
            <Button endIcon={ArrowUpRight} onClick={() => onNavigate('attendance')}>Open console</Button>
          </>}
        />
      )}
    </div>
    <div ref={columnsRef} className="workspace-grid">
      <section className="overview-main-column" aria-label="Workforce analytics">
        <TenantPanel icon={Users} title="Headcount by department" subtitle="How your active workforce is distributed">
          <DepartmentHeadcount data={data.departments} unavailable={unavailable(['people'])} />
        </TenantPanel>
        <div className="workspace-grid overview-workforce-pair">
          {data.recruitment && <TenantPanel icon={BriefcaseBusiness} title="Hiring pipeline" subtitle={`${data.recruitment.positions} open positions · Current candidate stages`} controls={actions('recruitment', 'Recruitment')}>
            <HiringPipeline stages={stages} positions={data.recruitment.positions} unavailable={unavailable(['talent'])} />
          </TenantPanel>}
          <TenantPanel icon={Users} title="Employee movements" subtitle={`${data.to.slice(0, 7)} · Recent joiners and exits`} controls={actions('employees', 'Directory')}>
            {unavailable(['talent']) && <p className="overview-inline-error">Exit-plan data is unavailable; recorded employee dates are shown.</p>}
            <EmployeeMovements people={workforce?.recent || []} />
          </TenantPanel>
        </div>
        {payroll && <TenantPanel title="Payroll summary" subtitle={`${payroll.month} payroll cycle`} icon={CreditCard} controls={actions('payroll', 'Open payroll')}>
          <PayrollSummary payroll={payroll} />
        </TenantPanel>}
      </section>
      <aside className="overview-side-column" aria-label="Updates and actions">
        <SigninActivity currentUser={currentUser} />
        <OverviewApprovals data={data} currentUser={currentUser} onChanged={onRefresh} onNavigate={onNavigate} />
        {data.lists.leaveThisWeek?.length > 0 && !unavailable(['leaves']) && <TenantPanel title="Who's on leave" subtitle={data.to === data.today ? 'Today and the rest of this week' : 'From selected day to the end of the week'} icon={CalendarDays} className="card--purple" controls={actions('leave', 'Leave')}>
          {sideList(data.lists.leaveThisWeek || [], 'No approved leave this week.', person => <article className="overview-list-row" key={person.id}><span className="overview-avatar" aria-hidden="true">{person.name?.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div className="overview-row-copy"><strong>{person.name}</strong><p>{person.detail}</p><small>{person.onToday ? 'On leave · ' : ''}{person.date} — {person.end_date}</small></div></article>)}
        </TenantPanel>}
        {data.celebrations?.length > 0 && <TenantPanel title="Celebrations" subtitle="Birthdays & work anniversaries this week" icon={PartyPopper} className="card--celebrations">
          {sideList(data.celebrations, 'No celebrations this week.', item => {
            const isBirthday = String(item.detail || '').toLowerCase().includes('birthday');
            return (
              <article className={`overview-celebration-card ${isBirthday ? 'is-birthday' : 'is-anniversary'}`} key={item.id + item.detail + item.date}>
                <Avatar className="overview-celebration-photo" size="sm" name={item.name} src={item.profile_pic_url} userid={item.user_id} />
                <div className="overview-celebration-info">
                  <div className="overview-celebration-top">
                    <strong>{item.name}</strong>
                    <span className="overview-celebration-pill">{isBirthday ? 'Birthday' : 'Work anniversary'}</span>
                  </div>
                  <p>{item.detail}</p>
                </div>
                <div className="overview-celebration-date">
                  <span>{item.date === data.today ? 'Today' : new Date(item.date + 'T12:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              </article>
            );
          })}
        </TenantPanel>}
        <TenantPanel title="Upcoming holidays" subtitle="Company calendar" icon={CalendarDays} className="card--celebrations overview-holidays" controls={actions('company-calendar', 'Calendar')}>
          <UpcomingHolidays holidays={data.holidays} today={data.today} unavailable={unavailable(['calendar'])} />
        </TenantPanel>
      </aside>
    </div>

    {/* Fixed Floating Announcements Trigger on Bottom Right */}
    <aside className="announcement-floating-container" style={{display:"flex",gap:12}} aria-label="Quick workspace actions">
      <Button type="button" className="announcement-fab" onClick={() => setShowAnnouncements(true)} aria-label="View announcements" title="View announcements" variant="colored" wrapContent={false} iconOnly>
        <div className="announcement-fab-icon">
          <Megaphone size={18} />
          {data.announcements?.length > 0 && (
            <span className="announcement-fab-badge">{data.announcements.length}</span>
          )}
        </div>
      </Button>
    </aside>

    {/* Slide-in Animated App Drawer for Announcements */}
    {showAnnouncements && (
      <div className="announcements-drawer-overlay" onClick={() => setShowAnnouncements(false)}>
        <aside
          className="announcements-drawer"
          role="dialog"
          aria-labelledby="announcements-drawer-title"
          onClick={e => e.stopPropagation()}
        >
          <header className="announcements-drawer-header">
            <div className="announcements-drawer-title-wrap">
              <div className="announcements-drawer-icon">
                <Megaphone size={18} />
              </div>
              <div>
                <h3 id="announcements-drawer-title">Announcements</h3>
                <p>Latest company notices & broadcasts</p>
              </div>
            </div>
            <div className="announcements-drawer-header-actions">
              {data.permissions.helpdesk && onPostAnnouncement && (
                <Button size="sm" variant="fadeout" iconOnly aria-label="Post announcement" title="Post announcement" icon={Plus} onClick={() => {
  setShowAnnouncements(false);
  onPostAnnouncement();
}}>
                </Button>
              )}
              <Button type="button" className="announcements-drawer-close" onClick={() => setShowAnnouncements(false)} aria-label="Close drawer" variant="fadeout" wrapContent={false} iconOnly={true} size="sm">
                <X size={18} />
              </Button>
            </div>
          </header>
          <div className="announcements-drawer-body">
            {unavailable(['announcements']) ? (
              <p className="tenant-empty">Announcements unavailable.</p>
            ) : !data.announcements?.length ? (
              <div className="tenant-empty">No published notices at this time.</div>
            ) : (
              <div className="announcements-drawer-list">
                {data.announcements.map((item, index) => (
                  <article className="announcement-drawer-item" key={item.id || index}>
                    <div className="announcement-drawer-head">
                      <strong>{item.title}</strong>
                      {item.audience && <span className="announcement-audience-tag">{item.audience}</span>}
                    </div>
                    <p className="announcement-drawer-text">{item.body}</p>
                    {item.date && (
                      <time className="announcement-drawer-date">
                        {item.date}
                      </time>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
          {data.permissions.helpdesk && (
            <footer className="announcements-drawer-footer">
              <Button variant="outline" size="sm" endIcon={ArrowUpRight} onClick={() => {
  setShowAnnouncements(false);
  onNavigate('helpdesk');
}}>
                Open HR Connect Hub
              </Button>
            </footer>
          )}
        </aside>
      </div>
    )}
  </>;
}
