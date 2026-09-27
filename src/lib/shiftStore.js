// Work Shift & Roster Profiles Store
// Manages multiple configurable enterprise shifts with custom options

const STORAGE_KEY = 'pulse_work_shifts';
function companyShiftKey() {
  try { const user = JSON.parse(localStorage.getItem('pulse_hrms_user') || '{}'); return user.company_id ? STORAGE_KEY + '_' + user.company_id : STORAGE_KEY; } catch { return STORAGE_KEY; }
}
export function cacheCompanyShifts(shifts) { localStorage.setItem(companyShiftKey(), JSON.stringify(shifts)); window.dispatchEvent(new Event('pulse-shifts-updated')); }


export const DEFAULT_SHIFTS = [
  {
    id: 'SH-GEN',
    name: 'General Day Shift',
    type: 'Regular',
    startTime: '09:30',
    endTime: '18:30',
    isOvernight: false,
    gracePeriodMins: 15,
    earlyExitGraceMins: 10,
    breakDurationMins: 60,
    halfDayHours: 4.5,
    fullDayHours: 8.5,
    allowancePerShift: 0,
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    isDefault: true,
    status: 'Active',
    description: 'Standard corporate day hours with 15-minute check-in grace period and 1-hour lunch break.'
  },
  {
    id: 'SH-MORN',
    name: 'Early Morning R&D Shift',
    type: 'Regular',
    startTime: '07:30',
    endTime: '16:30',
    isOvernight: false,
    gracePeriodMins: 10,
    earlyExitGraceMins: 10,
    breakDurationMins: 45,
    halfDayHours: 4.0,
    fullDayHours: 8.0,
    allowancePerShift: 150,
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    isDefault: false,
    status: 'Active',
    description: 'Early arrival schedule for development, DevOps on-call, and European handover teams.'
  },
  {
    id: 'SH-EVE',
    name: 'Afternoon / Evening Shift',
    type: 'Rotational',
    startTime: '14:00',
    endTime: '22:30',
    isOvernight: false,
    gracePeriodMins: 15,
    earlyExitGraceMins: 15,
    breakDurationMins: 45,
    halfDayHours: 4.0,
    fullDayHours: 8.0,
    allowancePerShift: 250,
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    isDefault: false,
    status: 'Active',
    description: 'Rotational evening shift covering US overlap and late support operations.'
  },
  {
    id: 'SH-NIGHT',
    name: 'Global Night Graveyard Shift',
    type: 'Night',
    startTime: '22:00',
    endTime: '06:30',
    isOvernight: true,
    gracePeriodMins: 15,
    earlyExitGraceMins: 15,
    breakDurationMins: 45,
    halfDayHours: 4.0,
    fullDayHours: 8.0,
    allowancePerShift: 500,
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    isDefault: false,
    status: 'Active',
    description: 'Overnight critical infrastructure monitoring with mandatory night differential allowance.'
  },
  {
    id: 'SH-FLEX',
    name: 'Flexible Core Hours Shift',
    type: 'Flexible',
    startTime: '10:00',
    endTime: '19:00',
    isOvernight: false,
    gracePeriodMins: 30,
    earlyExitGraceMins: 30,
    breakDurationMins: 60,
    halfDayHours: 4.0,
    fullDayHours: 8.0,
    allowancePerShift: 0,
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    isDefault: false,
    status: 'Active',
    description: 'Flexible arrival window between 08:30 and 10:30 with mandatory core attendance 11:00 to 16:00.'
  },
  {
    id: 'SH-WKND',
    name: 'Weekend Support & Escalations',
    type: 'Weekend',
    startTime: '09:00',
    endTime: '18:00',
    isOvernight: false,
    gracePeriodMins: 15,
    earlyExitGraceMins: 15,
    breakDurationMins: 60,
    halfDayHours: 4.0,
    fullDayHours: 8.0,
    allowancePerShift: 750,
    workingDays: ['Sat', 'Sun'],
    isDefault: false,
    status: 'Active',
    description: 'Dedicated 2-day weekend shift with compensatory off and 1.5x shift premium rate.'
  }
];

