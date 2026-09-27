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
import { canUseDashboard, canUsePage } from '../shared/dashboardAccess.mjs';
import { SalaryStructurePage } from './pages/salary/SalaryStructurePage';
import { GeofenceRulesPage } from './pages/geofence/GeofenceRulesPage';
import { HierarchyMatrixPage } from './pages/hierarchy/HierarchyMatrixPage';
import { hrmsApi } from './lib/api';
import { companyAuth } from './lib/companyAuth';

export default function App() {
  const [requestedPage, setActivePage] = useState('dashboard');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const activePage = canUsePage(currentUser, requestedPage) ? requestedPage : currentUser?.dashboard_pages?.[0] || 'dashboard';
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

  // Initialize Auth & Users
  useEffect(() => {
    async function init() {
      try {
        const token = hrmsApi.getAuthToken();
        if (token) {
          try {
            const user = await companyAuth.verify(token);
            if (!canUseDashboard(user) || user.must_change_password) throw new Error('Administrator sign-in required.');
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
    setActivePage('dashboard');
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
    const timer = setInterval(async () => {
      try { const verified = await companyAuth.verify(hrmsApi.getAuthToken()); if (!canUseDashboard(verified)) throw new Error(); setCurrentUser(previous => ({ ...previous, ...verified })); }
      catch { companyAuth.clear(); setCurrentUser(null); }
    }, 30000);
    return () => clearInterval(timer);
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
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-[#5F6368] hover:text-[#27292C]"
              >
                &times;
              </button>
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
      {activePage === 'dashboard' && (
        <DashboardPage
          currentUser={currentUser}
          onNavigate={(page) => {
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

      {activePage === 'hierarchy' && (
        <HierarchyMatrixPage currentUser={currentUser}
          api={hrmsApi}
          onSelectEmployee={handleSelectEmployee}
          onShowToast={showToast}
        />
      )}

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
          api={hrmsApi}
          onShowToast={showToast}
        />
      )}

      {activePage === 'performance' && (
        <PerformancePage
          api={hrmsApi}
          currentUser={currentUser}
          onShowToast={showToast}
        />
      )}

      {activePage === 'assets' && (
        <AssetsPage
          api={hrmsApi}
          onShowToast={showToast}
        />
      )}

      {activePage === 'helpdesk' && <HRConnectPage api={hrmsApi} onShowToast={showToast} onNavigate={setActivePage} />}

      {activePage === 'documents' && (
        <DocumentsPage
          api={hrmsApi}
          onShowToast={showToast}
        />
      )}

      {activePage === 'reports' && (
        <ReportsPage
          api={hrmsApi}
          onShowToast={showToast}
        />
      )}

      {activePage === 'settings' && <WorkspaceSettingsPage currentUser={currentUser} onNavigate={setActivePage} onLogout={handleLogout} />}
      {activePage === 'dashboard-users' && currentUser.role === 'company_admin' && <DashboardUsersPage />}
      {activePage === 'shifts' && <ShiftsPage />}
    </AppLayout>
  );
}
