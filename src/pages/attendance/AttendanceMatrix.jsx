import React from 'react';
import { Button } from '../../components/ui/Button';
import { ChartLegend } from '../../components/charts/ChartLegend';
import { attendanceColors } from '../../components/charts/chartColors';
import { MockLocationIcon } from './MockLocationIcon';
import { ATTENDANCE_CODES, formatMinutes, matrixClosure } from './attendanceLedger';

const statusColors = {
  P: attendanceColors.present, L: attendanceColors.late, A: attendanceColors.absent, LV: attendanceColors.leave,
  R: '#76523f', EL: '#6953b3', SL: '#b04576', CL: '#337c54', PL: '#2855a5', LWP: '#a25725',
  HD: '#e48c51', WFH: '#10736e', WO: '#859646', H: '#896baa',
  NR: '#75859a', NA: '#a08e80', '-': '#aeb8c4', '?': '#b93239',
};
const legendItems = Object.entries(ATTENDANCE_CODES).map(([code, title]) => ({
  id: code,
  label: `${code}: ${title}`,
  color: statusColors[code],
}));
const leaveCodes = new Set(['CL', 'SL', 'EL', 'PL', 'LWP', 'LV', 'HD']);
const summaries = [
  { id: 'p', label: 'P' },
  { id: 'l', label: 'L' },
  { id: 'a', label: 'A' },
  { id: 'leaves', label: 'Leaves' },
  { id: 'hours', label: 'Hours' },
];

export function AttendanceMatrix({ rowHeading, columns, rows, officeHolidays, disableBeforeJoining = false }) {
  return (
    <>
      <div className="attendance-matrix-scroll">
        <table className="attendance-matrix">
          <thead>
            <tr>
              <th scope="col">{rowHeading}</th>
              {columns.map(({ id, label, weekday, weekend }) => {
                const holiday = officeHolidays?.get(id);
                return (
                  <th scope="col" key={id} className={`matrix-day-th${weekend ? ' is-weekend' : ''}`} data-holiday={Boolean(holiday) || undefined}
                    title={holiday ? `Office closed: ${holiday}` : undefined}>
                    <span>{label}</span>{weekday && <small>{weekday}</small>}
                    {holiday && <span className="sr-only">Office closed: {holiday}</span>}
                  </th>
                );
              })}
              {summaries.map(({ id, label }) => <th scope="col" key={id} className="matrix-summary-col">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const totals = { p: 0, l: 0, a: 0, leaves: 0, hours: 0 };
              for (const cell of row.cells) {
                if (cell.code === 'P') totals.p++;
                if (cell.code === 'L') totals.l++;
                if (cell.code === 'A') totals.a++;
                if (leaveCodes.has(cell.code)) totals.leaves++;
                totals.hours += cell.minutes ?? 0;
              }
              return (
                <tr key={row.id}>
                  <th scope="row" className={row.headingClass}>{row.heading}</th>
                  {columns.map(({ id }, index) => {
                    const cell = row.cells[index];
                    const day = row.days[index];
                    const closure = cell ? matrixClosure(cell, day, row.workingDays, officeHolidays) : '';
                    const label = cell && [row.personName, day, closure, cell.label].filter(Boolean).join(', ');
                    return (
                      <td key={id}>
                        {cell ? (
                          <Button className="attendance-matrix-cell" variant="fadeout" wrapContent={false}
                            style={{ '--matrix-status-color': statusColors[cell.code] }}
                            data-closed={Boolean(closure) || undefined}
                            disabled={disableBeforeJoining && cell.code === 'NA'}
                            title={label} aria-label={label} onClick={() => row.onOpenDay(day)}>
                            {cell.code}<MockLocationIcon records={cell.records} />
                          </Button>
                        ) : <span className="attendance-cell-empty" aria-label="Date does not exist" />}
                      </td>
                    );
                  })}
                  {summaries.map(({ id }) => (
                    <td key={id} className={`matrix-sum-val matrix-sum-val--${id}`}>
                      {id === 'hours' ? (totals.hours ? formatMinutes(totals.hours) : '—') : (row.unavailable ? '?' : totals[id])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="attendance-matrix-legend">
        <ChartLegend items={legendItems} label="Attendance matrix status codes" />
      </div>
    </>
  );
}
