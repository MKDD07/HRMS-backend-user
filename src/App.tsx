import { MailPage } from './pages/mail/MailPage';
import { SearchDesignPage } from './pages/settings/SearchDesignPage';
import { CalendarPanel } from './components/layout/HeaderCalendar';
import { DepartmentsPage } from './pages/departments/DepartmentsPage';
import { RegularizationPage } from './pages/departments/RegularizationPage';
import { Button } from './components/ui/Button';
import { TalentWorkspace } from './pages/talent/TalentWorkspace';
import { OperationsPage } from './pages/operations/OperationsPage';
import { HRAnalyticsPage } from './pages/operations/HRAnalyticsPage';
import { AppraisalsPage } from './pages/appraisals/AppraisalsPage';
import { dashboardAdminApi } from './lib/dashboardAdminApi';
import { cacheCompanyShifts } from './lib/shiftStore';
﻿import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { EmployeesPage } from './pages/employees/EmployeesPage';
import { EmployeeDetailPage } from './pages/employees/EmployeeDetailPage';
import { AttendancePage } from './pages/attendance/AttendancePage';
import { LeavePage } from './pages/leave/LeavePage';
import { CompanyCalendarPage } from './pages/company-calendar/CompanyCalendarPage';
import { PayrollPage } from './pages/payroll/PayrollPage';
import { RecruitmentPage } from './pages/recruitment/RecruitmentPage';
import { PerformancePage } from './pages/performance/PerformancePage';
import { AssetsPage } from './pages/assets/AssetsPage';
import { HRConnectPage } from './pages/hr-connect/HRConnectPage';
import { DocumentsPage } from './pages/documents/DocumentsPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { WorkspaceSettingsPage } from './pages/settings/WorkspaceSettingsPage';
import { DashboardUsersPage } from './pages/settings/DashboardUsersPage';
import { ShiftsPage } from './pages/settings/ShiftsPage';
import { canUseDashboard, canSignInWorkspace, canUsePage } from '../shared/dashboardAccess.mjs';
import { SalaryStructurePage } from './pages/salary/SalaryStructurePage';
import { GeofenceRulesPage } from './pages/geofence/GeofenceRulesPage';
import { hrmsApi } from './lib/api';
import { companyAuth } from './lib/companyAuth';

