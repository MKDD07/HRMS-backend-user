let snapshot;
export function readAttendanceSnapshot(scope, now = Date.now()) {
  if (snapshot?.scope !== scope) snapshot = undefined;
  return snapshot && now - snapshot.at < 60000 ? snapshot.value : null;
}
export function saveAttendanceSnapshot(scope, value, now = Date.now()) {
  snapshot = { scope, value, at: now };
}
export function clearAttendanceSnapshot() { snapshot = undefined; }
if (typeof window !== 'undefined') {
  window.addEventListener('pulse-workspace-refresh', clearAttendanceSnapshot);
  window.addEventListener('pulse-attendance-corrected', clearAttendanceSnapshot);
}
