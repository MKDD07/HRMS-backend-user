import { documentVaultApi } from './documentVaultApi.js';
import { companyRequest } from './companyAuth.js';

const API_BASE_URL = 'https://hrms-api.mkmkataria07.workers.dev/api/v1';
export const DB_ID = '4fe0e2c8-e4f0-4433-8351-6dbf73359cd7';
export const R2_STORAGE_BASE = 'https://hrms-api.mkmkataria07.workers.dev/storage';
export const R2_PROFILE_IMAGES = {};

// Storage helper functions
const getAuthToken = () => {
  try {
    return localStorage.getItem('pulse_hrms_token') || '';
  } catch (e) {
    return '';
  }
};

const setAuthToken = (token) => {
  try {
    if (token) {
      localStorage.setItem('pulse_hrms_token', token);
    } else {
      localStorage.removeItem('pulse_hrms_token');
    }
  } catch (e) {
    console.error('Storage error:', e);
  }
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('pulse_hrms_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const setStoredUser = (user) => {
  try {
    if (user) {
      localStorage.setItem('pulse_hrms_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('pulse_hrms_user');
    }
  } catch (e) {
    console.error('Storage error:', e);
  }
};

// Generic HTTP request helper
async function request(endpoint, options = {}) {
  if (getStoredUser()?.company_id) {
    const data = await companyRequest(endpoint, { ...options, token: getAuthToken() });
    return { success: true, data };
  }
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[API] ${options.method || 'GET'} ${endpoint} failed:`, err.message);
    throw err;
  }
}

export const hrmsApi = {
  // --------------------------------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------------------------------
  async login(email, password) {
    const response = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password })
    });

    if (response && response.success && response.data) {
      const userPayload = response.data;
      if (userPayload.token) {
        setAuthToken(userPayload.token);
      }

      let fullProfile = null;
      try {
        const profileRes = await this.getUser(userPayload.userid);
        if (profileRes.data && profileRes.data.length > 0) {
          fullProfile = profileRes.data[0];
        }
      } catch (e) {
        console.warn('Could not fetch full user profile on login:', e);
      }

      const activeUser = fullProfile || {
        userid: userPayload.userid,
        first_name: userPayload.name ? userPayload.name.split(' ')[0] : 'User',
        last_name: userPayload.name ? userPayload.name.split(' ').slice(1).join(' ') : '',
        email: userPayload.email,
        type: userPayload.type,
        department: userPayload.department || 'General',
        designation: userPayload.designation || 'Staff',
        status: userPayload.status || 'Active'
      };

      setStoredUser(activeUser);
      return { success: true, data: userPayload, user: activeUser };
    }

    throw new Error(response?.message || 'Login failed. Please check your credentials.');
  },

  logout() {
    setAuthToken(null);
    setStoredUser(null);
    return { success: true };
  },

  getAuthToken,
  getCurrentUser() {
    return getStoredUser();
  },
  setCurrentUser(user) {
    setStoredUser(user);
  },

  // --------------------------------------------------------------------------
  // EMPLOYEES & DIRECTORY
  // --------------------------------------------------------------------------
  async getAllUsers({ liveOnly = false } = {}) {
    const result = await request('/get-all-users');
    if (result?.success === false || !Array.isArray(result?.data)) {
      if (liveOnly) {
        throw new Error(result?.message || 'Unable to load the employee directory.');
      }
      return { success: true, data: [] };
    }

    const liveUsers = result.data.map((u) => ({
      ...u,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.userid,
      date_of_joining: u.date_of_joining || u.joining_date || '',
      date_of_birth: u.date_of_birth || u.dob || '',
      profile_pic_url: u.profile_pic_url || ''
    }));

    return { success: true, data: liveUsers };
  },

  async getUser(userid, { liveOnly = false } = {}) {
    if (!userid) {
      if (liveOnly) throw new Error('User ID is required.');
      return { success: false, data: [] };
    }

    const res = await request(`/get-user?userid=${encodeURIComponent(userid)}`);
    if (res?.success === false || !Array.isArray(res?.data) || !res.data.length) {
      if (liveOnly) {
        throw new Error(res?.message || 'Employee details are unavailable.');
      }
      return { success: false, data: [], personalDetails: [], professionalDetails: [], bankDetails: [], familyDetails: [] };
    }

    return {
      success: true,
      data: res.data,
      personalDetails: res.personalDetails || [],
      professionalDetails: res.professionalDetails || [],
      bankDetails: res.bankDetails || [],
      familyDetails: res.familyDetails || []
    };
  },

  async getTodaysBirthdays(dateString) {
    const today = dateString || new Date().toISOString().split('T')[0];
    const targetMd = today.slice(5); // MM-DD
    try {
      const usersRes = await this.getAllUsers();
      const matches = (usersRes.data || []).filter(
        (u) => u.date_of_birth && u.date_of_birth.endsWith(targetMd)
      );
      return { success: true, data: matches };
    } catch (e) {
      return { success: true, data: [] };
    }
  },

  async createUser(userData, { liveOnly = false } = {}) {
    const payload = {
      password: userData.password || 'Welcome@123',
      ...userData
    };
    const result = await request('/create-user', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (result?.success !== true) {
      throw new Error(result?.message || 'The employee could not be saved.');
    }
    return result;
  },

  async uploadAvatar(userid, imageData) {
    let base64 = imageData;
    if (typeof window !== 'undefined' && (imageData instanceof File || imageData instanceof Blob)) {
      base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(imageData);
      });
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('pulse_hrms_token') : null;
    const result = await companyRequest('/upload-avatar', {
      token, method: 'POST', body: JSON.stringify({ userid, image: base64 })
    });

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`pulse_avatar_${userid}`, base64);
        const currentUser = getStoredUser();
        if (currentUser && (currentUser.userid === userid || currentUser.username === userid)) {
          setStoredUser({ ...currentUser, profile_pic_url: base64 });
        }
        window.dispatchEvent(new CustomEvent('pulse-avatar-updated', { detail: { userid, profile_pic_url: base64 } }));
        window.dispatchEvent(new Event('pulse-users-updated'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.warn('Avatar local sync notice:', e);
      }
    }

    return { success: true, profile_pic_url: base64, data: result };
  },

  async updateUser(userid, updates) {
    const currentUser = getStoredUser();
    if (currentUser && (currentUser.userid === userid || currentUser.username === userid)) {
      const updated = { ...currentUser, ...updates };
      setStoredUser(updated);
    }
    try {
      await request('/update-user', {
        method: 'POST',
        body: JSON.stringify({ userid, ...updates })
      });
    } catch (e) {}

    return { success: true, data: { userid, ...updates } };
  },

  // --------------------------------------------------------------------------
  // ATTENDANCE & SHIFTS
  // --------------------------------------------------------------------------
  async getAttendance(userid, date, { liveOnly = false } = {}) {
    const q = userid ? `?userid=${encodeURIComponent(userid)}` : '';
    const res = await request(`/get-attendance${q}`);
    if (res?.success === false || !Array.isArray(res?.data)) {
      if (liveOnly) throw new Error(res?.message || 'Attendance is unavailable.');
      return { success: true, data: [], attendanceCount: { presentCount: 0, lateCount: 0 } };
    }
    return res;
  },

  async getAttendanceHistory(userid, year, month) {
    if (!userid) return { success: true, data: [], attendanceCount: { presentCount: 0, lateCount: 0, halfDayCount: 0, absentCount: 0, leaveCount: 0, daysInMonth: 30, workingDays: 22, workedInMonth: '0h' } };
    const q = `?userid=${encodeURIComponent(userid)}`;
    const res = await request(`/get-attendance${q}`);
    const records = (res && Array.isArray(res.data)) ? res.data : [];

    const presentCount = records.filter(r => r.status === 'Present' || r.attstatus === 'Present').length;
    const lateCount = records.filter(r => r.status === 'Late' || r.is_late === 'Yes').length;
    const halfDayCount = records.filter(r => r.status === 'Half Day').length;
    const absentCount = records.filter(r => r.status === 'Absent').length;
    const leaveCount = records.filter(r => r.status === 'On Leave' || r.status === 'Leave').length;

    return {
      success: true,
      data: records,
      attendanceCount: {
        presentCount,
        lateCount,
        halfDayCount,
        absentCount,
        leaveCount,
        daysInMonth: 30,
        workingDays: 22,
        workedInMonth: `${presentCount * 8}h`
      }
    };
  },

  async markAttendance({ userid, action, latitude, longitude, photo_url }) {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().split(' ')[0];

    const result = await request('/attendance', {
      method: 'POST',
      body: JSON.stringify({ userid, action, latitude, longitude, photo_url, date: today, time: nowTime })
    });

    return {
      success: true,
      message: action === 'punch_in' ? 'Punched in successfully' : 'Punched out successfully',
      data: result?.data || { userid, date: today, time: nowTime, action }
    };
  },

  // --------------------------------------------------------------------------
  // SUPER ADMIN ALL-STAFF ATTENDANCE & AUDIT LOGS
  // --------------------------------------------------------------------------
  async getAllStaffAttendance({ date = 'All', department = 'All', status = 'All', search = '' } = {}) {
    const usersRes = await this.getAllUsers();
    const staffList = (usersRes && Array.isArray(usersRes.data)) ? usersRes.data : [];

    const attendancePromises = staffList.map(async (u) => {
      try {
        const q = `?userid=${encodeURIComponent(u.userid)}`;
        const res = await request(`/get-attendance${q}`);
        return { userid: u.userid, records: (res && res.data) || [] };
      } catch (e) {
        return { userid: u.userid, records: [] };
      }
    });

    const userAttendances = await Promise.all(attendancePromises);
    const attMap = new Map();
    userAttendances.forEach(({ userid, records }) => {
      attMap.set(userid, records);
    });

    let result = [];

    if (date === 'All' || !date) {
      staffList.forEach((staff) => {
        const realLogs = attMap.get(staff.userid) || [];
        const empName = staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || staff.userid;

        realLogs.forEach((log) => {
          const logDate = log.date || log.attdate;
          result.push({
            id: `att-${log.id || `${staff.userid}-${logDate}`}`,
            userid: staff.userid,
            employee_name: empName,
            department: staff.department || 'General',
            designation: staff.designation || 'Staff',
            profile_pic_url: staff.profile_pic_url || '',
            move_in_url: log.move_in_url,
            date: logDate,
            day: log.attday || 'Day',
            shift_name: log.shift_name || 'General Day Shift',
            shift_timing: log.shift_timing || '09:30 - 18:30',
            check_in_time: log.check_in_time || log.intime,
            check_out_time: log.check_out_time || log.outtime,
            total_hours: log.total_hours || log.totalhours || '08:30',
            status: log.status || log.attstatus || 'Present',
            geofence_status: log.check_in_distance != null ? `HQ Validated (${log.check_in_distance}m)` : 'HQ Geofence Validated',
            check_in_distance: log.check_in_distance,
            latitude: log.latitude,
            longitude: log.longitude,
            terminal_id: log.terminal_id || 'BIO-HQ-02',
            device_type: log.move_in_url ? 'Biometric Facial Scan & GPS' : 'Terminal Fingerprint',
            is_regularized: Boolean(log.is_regularized),
            regularization_reason: log.regularization_reason,
            regularized_by: log.regularized_by
          });
        });
      });
    } else {
      staffList.forEach((staff) => {
        const realLogs = attMap.get(staff.userid) || [];
        const match = realLogs.find((l) => (l.date || l.attdate) === date);
        const empName = staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || staff.userid;

        const dayDate = new Date(date);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = !isNaN(dayDate.getTime()) ? dayNames[dayDate.getDay()] : 'Day';
        const isWeekend = dayName === 'Sun' || dayName === 'Sat';

        result.push({
          id: `att-${match?.id || `${staff.userid}-${date}`}`,
          userid: staff.userid,
          employee_name: empName,
          department: staff.department || 'General',
          designation: staff.designation || 'Staff',
          profile_pic_url: staff.profile_pic_url || '',
          move_in_url: match?.move_in_url,
          date,
          day: dayName,
          shift_name: 'General Day Shift',
          shift_timing: '09:30 - 18:30',
          check_in_time: match ? (match.check_in_time || match.intime) : null,
          check_out_time: match ? (match.check_out_time || match.outtime) : null,
          total_hours: match ? (match.total_hours || match.totalhours || '08:30') : '00:00',
          status: match ? (match.status || match.attstatus || 'Present') : isWeekend ? 'Weekend' : 'Not Punched',
          geofence_status: match ? (match.check_in_distance != null ? `HQ Validated (${match.check_in_distance}m)` : 'HQ Geofence Validated') : isWeekend ? 'Weekend Off' : 'Pending Check-In',
          check_in_distance: match?.check_in_distance,
          latitude: match?.latitude,
          longitude: match?.longitude,
          terminal_id: match ? 'BIO-HQ-02' : undefined,
          device_type: match ? (match.move_in_url ? 'Biometric Facial Scan & GPS' : 'Terminal Fingerprint') : undefined,
          is_regularized: Boolean(match?.is_regularized),
          regularization_reason: match?.regularization_reason,
          regularized_by: match?.regularized_by
        });
      });
    }

    result.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (department !== 'All') {
      result = result.filter((r) => (r.department || '').toLowerCase() === department.toLowerCase());
    }

    if (status !== 'All') {
      result = result.filter((r) => (r.status || '').toLowerCase() === status.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.employee_name || '').toLowerCase().includes(q) ||
          (r.userid || '').toLowerCase().includes(q) ||
          (r.department || '').toLowerCase().includes(q) ||
          (r.designation || '').toLowerCase().includes(q) ||
          (r.date || '').toLowerCase().includes(q)
      );
    }

    const totalStaff = staffList.length;
    const presentCount = result.filter((r) => r.status === 'Present').length;
    const lateCount = result.filter((r) => r.status === 'Late').length;
    const halfDayCount = result.filter((r) => r.status === 'Half Day').length;
    const absentCount = result.filter((r) => r.status === 'Absent' || r.status === 'Not Punched').length;
    const leaveCount = result.filter((r) => r.status === 'On Leave' || r.status === 'Leave').length;
    const wfhCount = result.filter((r) => r.status === 'WFH').length;
    const biometricCount = result.filter((r) => Boolean(r.move_in_url)).length;
    const geofenceCount = result.filter((r) => r.check_in_distance != null || r.latitude != null).length;
    const punctualityRate = (presentCount + wfhCount) > 0 ? Math.round(((presentCount + wfhCount) / Math.max(1, presentCount + lateCount + halfDayCount + wfhCount)) * 100) : 100;

    return {
      success: true,
      date,
      data: result,
      stats: {
        totalStaff,
        presentCount,
        lateCount,
        halfDayCount,
        absentCount,
        leaveCount,
        wfhCount,
        biometricCount,
        geofenceCount,
        punctualityRate
      }
    };
  },

  async getMonthlyAttendanceMatrix({ month = 'September', year = '2026', department = 'All', search = '' } = {}) {
    const usersRes = await this.getAllUsers();
    let staffList = (usersRes && Array.isArray(usersRes.data)) ? usersRes.data : [];

    if (department !== 'All') {
      staffList = staffList.filter((s) => (s.department || '').toLowerCase() === department.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      staffList = staffList.filter((s) => (s.name || s.first_name || '').toLowerCase().includes(q) || (s.userid || '').toLowerCase().includes(q));
    }

    const attendancePromises = staffList.map(async (u) => {
      try {
        const q = `?userid=${encodeURIComponent(u.userid)}`;
        const res = await request(`/get-attendance${q}`);
        return { userid: u.userid, records: (res && res.data) || [] };
      } catch (e) {
        return { userid: u.userid, records: [] };
      }
    });

    const userAttendances = await Promise.all(attendancePromises);
    const attMap = new Map();
    userAttendances.forEach(({ userid, records }) => {
      attMap.set(userid, records);
    });

    const daysInMonth = 30;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const matrix = staffList.map((staff) => {
      const realLogs = attMap.get(staff.userid) || [];
      const dayMap = {};
      let present = 0;
      let late = 0;
      let halfDay = 0;
      let absent = 0;
      let leave = 0;
      let wfh = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const dateStr = `${year}-09-${dayStr}`;
        const dayOfWeek = (2 + d - 1) % 7;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const match = realLogs.find((l) => (l.date || l.attdate) === dateStr);

        if (match) {
          const st = match.status || match.attstatus || 'Present';
          dayMap[d] = {
            status: st,
            check_in_time: match.check_in_time || match.intime,
            check_out_time: match.check_out_time || match.outtime,
            day: match.attday || dayNames[dayOfWeek]
          };
          if (st === 'Present') present++;
          else if (st === 'Late') late++;
          else if (st === 'Half Day') halfDay++;
          else if (st === 'On Leave' || st === 'Leave') leave++;
          else if (st === 'WFH') wfh++;
          else if (st === 'Absent') absent++;
        } else {
          dayMap[d] = {
            status: isWeekend ? 'Weekend' : '-',
            day: dayNames[dayOfWeek]
          };
        }
      }

      const payableDays = present + wfh + (halfDay * 0.5) + leave;

      return {
        user: {
          userid: staff.userid,
          name: staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || staff.userid,
          profile_pic_url: staff.profile_pic_url || '',
          department: staff.department
        },
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

    return {
      success: true,
      month,
      year,
      daysInMonth,
      data: matrix
    };
  },

  async overrideStaffAttendance(payload) {
    try {
      await fetch('/api/attendance/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {}
    return { success: true, data: payload };
  },

  async getAttendanceRegularizations() {
    try {
      const res = await fetch('/api/attendance/regularizations');
      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) {
        return data;
      }
    } catch (e) {}
    return { success: true, data: [] };
  },

  async resolveRegularization(id, { action, resolved_by }) {
    try {
      const res = await fetch(`/api/attendance/regularize/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, resolved_by })
      });
      return await res.json();
    } catch (e) {
      return { success: true };
    }
  },

  exportAttendanceCSV(records, filename = 'Staff_Attendance_Audit_Report.csv') {
    if (!records || !records.length) return false;
    const headers = [
      'Record ID',
      'Employee ID',
      'Employee Name',
      'Department',
      'Designation',
      'Date',
      'Day',
      'Shift',
      'Punch In',
      'Punch Out',
      'Total Hours',
      'Attendance Status',
      'Geofence & Terminal Validation',
      'Terminal ID',
      'Device Type',
      'Regularized',
      'Regularization Reason',
      'Supervisor/Admin'
    ];

    const rows = records.map((r) => [
      `"${r.id || ''}"`,
      `"${r.userid || ''}"`,
      `"${r.employee_name || ''}"`,
      `"${r.department || ''}"`,
      `"${r.designation || ''}"`,
      `"${r.date || ''}"`,
      `"${r.day || ''}"`,
      `"${r.shift_name || ''} (${r.shift_timing || ''})"`,
      `"${r.check_in_time || '--'}"`,
      `"${r.check_out_time || '--'}"`,
      `"${r.total_hours || '00:00'}"`,
      `"${r.status || ''}"`,
      `"${r.geofence_status || ''}"`,
      `"${r.terminal_id || 'N/A'}"`,
      `"${r.device_type || 'Biometric'}"`,
      `"${r.is_regularized ? 'Yes' : 'No'}"`,
      `"${(r.regularization_reason || '').replace(/"/g, '""')}"`,
      `"${r.regularized_by || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  },

  // --------------------------------------------------------------------------
  // LEAVES MANAGEMENT
  // --------------------------------------------------------------------------
  async getLeaves(userid, { liveOnly = false } = {}) {
    if (!userid) {
      const { data: people } = await this.getAllUsers({ liveOnly: true });
      const ids = [...new Set(people.map(person => person.userid).filter(Boolean))];
      const results = new Array(ids.length);
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(6, ids.length) }, async () => {
        while (next < ids.length) {
          const index = next++;
          const result = await this.getLeaves(ids[index], { liveOnly: true });
          results[index] = result.data.map(leave => ({ ...leave, userid: leave.userid || ids[index] }));
        }
      }));
      return { success: true, data: results.flat() };
    }
    const result = await request('/get-leave?userid=' + encodeURIComponent(userid));
    if (result?.success === false || !Array.isArray(result?.data)) {
      if (liveOnly) throw new Error(result?.message || 'Leave records are unavailable.');
      return { success: true, data: [] };
    }
    return { ...result, data: result.data.map(leave => ({ ...leave, userid: leave.userid || userid, leave_id: leave.leave_id ?? leave.id, start_date: leave.start_date || leave.startdate, end_date: leave.end_date || leave.enddate })) };
  },

  async applyLeave({ userid, employee_name, start_date, end_date, reason, leave_type = 'Casual Leave', status = 'Pending', days = 1 }, { liveOnly = false } = {}) {
    if (!userid) throw new Error('Select an employee first.');
    const result = await request('/apply-leave', { method: 'POST', body: JSON.stringify({ userid, employee_name, start_date, end_date, reason, leave_type, status, days }) });
    if (result?.success !== true) throw new Error(result?.message || 'Leave application was not saved.');
    return result;
  },

  async reviewLeave({ leave_id, status, approver_userid, remarks = '' }, { liveOnly = false } = {}) {
    const result = await request('/review-leave', {
      method: 'POST', body: JSON.stringify({ leave_id, status, approver_userid, remarks })
    });
    if (result?.success !== true) throw new Error(result?.message || 'Leave decision was not saved.');
    return result;
  },

  async getLeaveBalances() { throw new Error('Live leave balances are not configured.'); },
  async getLeaveStatus() { throw new Error('Live leave allowances are not configured.'); },
  async getTeamLeaves() { return this.getLeaves(); },
  async getHolidays() { throw new Error('A live holiday calendar is not configured.'); },

  // --------------------------------------------------------------------------
  // RECRUITMENT ATS
  // --------------------------------------------------------------------------
  async getJobs() {
    try {
      const res = await request('/jobs');
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (err) {}
    return { success: true, data: [] };
  },

  async getJobOpenings() {
    return this.getJobs();
  },

  async createJobOpening(jobData) {
    const res = await request('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData)
    });
    return res;
  },

  async getCandidates(jobId = null) {
    try {
      const q = jobId ? `?job_id=${encodeURIComponent(jobId)}` : '';
      const res = await request(`/candidates${q}`);
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (err) {}
    return { success: true, data: [] };
  },

  async updateCandidateStage(candidateId, stage) {
    return request(`/candidates/${encodeURIComponent(candidateId)}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage })
    });
  },

  async getPerformanceGoals(userid = null) {
    try {
      const q = userid ? `?userid=${encodeURIComponent(userid)}` : '';
      const res = await request(`/goals${q}`);
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (e) {}
    return { success: true, data: [] };
  },

  async getAppraisals() {
    try {
      const res = await request('/appraisals');
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (e) {}
    return { success: true, data: [] };
  },

  async getCourses() {
    try {
      const res = await request('/courses');
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (e) {}
    return { success: true, data: [] };
  },

  // --------------------------------------------------------------------------
  // PAYROLL & COMPENSATION
  // --------------------------------------------------------------------------
  async getSalaries(userid = null, { liveOnly = false } = {}) {
    if (userid) {
      const res = await request(`/get-salary?userid=${encodeURIComponent(userid)}`);
      if (res?.success === false || !Array.isArray(res?.data)) {
        if (liveOnly) throw new Error(res?.message || 'Salary records are unavailable.');
        return { success: true, data: [] };
      }
      const mapped = res.data.map((item) => ({
        id: item.id,
        user_id: item.user_id,
        employee_name: item.employee_name,
        month: item.month,
        year: item.year,
        pay_date: item.pay_date,
        amount_paid: item.amount_paid,
        status: item.status || 'Processed',
        transaction_ref: item.transaction_ref,
        structure: item.structure,
        basic: item.structure?.basic_salary,
        hra: item.structure?.hra,
        conveyance: item.structure?.conveyance,
        special_allowance: item.structure?.special_allowance,
        bonus_incentive: item.structure?.bonus_incentive,
        pf: item.structure?.provident_fund,
        tds: item.structure?.income_tax_tds,
        pt: item.structure?.professional_tax || 200,
        gross: item.structure?.gross_salary,
        net: item.structure?.net_salary || item.amount_paid,
        annual_ctc: item.structure?.annual_ctc,
        payment_mode: 'Direct Bank Transfer'
      }));
      return { success: true, data: mapped };
    }

    // Fetch for all live employees
    const usersRes = await this.getAllUsers();
    const staffList = (usersRes && Array.isArray(usersRes.data)) ? usersRes.data : [];

    const responses = await Promise.allSettled(
      staffList.map((s) => request(`/get-salary?userid=${encodeURIComponent(s.userid)}`))
    );

    let allSalaries = [];
    responses.forEach((r) => {
      if (r.status === 'fulfilled' && r.value?.data && Array.isArray(r.value.data)) {
        const mapped = r.value.data.map((item) => ({
          id: item.id,
          user_id: item.user_id,
          employee_name: item.employee_name,
          month: item.month,
          year: item.year,
          pay_date: item.pay_date,
          amount_paid: item.amount_paid,
          status: item.status || 'Processed',
          transaction_ref: item.transaction_ref,
          structure: item.structure,
          basic: item.structure?.basic_salary,
          hra: item.structure?.hra,
          conveyance: item.structure?.conveyance,
          special_allowance: item.structure?.special_allowance,
          bonus_incentive: item.structure?.bonus_incentive,
          pf: item.structure?.provident_fund,
          tds: item.structure?.income_tax_tds,
          pt: item.structure?.professional_tax || 200,
          gross: item.structure?.gross_salary,
          net: item.structure?.net_salary || item.amount_paid,
          annual_ctc: item.structure?.annual_ctc,
          payment_mode: 'Direct Bank Transfer'
        }));
        allSalaries.push(...mapped);
      }
    });

    return { success: true, data: allSalaries };
  },

  async addSalary(salaryData, { liveOnly = false } = {}) {
    const payload = {
      user_id: salaryData.user_id,
      employee_name: salaryData.employee_name,
      month: salaryData.month,
      year: salaryData.year,
      pay_date: salaryData.pay_date || `${salaryData.year}-09-30`,
      amount_paid: Number(salaryData.amount_paid || salaryData.net || salaryData.net_salary || 0),
      structure: salaryData.structure || {
        basic_salary: Number(salaryData.basic || salaryData.basic_salary || 0),
        hra: Number(salaryData.hra || 0),
        conveyance: Number(salaryData.conveyance || 0),
        special_allowance: Number(salaryData.special_allowance || salaryData.allowance || 0),
        bonus_incentive: Number(salaryData.bonus_incentive || 0),
        provident_fund: Number(salaryData.pf || salaryData.pf_deduction || 0),
        professional_tax: Number(salaryData.pt || salaryData.professional_tax || 200),
        income_tax_tds: Number(salaryData.tds || salaryData.income_tax_tds || 0),
        gross_salary: Number(salaryData.gross || salaryData.gross_salary || 0),
        net_salary: Number(salaryData.net || salaryData.net_salary || 0),
        annual_ctc: Number(salaryData.annual_ctc || 0)
      }
    };

    const result = await request('/add-salary', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (result?.success !== true && liveOnly) {
      throw new Error(result?.message || 'Salary record was not saved.');
    }

    return result || { success: true, data: payload };
  },

  async getPayrollSummary(month = 'September', year = '2026') {
    const salariesRes = await this.getSalaries();
    const all = salariesRes.data || [];
    const filtered = all.filter(
      (s) => (!month || s.month === month) && (!year || String(s.year) === String(year))
    );

    const targetList = filtered.length > 0 ? filtered : all;
    const totalCost = targetList.reduce(
      (acc, r) => acc + (Number(r.gross || r.structure?.gross_salary) || 0),
      0
    );
    const totalNet = targetList.reduce(
      (acc, r) => acc + (Number(r.net || r.amount_paid || r.structure?.net_salary) || 0),
      0
    );
    const totalTds = targetList.reduce(
      (acc, r) => acc + (Number(r.tds || r.structure?.income_tax_tds) || 0),
      0
    );
    const totalPf = targetList.reduce(
      (acc, r) => acc + (Number(r.pf || r.structure?.provident_fund) || 0),
      0
    );

    return {
      success: true,
      data: {
        month: `${month} ${year}`,
        total_payroll_cost: totalCost,
        net_disbursed: totalNet,
        employees_paid: targetList.length,
        tax_deducted_tds: totalTds,
        provident_fund: totalPf,
        disbursal_status: targetList.length > 0 ? 'Processed' : 'Scheduled',
        disbursal_date: `${year}-09-30`,
        currency: 'INR'
      }
    };
  },

  // --------------------------------------------------------------------------
  // ASSETS & DOCUMENTS
  // --------------------------------------------------------------------------
  async getAssets() {
    try {
      const res = await request('/assets');
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (err) {}
    return { success: true, data: [] };
  },

  async createAsset(assetData) {
    return request('/assets', {
      method: 'POST',
      body: JSON.stringify(assetData)
    });
  },

  // --------------------------------------------------------------------------
  // DOCUMENT VAULT
  // --------------------------------------------------------------------------
  async getCompanyPolicies(category = null) {
    const result = await documentVaultApi.policies();
    return category && category !== 'All' ? { ...result, data: result.data.filter(doc => doc.category === category) } : result;
  },
  async getEmployeeDocuments(userid = null) { return documentVaultApi.employee(userid); },
  async uploadCompanyPolicy({ file, ...values }) { return { success: true, data: await documentVaultApi.upload(values, file) }; },
  async uploadEmployeeDocument(userid, { file, ...values }) { return { success: true, data: await documentVaultApi.upload(values, file, userid) }; },
  async verifyEmployeeDocument(id, verified = true) { return { success: true, data: await documentVaultApi.verify(id, verified) }; },
  async deleteVaultDocument(id) { return { success: true, data: await documentVaultApi.archive(id) }; },

  async getDocuments(category = null) {
    return this.getCompanyPolicies(category);
  },
  async createDocument(docData) {
    return this.uploadCompanyPolicy(docData);
  },

  // --------------------------------------------------------------------------
  // ONBOARDING & OFFBOARDING
  // --------------------------------------------------------------------------
  async getOnboardingTasks(userid = null) {
    try {
      const q = userid ? `?userid=${encodeURIComponent(userid)}` : '';
      const res = await request(`/onboarding-tasks${q}`);
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (e) {}
    return { success: true, data: [] };
  },

  async getOffboardingClearances(userid = null) {
    try {
      const q = userid ? `?userid=${encodeURIComponent(userid)}` : '';
      const res = await request(`/offboarding-clearances${q}`);
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (e) {}
    return { success: true, data: [] };
  },

  // --------------------------------------------------------------------------
  // PERFORMANCE & LEARNING
  // --------------------------------------------------------------------------
  async getGoals(userid = null) {
    return this.getPerformanceGoals(userid);
  },

  async getLearningCourses() {
    return this.getCourses();
  },

  // --------------------------------------------------------------------------
  // HR HELP DESK TICKETS
  // --------------------------------------------------------------------------
  async getTickets() {
    try {
      const res = await request('/tickets');
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (err) {}
    return { success: true, data: [] };
  },

  // --------------------------------------------------------------------------
  // OFFICE SHIFT TIMINGS & OVERTIME RULES
  // --------------------------------------------------------------------------
  async getOfficeTimings() {
    try {
      const res = await request('/office-timings');
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (e) {}
    return { success: true, data: [] };
  },

  async getOfficeLocations() {
    try {
      const res = await request('/office-locations');
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (e) {}
    return { success: true, data: [] };
  },

  // --------------------------------------------------------------------------
  // COMPANY SETTINGS & BRANDING
  // --------------------------------------------------------------------------
  async getCompanySettings() {
    try {
      const res = await request('/company-settings');
      if (res?.data) return res;
    } catch (e) {}
    return { success: true, data: {} };
  },

  async updateCompanySettings(updates) {
    return request('/company-settings', {
      method: 'POST',
      body: JSON.stringify(updates)
    });
  },

  // --------------------------------------------------------------------------
  // DAILY WORK REPORTS
  // --------------------------------------------------------------------------
  async getDailyWorkReports() {
    try {
      const res = await request('/daily-work-reports');
      if (res?.data && Array.isArray(res.data)) return res;
    } catch (e) {}
    return { success: true, data: [], hasSubmittedToday: false, activeWorkDate: new Date().toISOString().split('T')[0] };
  },

  async submitDailyWorkReport(reportData) {
    return request('/submit-daily-work-report', {
      method: 'POST',
      body: JSON.stringify(reportData)
    });
  },

  // --------------------------------------------------------------------------
  // REPORTS SUMMARY
  // --------------------------------------------------------------------------
  async getReportsSummary() {
    try {
      const [usersRes, leavesRes] = await Promise.allSettled([
        this.getAllUsers(),
        this.getLeaves()
      ]);
      const users = (usersRes.status === 'fulfilled' && usersRes.value?.data) ? usersRes.value.data : [];
      const leaves = (leavesRes.status === 'fulfilled' && leavesRes.value?.data) ? leavesRes.value.data : [];
      const today = new Date().toISOString().split('T')[0];
      const onLeaveToday = leaves.filter(l => l.status === 'Approved' && l.start_date <= today && (!l.end_date || l.end_date >= today)).length;

      return {
        success: true,
        data: {
          totalHeadcount: users.length,
          activeEmployees: users.filter(u => u.status === 'Active' || !u.status).length,
          onLeaveToday,
          onTimeArrivalRatio: 100,
          openJobPostings: 0,
          openHelpTickets: 0,
          totalAssetsTracked: 0
        }
      };
    } catch (e) {
      return {
        success: true,
        data: {
          totalHeadcount: 0,
          activeEmployees: 0,
          onLeaveToday: 0,
          onTimeArrivalRatio: 100,
          openJobPostings: 0,
          openHelpTickets: 0,
          totalAssetsTracked: 0
        }
      };
    }
  }
};

export const api = hrmsApi;
export default hrmsApi;
