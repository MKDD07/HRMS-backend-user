import { legacyDashboardGuard } from './server/dashboardAuthorization.mjs';
﻿import 'dotenv/config';
import { createCompanyAuthRouter } from './server/companyAuthRoutes.mjs';
import { createPayrollRouter } from './server/payrollRoutes.mjs';
import { createCompanyCalendarRouter } from './server/companyCalendarRoutes.mjs';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use('/api/company-auth', createCompanyAuthRouter());
const PORT = 3000;
const server = http.createServer(app);

app.use('/api/payroll-studio', createPayrollRouter());
app.use('/api/company-calendar', createCompanyCalendarRouter());
app.use(express.json());
app.use('/api', legacyDashboardGuard());

// Persistent store file for notifications
const STORE_PATH = path.join(process.cwd(), 'notifications_store.json');

interface NotificationUser {
  name: string;
  userid: string;
  profile_pic_url?: string;
  department?: string;
}

interface RealtimeNotification {
  id: string;
  category: 'Approvals' | 'Personnel' | 'Payroll' | 'Attendance' | 'System';
  title: string;
  message: string;
  timestamp: string;
  timeAgo?: string;
  unread: boolean;
  user?: NotificationUser;
  actionType?: 'leave' | 'attendance' | 'salary' | 'employee' | 'ticket' | 'system';
  referenceId?: string | number;
  approved?: boolean;
  systemTag?: string;
}

// In-memory cache of notifications
let notificationsList: RealtimeNotification[] = [];

// Helper to calculate human readable timeAgo
function formatTimeAgo(dateStr: string): string {
  try {
    const past = new Date(dateStr).getTime();
    const now = Date.now();
    const diffSec = Math.floor((now - past) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  } catch (e) {
    return 'Recently';
  }
}

// Load persisted events only. Legacy startup seeds used invented identities and times.
async function initializeNotifications(): Promise<void> {
  notificationsList = [];
  if (!fs.existsSync(STORE_PATH)) return;
  try {
    const stored = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    if (!Array.isArray(stored)) return;
    notificationsList = stored.filter((item) =>
      item && typeof item.id === 'string' &&
      !/^notif-(?:leave-\d+|sal-\d{1,10}|system-\d+)$/.test(item.id)
    );
    notificationsList.forEach(item => { item.timeAgo = formatTimeAgo(item.timestamp); });
    if (notificationsList.length !== stored.length) saveNotificationsToDisk();
  } catch (error) {
    console.warn('Could not load persisted notifications:', error);
  }
}

function saveNotificationsToDisk(): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(notificationsList, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write notifications to disk:', e);
  }
}

// --------------------------------------------------------------------------
// WebSocket Server Setup
// --------------------------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });
const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);

  // Send initial real notifications payload on connection
  notificationsList.forEach((n) => {
    n.timeAgo = formatTimeAgo(n.timestamp);
  });
  ws.send(JSON.stringify({ type: 'init', data: notificationsList }));

  ws.on('message', (message: string) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === 'mark_read' && parsed.id) {
        const item = notificationsList.find((n) => n.id === parsed.id);
        if (item) {
          item.unread = false;
          saveNotificationsToDisk();
          broadcast({ type: 'notification:read', id: parsed.id });
        }
      } else if (parsed.type === 'mark_all_read') {
        notificationsList.forEach((n) => (n.unread = false));
        saveNotificationsToDisk();
        broadcast({ type: 'notification:all_read' });
      } else if (parsed.type === 'approve' && parsed.id) {
        const item = notificationsList.find((n) => n.id === parsed.id);
        if (item) {
          item.approved = true;
          item.unread = false;
          saveNotificationsToDisk();
          broadcast({ type: 'notification:action', id: parsed.id, action: 'approved' });
        }
      } else if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
});

