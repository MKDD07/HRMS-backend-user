import { TenantPanel } from '../../components/ui/TenantPanel';
import { ChartLegend } from '../../components/charts/ChartLegend';
import { attendanceColors, chartPalette } from '../../components/charts/chartColors';
import { MetricOverview, MetricCard } from '../../components/ui/MetricOverview';
import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Users, Calendar, TrendingUp, AlertTriangle, CheckCircle2, Clock, PieChart as PieIcon, BarChart3, Filter } from 'lucide-react';
import { formatMinutes } from './attendanceLedger';

const LEAVE_COLORS = {
  'Casual Leave (CL)': chartPalette[0],
  'Sick Leave (SL)': chartPalette[1],
  'Earned Leave (EL)': chartPalette[2],
  'Paid Leave (PL)': chartPalette[3],
  'Leave Without Pay (LWP)': chartPalette[4],
  'Half Day (HD)': chartPalette[5],
  'Other Approved Leave': chartPalette[6],
};

export function AttendanceLeaveCharts({ people = [], dates = [], ledger = {}, month = new Date() }) {
  const [selectedDept, setSelectedDept] = useState('All');

  const departments = useMemo(() => {
    return ['All', ...new Set(people.map(p => p.department).filter(Boolean))].sort();
  }, [people]);

  const filteredPeople = useMemo(() => {
    if (selectedDept === 'All') return people;
    return people.filter(p => p.department === selectedDept);
  }, [people, selectedDept]);

  // Compute aggregated stats
  const analytics = useMemo(() => {
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let clCount = 0;
    let slCount = 0;
    let elCount = 0;
    let plCount = 0;
    let lwpCount = 0;
    let hdCount = 0;
    let otherLeaveCount = 0;
    let totalMinutes = 0;

    const deptMap = {};

    filteredPeople.forEach(person => {
      const dept = person.department || 'General';
      if (!deptMap[dept]) {
        deptMap[dept] = { dept, present: 0, late: 0, absent: 0, leaves: 0, count: 0 };
      }
      deptMap[dept].count += 1;

      dates.forEach(day => {
        const cell = ledger[person.userid]?.[day];
        if (!cell) return;

        if (cell.code === 'P') {
          presentCount++;
          deptMap[dept].present++;
        } else if (cell.code === 'L') {
          lateCount++;
          deptMap[dept].late++;
        } else if (cell.code === 'A') {
          absentCount++;
          deptMap[dept].absent++;
        } else if (cell.code === 'CL') {
          clCount++;
          deptMap[dept].leaves++;
        } else if (cell.code === 'SL') {
          slCount++;
          deptMap[dept].leaves++;
        } else if (cell.code === 'EL') {
          elCount++;
          deptMap[dept].leaves++;
        } else if (cell.code === 'PL') {
          plCount++;
          deptMap[dept].leaves++;
        } else if (cell.code === 'LWP') {
          lwpCount++;
          deptMap[dept].leaves++;
        } else if (cell.code === 'HD') {
          hdCount++;
          deptMap[dept].leaves += 0.5;
        } else if (['LV'].includes(cell.code)) {
          otherLeaveCount++;
          deptMap[dept].leaves++;
        }

        if (cell.minutes) totalMinutes += cell.minutes;
      });
    });

    const totalLeaves = clCount + slCount + elCount + plCount + lwpCount + otherLeaveCount + hdCount;
    const totalWorkingEvents = presentCount + lateCount + absentCount + totalLeaves;
    const attendanceRate = totalWorkingEvents > 0 ? Math.round(((presentCount + lateCount) / totalWorkingEvents) * 100) : 0;

    const leavePieData = [
      { name: 'Casual Leave (CL)', value: clCount },
      { name: 'Sick Leave (SL)', value: slCount },
      { name: 'Earned Leave (EL)', value: elCount },
      { name: 'Paid Leave (PL)', value: plCount },
      { name: 'Leave Without Pay (LWP)', value: lwpCount },
      { name: 'Half Day (HD)', value: hdCount },
      { name: 'Other Approved Leave', value: otherLeaveCount }
    ].filter(item => item.value > 0);

    const deptBarData = Object.values(deptMap);

    const overallComposition = [
      { name: 'Present', count: presentCount, fill: attendanceColors.present },
      { name: 'Late', count: lateCount, fill: attendanceColors.late },
      { name: 'Absent', count: absentCount, fill: attendanceColors.absent },
      { name: 'Leaves', count: totalLeaves, fill: attendanceColors.leave }
    ];

    return {
      presentCount,
      lateCount,
      absentCount,
      totalLeaves,
      attendanceRate,
      totalMinutes,
      leavePieData,
      deptBarData,
      overallComposition
    };
  }, [filteredPeople, dates, ledger]);

  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="attendance-analytics-view">
      {/* Top filter bar */}
      <TenantPanel title="Attendance & leave insights" subtitle={monthLabel} icon={PieIcon} controls={<select aria-label="Analytics department" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
            {departments.map(dept => (
              <option key={dept} value={dept}>
                {dept === 'All' ? 'All Departments' : dept}
              </option>
            ))}
          </select>} />

      {/* KPI Cards Row */}
      <MetricOverview as="div">
        <MetricCard label="Attendance Rate" icon={CheckCircle2} value={<>{analytics.attendanceRate}%</>} caption={<>{analytics.presentCount + analytics.lateCount} recorded present days</>} />

        <MetricCard label="Total Leaves Recorded" icon={Calendar} value={analytics.totalLeaves} caption={<>Across {filteredPeople.length} employees</>} />

        <MetricCard label="Late Arrivals" icon={Clock} value={analytics.lateCount} caption="Flagged punch timing" />

        <MetricCard label="Logged Work Hours" icon={TrendingUp} value={formatMinutes(analytics.totalMinutes)} caption="Total reported employee duration" />
      </MetricOverview>

      {/* Charts Grid */}
      <div className="attendance-charts-grid workspace-grid">
        {/* Leave Breakdown Chart */}
        <TenantPanel className="attendance-chart-card" title={<>Leave Distribution by Category</>} subtitle={<>Detailed split of applied and approved leave types</>} icon={PieIcon}>
          

          <div className="attendance-chart-container">
            {analytics.leavePieData.length === 0 ? (
              <div className="attendance-chart-empty">
                <Calendar size={32} />
                <p>No leaves recorded for this period.</p>
              </div>
            ) : (
              <div className="attendance-pie-layout">
                <div className="attendance-pie-canvas">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={analytics.leavePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {analytics.leavePieData.map(entry => (
                          <Cell key={entry.name} fill={LEAVE_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val, name) => [`${val} days`, name]}
                        contentStyle={{ borderRadius: '8px', background: '#27292C', color: '#fff', border: 'none' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ChartLegend items={analytics.leavePieData.map(entry => ({
                  id: entry.name,
                  label: entry.name,
                  color: LEAVE_COLORS[entry.name],
                  detail: `${entry.value} d (${Math.round(entry.value / analytics.totalLeaves * 100)}%)`,
                }))} />
              </div>
            )}
          </div>
        </TenantPanel>

        {/* Overall Status Composition Bar */}
        <TenantPanel className="attendance-chart-card" title={<>Attendance Composition</>} subtitle={<>Present vs Late vs Absent vs Leaves comparison</>} icon={BarChart3}>
          

          <div className="attendance-chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.overallComposition} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  formatter={val => [`${val} days`, 'Count']}
                  contentStyle={{ borderRadius: '8px', background: '#27292C', color: '#fff', border: 'none' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" barSize={5} radius={[3, 3, 0, 0]}>
                  {analytics.overallComposition.map(entry => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TenantPanel>
      </div>

      {/* Department Breakdown Bar Chart if more than 1 dept */}
      {analytics.deptBarData.length > 1 && (
        <TenantPanel className="attendance-chart-card attendance-chart-card--wide" title={<>Department Attendance &amp; Leave Matrix</>} subtitle={<>Comparison of present days, late entries, and leave volume across teams</>} icon={Users}>
          

          <div className="attendance-chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.deptBarData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dept" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  contentStyle={{ borderRadius: '8px', background: '#27292C', color: '#fff', border: 'none' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend content={<ChartLegend />} />
                <Bar dataKey="present" name="Present (P)" fill={attendanceColors.present} barSize={5} radius={[3, 3, 0, 0]} />
                <Bar dataKey="late" name="Late (L)" fill={attendanceColors.late} barSize={5} radius={[3, 3, 0, 0]} />
                <Bar dataKey="absent" name="Absent (A)" fill={attendanceColors.absent} barSize={5} radius={[3, 3, 0, 0]} />
                <Bar dataKey="leaves" name="Leaves (All)" fill={attendanceColors.leave} barSize={5} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TenantPanel>
      )}
    </div>
  );
}
export default AttendanceLeaveCharts;
