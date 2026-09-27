import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  List,
  LayoutGrid,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { generateMonthAttendance } from '../employeeDataHelpers';

const pad = (n) => String(n).padStart(2, '0');

const toMinutes = (t) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || '').trim());
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
};

const hoursToMinutes = (s) => {
  const m = /(\d+):(\d+)/.exec(s || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function AttendanceTab({ employee, onShowToast }) {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(8); // 8 is September (0-indexed)
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Day attendance records
  const [days, setDays] = useState(() => generateMonthAttendance(selectedYear, selectedMonthIndex));
  const [selectedDay, setSelectedDay] = useState(14); // default to simulation day
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonthIndex === 0) {
      setSelectedMonthIndex(11);
      setSelectedYear((y) => y - 1);
      setDays(generateMonthAttendance(selectedYear - 1, 11));
    } else {
      setSelectedMonthIndex((m) => m - 1);
      setDays(generateMonthAttendance(selectedYear, selectedMonthIndex - 1));
    }
    setSelectedDay(null);
    setIsAdjusting(false);
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex === 11) {
      setSelectedMonthIndex(0);
      setSelectedYear((y) => y + 1);
      setDays(generateMonthAttendance(selectedYear + 1, 0));
    } else {
      setSelectedMonthIndex((m) => m + 1);
      setDays(generateMonthAttendance(selectedYear, selectedMonthIndex + 1));
    }
    setSelectedDay(null);
    setIsAdjusting(false);
  };

  const handleToday = () => {
    setSelectedYear(2026);
    setSelectedMonthIndex(8);
    setDays(generateMonthAttendance(2026, 8));
    setSelectedDay(14);
    setIsAdjusting(false);
  };

  const selectedRecord = useMemo(
    () => days.find((d) => d.day === selectedDay) || null,
    [days, selectedDay]
  );

  const leadingBlanks = useMemo(
    () => new Date(selectedYear, selectedMonthIndex, 1).getDay(),
    [selectedYear, selectedMonthIndex]
  );

  const monthLabel = useMemo(
    () => new Date(selectedYear, selectedMonthIndex, 1).toLocaleString('en-IN', {
      month: 'long',
      year: 'numeric'
    }),
    [selectedYear, selectedMonthIndex]
  );

  // Statistics
  const presentDays = days.filter((d) => d.status === 'Present');
  const leavesCount = days.filter((d) => d.status === 'Leave').length;
  const weekendCount = days.filter((d) => d.status === 'Weekend').length;
  const totalWorkingDays = days.filter((d) => !d.isWeekend).length;

  const workedMinutes = presentDays
    .map((d) => hoursToMinutes(d.hours))
    .filter((m) => m !== null);

  const avgMinutes = workedMinutes.length
    ? Math.round(workedMinutes.reduce((a, b) => a + b, 0) / workedMinutes.length)
    : null;

  const openDayDetails = (item) => {
    setSelectedDay(item.day);
    setCheckIn(item.checkIn || '09:15 AM');
    setCheckOut(item.checkOut || '06:30 PM');
    setIsAdjusting(false);
  };

  const handleApplyPunch = () => {
    if (!selectedRecord) return;
    const inM = toMinutes(checkIn);
    const outM = toMinutes(checkOut);
    if (inM === null || outM === null || outM <= inM) {
      onShowToast?.({
        type: 'error',
        title: 'Invalid Punch Time',
        message: 'Please provide valid time formats (e.g. 09:15 AM) where Check-Out is after Check-In.'
      });
      return;
    }
    const worked = outM - inM;
    const formattedHours = `${pad(Math.floor(worked / 60))}:${pad(worked % 60)} hrs`;

    setDays((prev) =>
      prev.map((d) =>
        d.day === selectedRecord.day
          ? {
              ...d,
              status: 'Present',
              checkIn,
              checkOut,
              hours: formattedHours,
              note: 'Regularized & Verified by Admin'
            }
          : d
      )
    );
    setIsAdjusting(false);
    onShowToast?.({
      type: 'success',
      title: 'Attendance Regularized',
      message: `Day ${selectedRecord.day} attendance updated to ${checkIn} - ${checkOut} (${formattedHours}).`
    });
  };

  return (
    <div className="space-y-4 pt-1">
      {/* Top Header & Calendar Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F9FAFB] p-3.5 rounded-xl border border-[#E5E7EB]">
        <div>
          <h4 className="text-sm font-semibold text-[#111827] flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-[#4F46E5]" />
            Monthly Attendance & Biometric Record
          </h4>
          <p className="text-xs text-[#4B5563] mt-0.5">
            Verified check-in punches & geofence validation for {employee.first_name} {employee.last_name}
          </p>
        </div>

        {/* Controls: Prev/Next Month, Today & View Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white rounded-lg border border-[#E5E7EB] p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded hover:bg-[#F3F4F6] text-[#4B5563] hover:text-[#111827] transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-xs text-[#111827] px-2 min-w-[110px] text-center select-none">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded hover:bg-[#F3F4F6] text-[#4B5563] hover:text-[#111827] transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold text-[#374151] bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] hover:text-[#111827] shadow-2xs transition-all cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#111827] shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
              title="Calendar Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1 rounded transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#111827] shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
              title="Punch Timeline List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Attendance KPI Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#6B7280]">Present Days</span>
            <span className="text-[10px] font-semibold text-[#065F46] bg-[#ECFDF5] px-1.5 py-0.5 rounded">
              {Math.round((presentDays.length / (totalWorkingDays || 1)) * 100)}% on-time
            </span>
          </div>
          <p className="text-lg font-bold text-[#111827] mt-1">
            {presentDays.length}{' '}
            <span className="text-xs font-normal text-[#6B7280]">/ {totalWorkingDays} working days</span>
          </p>
        </div>

        <div className="p-3 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#6B7280]">Approved Leaves</span>
            <span className="text-[10px] font-semibold text-[#92400E] bg-[#FFFBEB] px-1.5 py-0.5 rounded">
              Casual / Sick
            </span>
          </div>
          <p className="text-lg font-bold text-[#F59E0B] mt-1">
            {leavesCount}{' '}
            <span className="text-xs font-normal text-[#6B7280]">Day(s)</span>
          </p>
        </div>

        <div className="p-3 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#6B7280]">Weekly Offs</span>
            <span className="text-[10px] font-semibold text-[#374151] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
              Sat & Sun
            </span>
          </div>
          <p className="text-lg font-bold text-[#4B5563] mt-1">
            {weekendCount}{' '}
            <span className="text-xs font-normal text-[#6B7280]">Days</span>
          </p>
        </div>

        <div className="p-3 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#6B7280]">Avg Daily Hours</span>
            <span className="text-[10px] font-semibold text-[#4F46E5] bg-[#EEF2FF] px-1.5 py-0.5 rounded">
              Target: 8h 30m
            </span>
          </div>
          <p className="text-lg font-bold text-[#4F46E5] mt-1">
            {avgMinutes === null ? '—' : `${Math.floor(avgMinutes / 60)}h ${pad(avgMinutes % 60)}m`}
          </p>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE CALENDAR GRID */}
      {viewMode === 'grid' ? (
        <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white shadow-2xs">
          {/* Day Names Header */}
          <div className="grid grid-cols-7 bg-[#F9FAFB] text-center text-[#4B5563] text-xs font-bold py-2.5 border-b border-[#E5E7EB] uppercase tracking-wider">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className={d === 'Sun' || d === 'Sat' ? 'text-[#9CA3AF]' : 'text-[#374151]'}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-1.5 p-2 bg-[#F9FAFB]/50">
            {/* Blank leading padding cells */}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="p-2 min-h-[72px] rounded-xl bg-transparent" />
            ))}

            {days.map((item) => {
              const isSelected = selectedDay === item.day;
              const isToday = item.day === 14 && selectedMonthIndex === 8 && selectedYear === 2026;

              // Card styling dynamically colored based on status
              const cardBg = isSelected
                ? 'bg-[#EEF2FF] border-2 border-[#4F46E5] shadow-sm'
                : isToday
                  ? 'bg-[#ECFDF5] border-2 border-[#059669] shadow-sm'
                  : item.status === 'Present'
                    ? 'bg-[#ECFDF5] border border-[#A7F3D0] hover:bg-[#D1FAE5] hover:border-[#6EE7B7]'
                    : item.status === 'Leave'
                      ? 'bg-[#FFFBEB] border border-[#FDE68A] hover:bg-[#FEF3C7]'
                      : item.status === 'Absent'
                        ? 'bg-[#FEF2F2] border border-[#FECACA] hover:bg-[#FEE2E2]'
                        : item.isWeekend
                          ? 'bg-[#F3F4F6]/70 border border-[#E5E7EB]'
                          : 'bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB]';

              const dayTextColor = isSelected
                ? 'text-[#4F46E5]'
                : isToday
                  ? 'text-[#065F46]'
                  : item.status === 'Present'
                    ? 'text-[#065F46]'
                    : item.status === 'Leave'
                      ? 'text-[#92400E]'
                      : item.status === 'Absent'
                        ? 'text-[#991B1B]'
                        : item.isWeekend
                          ? 'text-[#9CA3AF]'
                          : 'text-[#111827]';

              return (
                <div
                  key={item.day}
                  onClick={() => openDayDetails(item)}
                  className={`p-2.5 min-h-[72px] rounded-xl transition-all cursor-pointer flex flex-col justify-between ${cardBg}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${dayTextColor}`}>
                      {item.day}
                    </span>

                    {/* Status Badge: No 'P' on present cards; clean badges for Leave/Absent/Weekend */}
                    {item.status === 'Leave' && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                        Leave
                      </span>
                    )}

                    {item.status === 'Absent' && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
                        Absent
                      </span>
                    )}

                    {item.status === 'Weekend' && (
                      <span className="text-[9px] font-medium px-1 text-[#9CA3AF]">
                        OFF
                      </span>
                    )}
                  </div>

                  <div className="mt-1 font-mono text-[10px]">
                    {item.status === 'Present' && item.checkIn && (
                      <>
                        <p className="text-[#065F46] font-semibold leading-tight truncate">
                          {item.checkIn}
                        </p>
                        <p className="text-[#047857] text-[9px] leading-tight truncate">
                          {item.checkOut || item.hours}
                        </p>
                      </>
                    )}
                    {item.status === 'Leave' && (
                      <p className="text-[#B45309] text-[9px] leading-tight truncate font-sans font-medium">
                        {item.note || 'Casual Leave'}
                      </p>
                    )}
                    {item.status === 'Absent' && (
                      <p className="text-[#DC2626] text-[9px] leading-tight truncate font-sans font-medium">
                        Unexcused
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VIEW 2: PUNCH LOG TIMELINE LIST VIEW */
        <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] text-[#4B5563] border-b border-[#E5E7EB] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">First In</th>
                  <th className="py-3 px-4">Last Out</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Verification Note</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F3F5] text-[#27292C]">
                {days.map((item) => (
                  <tr
                    key={item.day}
                    onClick={() => openDayDetails(item)}
                    className={`hover:bg-[#F9FAFB] transition-colors cursor-pointer ${
                      selectedDay === item.day ? 'bg-[#EEF2FF]/60' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-[#111827]">
                      {item.date} ({item.dayName})
                    </td>
                    <td className="py-2.5 px-4">
                      {item.status === 'Present' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                          Present
                        </span>
                      ) : item.status === 'Leave' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                          Leave
                        </span>
                      ) : item.status === 'Weekend' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-[#F3F4F6] text-[#6B7280]">
                          Weekend Off
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF]">Upcoming</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#111827]">
                      {item.checkIn || '—'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[#6B7280]">
                      {item.checkOut || '—'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#4F46E5]">
                      {item.hours !== '00:00' ? item.hours : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-[#6B7280] truncate max-w-[200px]">
                      {item.note || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDayDetails(item);
                          setIsAdjusting(true);
                        }}
                        className="text-xs font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Day Details & Regularization Drawer */}
      {selectedRecord && (
        <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#111827]">
                  Day {selectedRecord.day}: {selectedRecord.date} ({selectedRecord.dayName})
                </span>
                <Badge
                  variant={
                    selectedRecord.status === 'Present'
                      ? 'success'
                      : selectedRecord.status === 'Leave'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {selectedRecord.status}
                </Badge>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {selectedRecord.checkIn ? `In: ${selectedRecord.checkIn} • ` : ''}
                {selectedRecord.checkOut ? `Out: ${selectedRecord.checkOut} • ` : ''}
                {selectedRecord.hours && selectedRecord.hours !== '00:00'
                  ? `Total: ${selectedRecord.hours} • `
                  : ''}
                {selectedRecord.note || 'Standard Shift'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="xs"
                icon={Clock}
                onClick={() => setIsAdjusting((prev) => !prev)}
              >
                {isAdjusting ? 'Close Adjust' : 'Regularize Punch'}
              </Button>
            </div>
          </div>

          {/* Regularize Punch Form Drawer */}
          {isAdjusting && (
            <div className="p-3.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-[#1E3A8A] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                  Admin Punch Regularization: Day {selectedRecord.day} ({selectedRecord.date})
                </h5>
                <button
                  type="button"
                  onClick={() => setIsAdjusting(false)}
                  className="text-xs font-semibold text-[#1E3A8A] hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1E3A8A] mb-1">
                    Check-In Time *
                  </label>
                  <input
                    type="text"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#BFDBFE] bg-white font-mono"
                    placeholder="e.g. 09:15 AM"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1E3A8A] mb-1">
                    Check-Out Time *
                  </label>
                  <input
                    type="text"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#BFDBFE] bg-white font-mono"
                    placeholder="e.g. 06:30 PM"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="primary"
                  size="xs"
                  icon={CheckCircle2}
                  onClick={handleApplyPunch}
                >
                  Save Regularized Punch
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