export function getShifts() {
  try {
    const raw = localStorage.getItem(companyShiftKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load shifts from localStorage:', e);
  }
  return companyShiftKey() === STORAGE_KEY ? DEFAULT_SHIFTS : [];
}

export function saveShift(shift) {
  const current = getShifts();
  let updated;
  const existingIndex = current.findIndex((s) => s.id === shift.id);

  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = { ...updated[existingIndex], ...shift };
  } else {
    updated = [...current, shift];
  }

  // If this shift is marked default, unset others
  if (shift.isDefault) {
    updated = updated.map((s) => ({
      ...s,
      isDefault: s.id === shift.id
    }));
  }

  try {
    localStorage.setItem(companyShiftKey(), JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save shifts:', e);
  }

  return updated;
}

export function deleteShift(shiftId) {
  const current = getShifts();
  const updated = current.filter((s) => s.id !== shiftId);
  try {
    localStorage.setItem(companyShiftKey(), JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete shift:', e);
  }
  return updated;
}

export function setDefaultShift(shiftId) {
  const current = getShifts();
  const updated = current.map((s) => ({
    ...s,
    isDefault: s.id === shiftId
  }));
  try {
    localStorage.setItem(companyShiftKey(), JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to set default shift:', e);
  }
  return updated;
}

export function toggleShiftStatus(shiftId) {
  const current = getShifts();
  const updated = current.map((s) =>
    s.id === shiftId
      ? { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' }
      : s
  );
  try {
    localStorage.setItem(companyShiftKey(), JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to toggle shift status:', e);
  }
  return updated;
}

export function resetShiftsToDefault() {
  try {
    localStorage.removeItem(companyShiftKey());
  } catch (e) {
    console.error('Failed to reset shifts:', e);
  }
  return DEFAULT_SHIFTS;
}

export function getWorkingDays() {
  try {
    const shifts = getShifts();
    const defaultShift = shifts.find((s) => s.isDefault) || shifts[0];
    if (defaultShift && Array.isArray(defaultShift.workingDays) && defaultShift.workingDays.length > 0) {
      return defaultShift.workingDays;
    }
  } catch (e) {
    console.warn('Error reading workingDays from shifts, using fallback:', e);
  }
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
}

export function getWeeklyOffDays() {
  const working = getWorkingDays();
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return allDays.filter((d) => !working.includes(d));
}

export function generateAttendanceTrendData(customWorkingDays) {
  const workingDays = customWorkingDays || getWorkingDays();
  const daysInSept = 23; // Real dates up to current date (Sep 23, 2026)
  const result = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let d = 1; d <= daysInSept; d++) {
    // Sep 1, 2026 was a Tuesday (2)
    const dayOfWeek = (2 + d - 1) % 7;
    const dayName = dayNames[dayOfWeek];

    // Hide any weekly off day based on settings
    if (!workingDays.includes(dayName)) {
      continue;
    }

    const dayNumStr = String(d).padStart(2, '0');
    const isToday = d === 23;

    // Deterministic realistic daily variation
    const variance = ((d * 17) % 7) - 3;
    const presentRate = Number((94.5 + variance * 0.4).toFixed(1));
    const totalHeadcount = 148;
    const presentCount = Math.round((presentRate / 100) * totalHeadcount);
    const absentCount = Math.max(2, Math.round(((100 - presentRate) / 100) * totalHeadcount * 0.5));
    const onLeaveCount = totalHeadcount - presentCount - absentCount;
    const onTimeRate = Number((presentRate + 0.8).toFixed(1));

    result.push({
      day: isToday ? 'Today' : dayName,
      dayOfWeek: dayName,
      date: `Sep ${dayNumStr}`,
      fullDate: isToday ? `Today (Sep ${dayNumStr}, 2026)` : `Sep ${dayNumStr}, 2026 (${dayName})`,
      presentRate,
      presentCount,
      absentCount,
      onLeaveCount,
      onTimeRate: Math.min(100, onTimeRate)
    });
  }

  return result;
}
