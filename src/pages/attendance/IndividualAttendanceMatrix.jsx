import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import { AttendanceMatrix } from './AttendanceMatrix';
import React, { useMemo } from 'react';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { ATTENDANCE_CODES, dayLedger, monthDates } from './attendanceLedger';
import { Calendar } from 'lucide-react';

export function IndividualAttendanceMatrix({ person, records, leaves, year, today, onOpenDay, leaveUnavailable, controls, directory, officeHolidays, workingDays }) {
  const joined = String(person.date_of_joining || person.joining_date || '').slice(0, 10);
  const validJoining = /^\d{4}-\d{2}-\d{2}$/.test(joined);

  const rows = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(year, index, 1);
      const days = monthDates(date);
      const cells = days.map(day => dayLedger(records ?? null, leaves, person.userid, day, today, joined));

      return {
        month: date.toLocaleDateString('en-GB', { month: 'long' }),
        days,
        cells
      };
    }).filter(row => !validJoining || row.days[row.days.length - 1] >= joined);
  }, [year, records, leaves, person.userid, today, joined, validJoining]);

  const counts = useMemo(() => {
    return Object.fromEntries(
      Object.keys(ATTENDANCE_CODES).map(code => [
        code,
        rows.reduce((sum, row) => sum + row.cells.filter(cell => cell.code === code).length, 0)
      ])
    );
  }, [rows]);

  const totalLeavesYear = (counts.CL || 0) + (counts.SL || 0) + (counts.EL || 0) + (counts.PL || 0) + (counts.LWP || 0) + (counts.LV || 0) + (counts.HD || 0);

  const personFullName = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || person.userid;

  return (
    <>
      <TenantPanel className="attendance-annual-summary" title={<>{personFullName} / Annual Matrix</>} subtitle="Totals in days" controls={controls}>
        <MetricOverview aria-label="Annual attendance summary" singleRow tabIndex={0}>
          {[["Present", "P", counts.P], ["Late", "L", counts.L], ["Absent", "A", counts.A], ["Total leave", "LV", totalLeavesYear], ["Casual leave", "CL", counts.CL], ["Sick leave", "SL", counts.SL], ["Earned leave", "EL", counts.EL], ["Unpaid leave", "LWP", counts.LWP]].map(([label, code, value]) => <MetricCard key={code} label={label} icon={Calendar} value={records === null ? '–' : value || 0} caption="" />)}
        </MetricOverview>
      </TenantPanel>
      <div className="attendance-person-workspace workspace-grid">
        <div className="attendance-person-content">
          <TenantPanel className="attendance-panel attendance-annual-panel" title="Attendance calendar">
            {leaveUnavailable && <p className="attendance-note">Leave source unavailable. Leave counts may be incomplete.</p>}
            <AttendanceMatrix
              rowHeading={'Month / ' + year}
              officeHolidays={officeHolidays}
              columns={Array.from({ length: 31 }, (_, index) => ({ id: index + 1, label: index + 1 }))}
              rows={rows.map(row => ({
                ...row,
                id: row.month,
                heading: <strong>{row.month}</strong>,
                workingDays,
                unavailable: records === null,
                onOpenDay: day => onOpenDay(person, day),
              }))}
              disableBeforeJoining
            />
            {!rows.length && <div className="attendance-empty">This employee had not joined during {year}.</div>}

          </TenantPanel>
        </div>
        {directory}
      </div>
    </>
  );
}

export default IndividualAttendanceMatrix;