export default function App() {
  const [documentLocation,setDocumentLocation] = useState(null);
  const [requestedPage, setActivePage] = useState('dashboard');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const resolvedPage = requestedPage === 'hierarchy' ? 'departments' : requestedPage;
  const activePage = (resolvedPage === 'search-design' && canUseDashboard(currentUser) || canUsePage(currentUser, resolvedPage)) ? resolvedPage : currentUser?.dashboard_pages?.[0] || 'appraisals';
  const [allUsers, setAllUsers] = useState([]);
  const [todaysAttendance, setTodaysAttendance] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Toast dispatch helper
  const showToast = useCallback(({ type = 'info', title, message }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);


  useEffect(() => { const locate = event => { if (!canUsePage(currentUser,'documents')) return; setDocumentLocation({ ...event.detail,id:crypto.randomUUID() }); setActivePage('documents'); }; window.addEventListener('aster-document-location',locate); return () => window.removeEventListener('aster-document-location',locate); }, [currentUser]);
  useEffect(() => { setDocumentLocation(null); }, [currentUser?.company_id]);

  // Initialize Auth & Users
  useEffect(() => {
    async function init() {
      try {
        const token = hrmsApi.getAuthToken();
        if (token) {
          try {
            const user = await companyAuth.verify(token);
            if (!canSignInWorkspace(user) || user.must_change_password) throw new Error('Company sign-in required.');
            await companyAuth.syncBrand(user.company_id);
            setCurrentUser({ ...user, first_name: user.first_name || user.name || user.username });
          } catch { companyAuth.clear(); }
        }

      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoadingInitial(false);
      }
    }
    init();
  }, []);

  const handleLoginSuccess = async (user) => {
    await companyAuth.syncBrand(user.company_id);
    setCurrentUser(user);
    setActivePage(canUseDashboard(user) ? 'dashboard' : 'appraisals');
    setAllUsers([]);
    setTodaysAttendance(null);
  };

  const handleLogout = () => {
    const token = hrmsApi.getAuthToken();
    if (token) companyAuth.logout(token).catch(() => {});
    companyAuth.clear();
    setAllUsers([]);
    setCurrentUser(null);
    setTodaysAttendance(null);
    showToast({
      type: 'info',
      title: 'Signed Out',
      message: 'You have been safely signed out of PulseHRMS.'
    });
  };

  useEffect(() => {
    if (!currentUser) return;
    const refreshPermissions = async () => {
      try { const verified = await companyAuth.verify(hrmsApi.getAuthToken()); if (!canSignInWorkspace(verified)) throw new Error(); setCurrentUser(previous => ({ ...previous, ...verified })); }
      catch { companyAuth.clear(); setCurrentUser(null); }
    };
    const timer=setInterval(refreshPermissions,30000);
    window.addEventListener('pulse-permissions-updated',refreshPermissions);
    return () => {clearInterval(timer);window.removeEventListener('pulse-permissions-updated',refreshPermissions);};
  }, [currentUser?.userid]);

  useEffect(() => { if (currentUser?.company_id) dashboardAdminApi.configuration('shifts').then(result => cacheCompanyShifts(result.value)).catch(() => {}); }, [currentUser?.company_id]);

  // Switch persona (e.g. Admin to HR Admin)
  const handleSwitchUser = () => { showToast({ type: 'info', title: 'Separate sign-in required', message: 'Sign out before using another account.' }); };

  const handlePunchAttendance = async ({ action, latitude, longitude, photo_url }) => {
    if (!currentUser) return;
    try {
      const res = await hrmsApi.markAttendance({
        userid: currentUser.userid,
        action,
        latitude: latitude || 19.0657,
        longitude: longitude || 72.9984,
        photo_url
      });

      if (res.data) {
        setTodaysAttendance(res.data);
      }

      showToast({
        type: 'success',
        title: action === 'punch_in' ? 'Shift Punch In Recorded' : 'Shift Punch Out Recorded',
        message:
          action === 'punch_in'
            ? 'Checked in at HQ campus. Attendance logged in live database.'
            : 'Clocked out successfully. Total shift duration calculated.'
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Punch Failed',
        message: err.message
      });
    }
  };

  const handleSelectEmployee = (userid) => {
    setSelectedEmployeeId(userid);
    setActivePage('employee-detail');
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center text-[#5F6368] space-y-3">
        <div className="w-8 h-8 border-2 border-[#27292C] border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] font-medium text-[#5F6368]">
          Connecting to Cloudflare Worker & D1 Database...
        </p>
      </div>
    );
  }

  // Not Authenticated: Render Login Page
  if (!currentUser) {
    return (
      <>
      <LoginPage onLoginSuccess={handleLoginSuccess} />
        {/* Toast Alerts on Login */}
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="p-3 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg shadow-lg text-[13px] flex items-center justify-between gap-3 text-[#27292C]"
            >
              <span>{toast.message}</span>
              <Button type="button" onClick={() => dismissToast(toast.id)} className="" variant="outline" wrapContent={false}>
                &times;
              </Button>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <AppLayout
      activePage={activePage}
      onNavigate={(page) => {
        setActivePage(page);
        if (page !== 'employee-detail') {
          setSelectedEmployeeId(null);
        }
      }}
      currentUser={currentUser}
      allUsers={allUsers}
      onSwitchUser={handleSwitchUser}
      onSelectEmployee={handleSelectEmployee}
      todaysAttendance={todaysAttendance}
      onPunchAttendance={handlePunchAttendance}
      onLogout={handleLogout}
      toasts={toasts}
      onDismissToast={dismissToast}
    >
      {activePage === 'search-design' && <SearchDesignPage currentUser={currentUser} onNavigate={setActivePage} />}
      {activePage === 'dashboard' && (
        <DashboardPage
          currentUser={currentUser}
          onNavigate={(page, employeeId) => {
            if (page === 'employee-detail' && employeeId) { handleSelectEmployee(employeeId); return; }
            setActivePage(page);
            if (page !== 'employee-detail') setSelectedEmployeeId(null);
          }}
          api={hrmsApi}
          onShowToast={showToast}
        />
      )}

      {activePage === 'employees' && (
        <EmployeesPage
          api={hrmsApi}
          onSelectEmployee={handleSelectEmployee}
          onShowToast={showToast}
          onNavigate={(page) => setActivePage(page)}
        />
      )}

      {activePage === 'departments' && <DepartmentsPage currentUser={currentUser} onSelectEmployee={handleSelectEmployee} onShowToast={showToast} />}
      {activePage === 'regularization' && <RegularizationPage currentUser={currentUser} />}


      {activePage === 'employee-detail' && selectedEmployeeId && (
        <EmployeeDetailPage
          userid={selectedEmployeeId}
          api={hrmsApi}
          onBack={() => setActivePage('employees')}
          onShowToast={showToast}
        />
      )}

      {activePage === 'attendance' && (
        <AttendancePage
          currentUser={currentUser}
          api={hrmsApi}
          todaysAttendance={todaysAttendance}
          onPunchAttendance={handlePunchAttendance}
          onShowToast={showToast}
        />
      )}

      {activePage === 'leave' && (
        <LeavePage
          currentUser={currentUser}
          allUsers={allUsers}
          api={hrmsApi}
          onShowToast={showToast}
        />
      )}

      {activePage === 'hr-calendar' && <CalendarPanel fullPage currentUser={currentUser} allUsers={allUsers} />}
      {activePage === 'company-calendar' && (
        <CompanyCalendarPage api={hrmsApi} onShowToast={showToast} />
      )}

      {activePage === 'payroll' && (
        <PayrollPage
          api={hrmsApi}
          currentUser={currentUser}
          allUsers={allUsers}
          onShowToast={showToast}
        />
      )}

      {activePage === 'salary-structure' && (
        <SalaryStructurePage
          api={hrmsApi}
          onShowToast={showToast}
          onSelectEmployee={handleSelectEmployee}
        />
      )}

      {activePage === 'geofence-rules' && (
        <GeofenceRulesPage
          api={hrmsApi}
          onShowToast={showToast}
          onSelectEmployee={handleSelectEmployee}
        />
      )}

      {activePage === 'recruitment' && (
        <RecruitmentPage
          currentUser={currentUser}
          api={hrmsApi}
          onShowToast={showToast}
        />
      )}

      {['onboarding', 'offboarding', 'learning'].includes(activePage) && <TalentWorkspace key={activePage} module={activePage} currentUser={currentUser} onShowToast={showToast} />}

      {activePage === 'performance' && (
        <PerformancePage
          api={hrmsApi}
          currentUser={currentUser}
          onShowToast={showToast}
        />
      )}

      {activePage === 'assets' && (
        <AssetsPage
          currentUser={currentUser}
          api={hrmsApi}
          onShowToast={showToast}
        />
      )}

      {activePage === 'mail' && <MailPage currentUser={currentUser} />}
      {activePage === 'helpdesk' && <HRConnectPage api={hrmsApi} onShowToast={showToast} onNavigate={setActivePage} />}

      {activePage === 'documents' && (
        <DocumentsPage location={documentLocation}
          api={hrmsApi}
          onShowToast={showToast}
        />
      )}

      {activePage === 'appraisals' && <AppraisalsPage onShowToast={showToast} />}
      {['expenses', 'benefits', 'surveys', 'timesheets'].includes(activePage) && <OperationsPage key={activePage} module={activePage} currentUser={currentUser} onShowToast={showToast} />}
      {activePage === 'hr-analytics' && <HRAnalyticsPage />}
      {activePage === 'reports' && (
        <ReportsPage
          currentUser={currentUser}
        />
      )}

      {activePage === 'settings' && <WorkspaceSettingsPage currentUser={currentUser} onNavigate={setActivePage} onLogout={handleLogout} />}
      {activePage === 'dashboard-users' && currentUser.role === 'company_admin' && <DashboardUsersPage />}
      {activePage === 'shifts' && <ShiftsPage />}
    </AppLayout>
  );
}
