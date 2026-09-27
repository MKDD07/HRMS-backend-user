import React, { useState, useEffect } from 'react';
import './TenantLayout.css';
import { subscribeNotifications, markAllNotificationsRead } from '../../lib/realtimeNotifications';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Toast, ToastContainer } from '../ui/Toast';
import { Clock, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';

export function AppLayout({
  activePage,
  onNavigate,
  currentUser,
  allUsers,
  onSwitchUser,
  onSelectEmployee,
  todaysAttendance,
  onPunchAttendance,
  onLogout,
  toasts = [],
  onDismissToast,
  children
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  useEffect(() => subscribeNotifications(data => setNotifications(data)), []);

  const [punchLoading, setPunchLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('hrms_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('hrms_sidebar_collapsed', String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  };

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isCheckedIn = Boolean(todaysAttendance?.check_in_time);
  const isCheckedOut = Boolean(todaysAttendance?.check_out_time);

  const handlePunchAction = async (action) => {
    setPunchLoading(true);
    try {
      await onPunchAttendance({
        userid: currentUser.userid,
        action,
        latitude: 19.0657,
        longitude: 72.9984
      });
      setPunchModalOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setPunchLoading(false);
    }
  };

  return (
    <div className="tenant-shell">
        <Topbar
          onToggleSidebar={handleToggleSidebar}
          currentUser={currentUser}
          onSwitchUser={onSwitchUser}
          allUsers={allUsers}
          onSelectEmployee={onSelectEmployee}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onLogout={onLogout}
          unreadCount={notifications.length}
          isCollapsed={sidebarCollapsed}
        />
      <Sidebar
        activeTab={activePage}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentUser={currentUser}
        onLogout={onLogout}
        isCollapsed={sidebarCollapsed && !sidebarOpen}
      />

      <div className={`layout-content ${sidebarCollapsed ? 'layout-content--collapsed' : ''}`}>


        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      {/* Punch In / Out Modal */}
      <Modal
        isOpen={punchModalOpen}
        onClose={() => setPunchModalOpen(false)}
        title="Biometric & Geofenced Time Clock"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[13px] text-[#5F6368]">
              Perimeter: <strong className="text-[#000000]">HQ Infotech Geofence Validated (18m)</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPunchModalOpen(false)}>
                Cancel
              </Button>
              {!isCheckedIn || isCheckedOut ? (
                <Button
                  variant="primary"
                  size="sm"
                  loading={punchLoading}
                  onClick={() => handlePunchAction('punch_in')}
                >
                  Confirm Punch In (Move In)
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  loading={punchLoading}
                  onClick={() => handlePunchAction('punch_out')}
                >
                  Confirm Punch Out (Move Out)
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between">
            <div>
              <p className="text-[13px] text-[#5F6368]">Current Employee</p>
              <h4 className="text-base font-bold text-[#27292C]">
                {currentUser?.first_name} {currentUser?.last_name}
              </h4>
              <p className="text-[13px] text-[#5F6368] font-mono">{currentUser?.userid} • {currentUser?.designation}</p>
            </div>
            <div className="text-right">
              <span className={`px-2.5 py-1 rounded-full text-[13px] font-semibold ${isCheckedIn && !isCheckedOut
                ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                : 'bg-[#F3F4F6] text-[#5F6368]'
                }`}>
                {isCheckedIn && !isCheckedOut ? 'Shift Active' : isCheckedOut ? 'Shift Completed' : 'Not Punched'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="p-3 rounded-lg bg-[#FFFFFF] border border-[#E5E7EB]">
              <span className="text-[#5F6368]">Punch In Record</span>
              <p className="text-sm font-bold text-[#27292C] mt-0.5">
                {todaysAttendance?.check_in_time || '--:--:--'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FFFFFF] border border-[#E5E7EB]">
              <span className="text-[#5F6368]">Punch Out Record</span>
              <p className="text-sm font-bold text-[#27292C] mt-0.5">
                {todaysAttendance?.check_out_time || '--:--:--'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-[13px] text-[#27292C]">
            <MapPin className="w-4 h-4 text-[#27292C] shrink-0" />
            <div>
              <p className="font-semibold text-[#27292C]">Vashi Infotech Park Campus</p>
              <p className="text-[11px] text-[#5F6368]">Latitude: 19.0657, Longitude: 72.9984 (Strict Geofence Active)</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Notifications Drawer/Modal */}
      <Modal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        title="Recent System Notifications"
        footer={
          <div className="flex justify-between w-full items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllNotificationsRead().catch(error => window.alert(error.message))}
            >
              Mark all read
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setNotificationsOpen(false)}
            >
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-[13px] text-[#5F6368] py-6 text-center">No notifications at this time.</p>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-[#FFFFFF] border border-[#E5E7EB] hover:border-[#D1D5DB] transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-bold text-[#27292C]">{item.title}</span>
                  <span className="text-[10px] text-[#5F6368]">{item.timeAgo || item.time}</span>
                </div>
                <p className="text-[13px] text-[#5F6368] leading-relaxed">{item.message}</p>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Global Toast Alerts */}
      <ToastContainer>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onClose={() => onDismissToast(toast.id)}
          />
        ))}
      </ToastContainer>
    </div>
  );
}