function broadcast(event: { type: string; [key: string]: any }): void {
  const payload = JSON.stringify(event);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Handle HTTP upgrade for /ws/notifications
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`).pathname;
  if (pathname === '/ws/notifications' || pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// --------------------------------------------------------------------------
// REST API Routes
// --------------------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    connected_ws_clients: clients.size,
    total_notifications: notificationsList.length
  });
});

// Get all real notifications
app.get('/api/notifications', (req, res) => {
  notificationsList.forEach((n) => {
    n.timeAgo = formatTimeAgo(n.timestamp);
  });
  res.json({
    success: true,
    data: notificationsList
  });
});

// Dispatch a new real-time notification
app.post('/api/notifications', (req, res) => {
  const body = req.body || {};
  const newNotif: RealtimeNotification = {
    id: body.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: body.category || 'System',
    title: body.title || 'System Notification',
    message: body.message || '',
    timestamp: new Date().toISOString(),
    timeAgo: 'Just now',
    unread: true,
    user: body.user,
    actionType: body.actionType,
    referenceId: body.referenceId,
    approved: body.approved || false,
    systemTag: body.systemTag
  };

  notificationsList.unshift(newNotif);
  // Cap at 100 entries
  if (notificationsList.length > 100) {
    notificationsList = notificationsList.slice(0, 100);
  }

  saveNotificationsToDisk();

  // Broadcast in real-time to all connected WebSocket clients!
  broadcast({
    type: 'notification:created',
    data: newNotif
  });

  res.status(201).json({
    success: true,
    data: newNotif
  });
});

// Mark single notification as read
app.patch('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const item = notificationsList.find((n) => n.id === id);
  if (item) {
    item.unread = false;
    saveNotificationsToDisk();
    broadcast({ type: 'notification:read', id });
    return res.json({ success: true, data: item });
  }
  res.status(404).json({ success: false, message: 'Notification not found' });
});

// Mark all notifications as read
app.post('/api/notifications/mark-all-read', (req, res) => {
  notificationsList.forEach((n) => (n.unread = false));
  saveNotificationsToDisk();
  broadcast({ type: 'notification:all_read' });
  res.json({ success: true, message: 'All notifications marked as read' });
});

// Approve/action notification
app.patch('/api/notifications/:id/action', (req, res) => {
  const { id } = req.params;
  const { action = 'approved' } = req.body;
  const item = notificationsList.find((n) => n.id === id);
  if (item) {
    item.approved = action === 'approved';
    item.unread = false;
    saveNotificationsToDisk();
    broadcast({ type: 'notification:action', id, action });
    return res.json({ success: true, data: item });
  }
  res.status(404).json({ success: false, message: 'Notification not found' });
});

// Real salary fetch proxy & cache
app.get('/api/salaries', async (req, res) => {
  const userid = req.query.userid as string | undefined;
  const q = userid ? `?userid=${encodeURIComponent(userid)}` : '';
  try {
    const upstreamRes = await fetch(`https://hrms-api.mkmkataria07.workers.dev/api/v1/get-salary${q}`);
    const upstreamData = await upstreamRes.json();
    return res.json(upstreamData);
  } catch (err: any) {
    console.warn('Salary proxy error:', err.message);
    res.status(502).json({ success: false, message: 'Failed to fetch salary from Cloudflare' });
  }
});

