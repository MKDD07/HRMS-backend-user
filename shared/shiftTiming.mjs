const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
export function shiftTimingError(shift) {
  for (const key of ['shortLeaveEnabled', 'earlyInEnabled', 'earlyOutEnabled']) {
    if (shift[key] != null && typeof shift[key] !== 'boolean') return 'Choose whether short-leave options are enabled.';
  }
  if (shift.breakStartTime || shift.breakEndTime) {
    if (!validTime(shift.breakStartTime) || !validTime(shift.breakEndTime)) return 'Enter both break start and end times.';
    if (!validTime(shift.startTime) || !validTime(shift.endTime)) return 'Enter valid shift times.';
    const duration = (minutes(shift.endTime) - minutes(shift.startTime) + 1440) % 1440;
    const start = (minutes(shift.breakStartTime) - minutes(shift.startTime) + 1440) % 1440;
    const end = (minutes(shift.breakEndTime) - minutes(shift.startTime) + 1440) % 1440;
    if (end <= start || end > duration) return 'The break window must fall within the shift.';
    if (end - start !== shift.breakDurationMins) return 'Break duration must match the selected break window.';
  }
  if (shift.shortLeaveEnabled) {
    if (!shift.earlyInEnabled && !shift.earlyOutEnabled) return 'Enable early in or early out for short leave.';
    if (shift.earlyInEnabled && !validTime(shift.earlyInTime)) return 'Enter a valid early-in time.';
    if (shift.earlyOutEnabled && !validTime(shift.earlyOutTime)) return 'Enter a valid early-out time.';
  }
  return '';
}