// Real salary add proxy
app.post('/api/salaries', async (req, res) => {
  try {
    const upstreamRes = await fetch('https://hrms-api.mkmkataria07.workers.dev/api/v1/add-salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const upstreamData = await upstreamRes.json();

    // Trigger real-time notification
    const empName = req.body.employee_name || 'Employee';
    const month = req.body.month || 'September';
    const year = req.body.year || '2026';
    const net = Number(req.body.net_salary || req.body.amount_paid || 0).toLocaleString('en-IN');

    const notif: RealtimeNotification = {
      id: `notif-sal-${Date.now()}`,
      category: 'Payroll',
      title: 'Salary Disbursed',
      message: `${month} ${year} net salary of â‚¹${net} disbursed to ${empName}.`,
      timestamp: new Date().toISOString(),
      timeAgo: 'Just now',
      unread: true,
      user: {
        name: empName,
        userid: req.body.user_id || 'TYS-1000',
        department: 'Corporate Payroll'
      },
      actionType: 'salary'
    };

    notificationsList.unshift(notif);
    saveNotificationsToDisk();
    broadcast({ type: 'notification:created', data: notif });

    return res.json(upstreamData);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Real hierarchy fetch and store persistence
const HIERARCHY_STORE_PATH = path.join(process.cwd(), 'hierarchy_store.json');

app.get('/api/hierarchy', (req, res) => {
  try {
    if (fs.existsSync(HIERARCHY_STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(HIERARCHY_STORE_PATH, 'utf-8'));
      return res.json({ success: true, data });
    }
    return res.json({ success: true, data: null });
  } catch (err: any) {
    console.error('Error reading hierarchy store:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/hierarchy', (req, res) => {
  try {
    const payload = req.body;
    fs.writeFileSync(HIERARCHY_STORE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    res.json({ success: true, message: 'Hierarchy saved successfully', timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('Error saving hierarchy store:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --------------------------------------------------------------------------
// Cloudflare D1 & R2 Document Vault Store & Endpoints
// --------------------------------------------------------------------------
// Documents are served exclusively by the authenticated company gateway (D1 + R2).
app.use('/api/documents', (_req, res) => res.status(410).json({ success: false, message: 'Use the authenticated company document vault.' }));

// --------------------------------------------------------------------------
// Super Admin Attendance & Audit Logs Store & APIs
// --------------------------------------------------------------------------
const ATTENDANCE_STORE_PATH = path.join(process.cwd(), 'attendance_store.json');

export interface StaffAttendanceRecord {
  id: string;
  userid: string;
  employee_name: string;
  department: string;
  designation: string;
  profile_pic_url?: string;
  date: string; // YYYY-MM-DD
  day: string; // Mon, Tue...
  shift_id: string;
  shift_name: string;
  shift_timing: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: string | null;
  status: 'Present' | 'Late' | 'Half Day' | 'Absent' | 'On Leave' | 'WFH';
  geofence_status: string;
  terminal_id?: string;
  device_type?: string;
  is_regularized?: boolean;
  regularization_reason?: string;
  regularized_by?: string;
  notes?: string;
}

export interface AttendanceRegularizationRequest {
  id: string;
  userid: string;
  employee_name: string;
  department: string;
  profile_pic_url?: string;
  date: string;
  request_type: 'Missed Punch In' | 'Missed Punch Out' | 'Late In Regularization' | 'WFH Punch Error';
  requested_in_time: string;
  requested_out_time: string;
  reason: string;
  submitted_at: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  resolved_by?: string;
  resolved_at?: string;
}

interface AttendanceStoreData {
  records: StaffAttendanceRecord[];
  regularizations: AttendanceRegularizationRequest[];
}

function calculateDiffHours(inTime: string | null, outTime: string | null): string {
  if (!inTime || !outTime) return '00:00';
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  let diffMins = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
  if (diffMins < 0) diffMins += 24 * 60;
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

const CANONICAL_STAFF = [
  {
    userid: 'TYS-1021',
    name: 'Mohit Kataria',
    department: 'Engineering & Technology',
    designation: 'Senior Systems & Cloud Architect',
    profile_pic_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
  },
  {
    userid: 'TYS-1003',
    name: 'Priyanka Chopra',
    department: 'Human Resources',
    designation: 'Head of People Operations & HR',
    profile_pic_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
  },
  {
    userid: 'TYS-1008',
    name: 'Rajesh Sharma',
    department: 'Engineering & Technology',
    designation: 'Engineering Director & Head of Products',
    profile_pic_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-MORN', name: 'Early Morning R&D Shift', timing: '07:30 - 16:30' }
  },
  {
    userid: 'TYS-1005',
    name: 'Ananya Deshmukh',
    department: 'Engineering & Technology',
    designation: 'Lead Product & Flutter Engineer',
    profile_pic_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
  },
  {
    userid: 'TYS-1010',
    name: 'Vikram Malhotra',
    department: 'Engineering & Technology',
    designation: 'Lead DevOps & Cloud Infrastructure',
    profile_pic_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-EVE', name: 'Afternoon / Evening Shift', timing: '14:00 - 22:30' }
  },
  {
    userid: 'TYS-1012',
    name: 'Sneha Patel',
    department: 'Product & Design',
    designation: 'Senior UX/UI Designer',
    profile_pic_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
  },
  {
    userid: 'TYS-1014',
    name: 'Amit Trivedi',
    department: 'Finance & Accounts',
    designation: 'Financial Controller & Payroll Lead',
    profile_pic_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
  },
  {
    userid: 'TYS-1016',
    name: 'Neha Kulkarni',
    department: 'Human Resources',
    designation: 'Senior HR Generalist',
    profile_pic_url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
  },
  {
    userid: 'TYS-1018',
    name: 'Devendra Singh',
    department: 'Growth & Sales',
    designation: 'Enterprise Sales Director',
    profile_pic_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
  },
  {
    userid: 'TYS-1020',
    name: 'Kavita Rao',
    department: 'Engineering & Technology',
    designation: 'Principal QA Automation Lead',
    profile_pic_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
  },
  {
    userid: 'TYS-1024',
    name: 'Rohan Joshi',
    department: 'Engineering & Technology',
    designation: 'Fullstack Software Engineer',
    profile_pic_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
  },
  {
    userid: 'TYS-1028',
    name: 'Tanvi Shah',
    department: 'Marketing',
    designation: 'Content & Brand Marketing Specialist',
    profile_pic_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=256&h=256&q=80',
    shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
  }
];

function generateSeedAttendance(): AttendanceStoreData {
  const records: StaffAttendanceRecord[] = [];
  const daysInSept = 30;

  for (let d = 1; d <= daysInSept; d++) {
    const dayNum = String(d).padStart(2, '0');
    const dateStr = `2026-09-${dayNum}`;
    const dayOfWeek = (2 + d - 1) % 7; // Sept 1, 2026 is Tue (2)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[dayOfWeek];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    CANONICAL_STAFF.forEach((staff, staffIdx) => {
      const recId = `att-${staff.userid}-${dateStr}`;

      if (isWeekend) {
        records.push({
          id: recId,
          userid: staff.userid,
          employee_name: staff.name,
          department: staff.department,
          designation: staff.designation,
          profile_pic_url: staff.profile_pic_url,
          date: dateStr,
          day: dayName,
          shift_id: staff.shift.id,
          shift_name: staff.shift.name,
          shift_timing: staff.shift.timing,
          check_in_time: null,
          check_out_time: null,
          total_hours: '00:00',
          status: 'Absent',
          geofence_status: 'Weekend Off-Day',
          terminal_id: undefined,
          device_type: undefined
        });
        return;
      }

      if (d <= 23) {
        let status: 'Present' | 'Late' | 'Half Day' | 'Absent' | 'On Leave' | 'WFH' = 'Present';
        let checkIn = '09:22:10';
        let checkOut: string | null = '18:35:40';
        let geofence = 'HQ Terminal #02 (14m)';
        let terminal = 'BIO-HQ-02';
        let device = 'Biometric Terminal';
        let isRegularized = false;
        let regReason: string | undefined = undefined;

        const pattern = (d * 7 + staffIdx * 13) % 25;
        if (pattern === 1) {
          status = 'Late';
          checkIn = '10:04:15';
          geofence = 'HQ Terminal #01 (24m)';
        } else if (pattern === 2) {
          status = 'Half Day';
          checkIn = '09:15:00';
          checkOut = '14:00:00';
          geofence = 'HQ Terminal #02 (18m)';
        } else if (pattern === 3) {
          status = 'On Leave';
          checkIn = '';
          checkOut = null;
          geofence = 'Approved Sick/Casual Leave';
          terminal = undefined;
          device = undefined;
        } else if (pattern === 4) {
          status = 'WFH';
          checkIn = '09:28:00';
          checkOut = '18:30:00';
          geofence = 'Remote GPS Verified (Navi Mumbai)';
          device = 'Mobile App GPS';
          terminal = 'APP-GEOFENCE';
        } else if (pattern === 5) {
          status = 'Present';
          checkIn = '09:30:00';
          checkOut = '18:30:00';
          isRegularized = true;
          regReason = 'Biometric sensor failure, verified by supervisor';
        }

        if (d === 23 && status === 'Present' && staffIdx % 2 === 0) {
          checkOut = null;
        }

        const totalHrs = checkIn && checkOut ? calculateDiffHours(checkIn, checkOut) : checkIn ? '05:30' : '00:00';

        records.push({
          id: recId,
          userid: staff.userid,
          employee_name: staff.name,
          department: staff.department,
          designation: staff.designation,
          profile_pic_url: staff.profile_pic_url,
          date: dateStr,
          day: dayName,
          shift_id: staff.shift.id,
          shift_name: staff.shift.name,
          shift_timing: staff.shift.timing,
          check_in_time: checkIn || null,
          check_out_time: checkOut,
          total_hours: totalHrs,
          status,
          geofence_status: geofence,
          terminal_id: terminal,
          device_type: device,
          is_regularized: isRegularized,
          regularization_reason: regReason,
          regularized_by: isRegularized ? 'Mohit Kataria (Super Admin)' : undefined
        });
      }
    });
  }

  const regularizations: AttendanceRegularizationRequest[] = [
    {
      id: 'reg-01',
      userid: 'TYS-1005',
      employee_name: 'Ananya Deshmukh',
      department: 'Engineering & Technology',
      profile_pic_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&h=256&q=80',
      date: '2026-09-22',
      request_type: 'Missed Punch Out',
      requested_in_time: '09:20:00',
      requested_out_time: '18:45:00',
      reason: 'Late release deployment meeting with client. Terminal power was rebooted during exit.',
      submitted_at: '2026-09-22T19:15:00Z',
      status: 'Pending'
    },
    {
      id: 'reg-02',
      userid: 'TYS-1010',
      employee_name: 'Vikram Malhotra',
      department: 'Engineering & Technology',
      profile_pic_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80',
      date: '2026-09-21',
      request_type: 'Late In Regularization',
      requested_in_time: '09:25:00',
      requested_out_time: '19:10:00',
      reason: 'On-site server rack connectivity emergency at Datacenter before reporting to HQ.',
      submitted_at: '2026-09-21T14:30:00Z',
      status: 'Pending'
    },
    {
      id: 'reg-03',
      userid: 'TYS-1018',
      employee_name: 'Devendra Singh',
      department: 'Growth & Sales',
      profile_pic_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=256&h=256&q=80',
      date: '2026-09-23',
      request_type: 'WFH Punch Error',
      requested_in_time: '09:30:00',
      requested_out_time: '18:30:00',
      reason: 'Client meeting in BKC; mobile GPS boundary drift detected out-of-range false positive.',
      submitted_at: '2026-09-23T10:05:00Z',
      status: 'Pending'
    }
  ];

  return { records, regularizations };
}

function getAttendanceStoreData(): AttendanceStoreData {
  try {
    if (fs.existsSync(ATTENDANCE_STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(ATTENDANCE_STORE_PATH, 'utf-8'));
      if (Array.isArray(data.records) && Array.isArray(data.regularizations)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Error reading attendance_store.json, creating initial store:', err);
  }
  const initial = generateSeedAttendance();
  saveAttendanceStoreData(initial);
  return initial;
}

function saveAttendanceStoreData(data: AttendanceStoreData): void {
  try {
    fs.writeFileSync(ATTENDANCE_STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing attendance_store.json:', err);
  }
}

// 1. Get All Staff Attendance (Super Admin Daily Logs)
app.get('/api/attendance/staff', (req, res) => {
  try {
    const { date = '2026-09-23', department = 'All', status = 'All', search = '' } = req.query;
    const store = getAttendanceStoreData();

    let list = store.records.filter((r) => r.date === String(date));

    if (list.length === 0) {
      const dayDate = new Date(String(date));
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = !isNaN(dayDate.getTime()) ? dayNames[dayDate.getDay()] : 'Wed';
      const isWeekend = dayName === 'Sun' || dayName === 'Sat';

      list = CANONICAL_STAFF.map((staff) => ({
        id: `att-${staff.userid}-${date}`,
        userid: staff.userid,
        employee_name: staff.name,
        department: staff.department,
        designation: staff.designation,
        profile_pic_url: staff.profile_pic_url,
        date: String(date),
        day: dayName,
        shift_id: staff.shift.id,
        shift_name: staff.shift.name,
        shift_timing: staff.shift.timing,
        check_in_time: isWeekend ? null : '09:25:00',
        check_out_time: isWeekend ? null : '18:30:00',
        total_hours: isWeekend ? '00:00' : '09:05',
        status: isWeekend ? 'Absent' : 'Present',
        geofence_status: isWeekend ? 'Weekend Off' : 'HQ Terminal #02 (12m)',
        terminal_id: isWeekend ? undefined : 'BIO-HQ-02',
        device_type: isWeekend ? undefined : 'Biometric Terminal'
      }));
      store.records.push(...list);
      saveAttendanceStoreData(store);
    }

    if (department !== 'All') {
      list = list.filter((r) => r.department.toLowerCase() === String(department).toLowerCase());
    }

    if (status !== 'All') {
      list = list.filter((r) => r.status.toLowerCase() === String(status).toLowerCase());
    }

    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (r) =>
          r.employee_name.toLowerCase().includes(q) ||
          r.userid.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.designation.toLowerCase().includes(q)
      );
    }

    const totalStaff = list.length;
    const presentCount = list.filter((r) => r.status === 'Present').length;
    const lateCount = list.filter((r) => r.status === 'Late').length;
    const halfDayCount = list.filter((r) => r.status === 'Half Day').length;
    const absentCount = list.filter((r) => r.status === 'Absent').length;
    const leaveCount = list.filter((r) => r.status === 'On Leave').length;
    const wfhCount = list.filter((r) => r.status === 'WFH').length;
    const punctualityRate =
      totalStaff > 0 ? Math.round(((presentCount + wfhCount) / Math.max(1, totalStaff - leaveCount - absentCount)) * 100) : 100;

    res.json({
      success: true,
      date,
      data: list,
      stats: {
        totalStaff,
        presentCount,
        lateCount,
        halfDayCount,
        absentCount,
        leaveCount,
        wfhCount,
        punctualityRate
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Get Monthly Attendance Matrix / Roster
app.get('/api/attendance/monthly-matrix', (req, res) => {
  try {
    const { month = 'September', year = '2026', department = 'All', search = '' } = req.query;
    const store = getAttendanceStoreData();
    const daysInMonth = 30;

    let staffList = [...CANONICAL_STAFF];
    if (department !== 'All') {
      staffList = staffList.filter((s) => s.department.toLowerCase() === String(department).toLowerCase());
    }
    if (search) {
      const q = String(search).toLowerCase();
      staffList = staffList.filter((s) => s.name.toLowerCase().includes(q) || s.userid.toLowerCase().includes(q));
    }

    const matrix = staffList.map((staff) => {
      const dayMap: Record<string, StaffAttendanceRecord | { status: string; day: string }> = {};
      let present = 0;
      let late = 0;
      let halfDay = 0;
      let absent = 0;
      let leave = 0;
      let wfh = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const dateStr = `2026-09-${dayStr}`;
        const dayOfWeek = (2 + d - 1) % 7;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const found = store.records.find((r) => r.userid === staff.userid && r.date === dateStr);
        if (found) {
          dayMap[d] = found;
          if (found.status === 'Present') present++;
          else if (found.status === 'Late') late++;
          else if (found.status === 'Half Day') halfDay++;
          else if (found.status === 'Absent' && !isWeekend) absent++;
          else if (found.status === 'On Leave') leave++;
          else if (found.status === 'WFH') wfh++;
        } else {
          dayMap[d] = {
            status: isWeekend ? 'Weekend' : d <= 23 ? 'Present' : 'Upcoming',
            day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]
          };
          if (!isWeekend && d <= 23) present++;
        }
      }

      const payableDays = present + wfh + (halfDay * 0.5) + leave + 8;

      return {
        user: staff,
        attendanceByDay: dayMap,
        summary: {
          present,
          late,
          halfDay,
          absent,
          leave,
          wfh,
          payableDays: Math.min(30, payableDays)
        }
      };
    });

    res.json({
      success: true,
      month,
      year,
      daysInMonth,
      data: matrix
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Super Admin Manual Attendance Override / Punch Correction
app.post('/api/attendance/override', (req, res) => {
  try {
    const { userid, date, check_in_time, check_out_time, status, reason, notes, updatedBy = 'Super Admin' } = req.body;
    if (!userid || !date) {
      return res.status(400).json({ success: false, message: 'userid and date are required' });
    }

    const store = getAttendanceStoreData();
    let record = store.records.find((r) => r.userid === userid && r.date === date);

    const totalHours = check_in_time && check_out_time ? calculateDiffHours(check_in_time, check_out_time) : record?.total_hours || '00:00';

    if (record) {
      record.check_in_time = check_in_time !== undefined ? check_in_time : record.check_in_time;
      record.check_out_time = check_out_time !== undefined ? check_out_time : record.check_out_time;
      record.total_hours = totalHours;
      if (status) record.status = status;
      record.is_regularized = true;
      record.regularized_by = updatedBy;
      record.regularization_reason = reason || 'Super Admin manual adjustment';
      record.notes = notes || record.notes;
    } else {
      const staff = CANONICAL_STAFF.find((s) => s.userid === userid) || {
        userid,
        name: userid,
        department: 'General Staff',
        designation: 'Staff',
        profile_pic_url: undefined,
        shift: { id: 'SH-GEN', name: 'General Day Shift', timing: '09:30 - 18:30' }
      };

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayDate = new Date(date);
      const dayName = !isNaN(dayDate.getTime()) ? dayNames[dayDate.getDay()] : 'Day';

      record = {
        id: `att-${userid}-${date}`,
        userid,
        employee_name: staff.name,
        department: staff.department,
        designation: staff.designation,
        profile_pic_url: staff.profile_pic_url,
        date,
        day: dayName,
        shift_id: staff.shift.id,
        shift_name: staff.shift.name,
        shift_timing: staff.shift.timing,
        check_in_time: check_in_time || '09:30:00',
        check_out_time: check_out_time || '18:30:00',
        total_hours: totalHours,
        status: status || 'Present',
        geofence_status: 'Admin Manual Override',
        terminal_id: 'SUPERADMIN-OVERRIDE',
        device_type: 'Console Override',
        is_regularized: true,
        regularized_by: updatedBy,
        regularization_reason: reason || 'Super Admin manual entry',
        notes
      };
      store.records.push(record);
    }

    saveAttendanceStoreData(store);
    res.json({ success: true, data: record });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Get Attendance Regularization Requests
app.get('/api/attendance/regularizations', (req, res) => {
  try {
    const store = getAttendanceStoreData();
    res.json({ success: true, data: store.regularizations });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Approve or Reject Regularization Request
app.post('/api/attendance/regularize/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { action, resolved_by = 'Mohit Kataria (Super Admin)', reason } = req.body;
    const store = getAttendanceStoreData();

    const reqItem = store.regularizations.find((r) => r.id === id);
    if (!reqItem) {
      return res.status(404).json({ success: false, message: 'Regularization request not found' });
    }

    reqItem.status = action === 'approve' ? 'Approved' : 'Rejected';
    reqItem.resolved_by = resolved_by;
    reqItem.resolved_at = new Date().toISOString();

    if (action === 'approve') {
      let record = store.records.find((r) => r.userid === reqItem.userid && r.date === reqItem.date);
      const totalHours = calculateDiffHours(reqItem.requested_in_time, reqItem.requested_out_time);

      if (record) {
        record.check_in_time = reqItem.requested_in_time;
        record.check_out_time = reqItem.requested_out_time;
        record.total_hours = totalHours;
        record.status = 'Present';
        record.is_regularized = true;
        record.regularized_by = resolved_by;
        record.regularization_reason = `Approved regularization: ${reqItem.reason}`;
      } else {
        const staff = CANONICAL_STAFF.find((s) => s.userid === reqItem.userid);
        const newRecord: StaffAttendanceRecord = {
          id: `att-${reqItem.userid}-${reqItem.date}`,
          userid: reqItem.userid,
          employee_name: reqItem.employee_name,
          department: reqItem.department,
          designation: staff?.designation || 'Staff',
          profile_pic_url: reqItem.profile_pic_url,
          date: reqItem.date,
          day: 'Day',
          shift_id: 'SH-GEN',
          shift_name: 'General Day Shift',
          shift_timing: '09:30 - 18:30',
          check_in_time: reqItem.requested_in_time,
          check_out_time: reqItem.requested_out_time,
          total_hours: totalHours,
          status: 'Present',
          geofence_status: 'Regularized & Verified',
          terminal_id: 'ADMIN-REGULARIZED',
          device_type: 'Regularization Approval',
          is_regularized: true,
          regularized_by: resolved_by,
          regularization_reason: reqItem.reason
        };
        store.records.push(newRecord);
      }
    }

    saveAttendanceStoreData(store);
    res.json({ success: true, data: reqItem });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --------------------------------------------------------------------------
// Start Server & Vite Middleware
// --------------------------------------------------------------------------
async function startServer() {
  await initializeNotifications();

  // In development, hook up Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[PulseHRMS] Realtime Server & WebSocket active on port ${PORT}`);
  });
}

startServer();
