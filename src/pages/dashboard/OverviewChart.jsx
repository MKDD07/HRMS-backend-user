import { CircleHelp } from 'lucide-react';
import React, { useState, useId } from 'react';
import { Button } from '../../components/ui/Button';
import { ChartLegend } from '../../components/charts/ChartLegend';
import { attendanceColors, chartPalette as colors } from '../../components/charts/chartColors';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const formatChartDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(value + 'T12:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : value;
function AttendanceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="attendance-chart-tooltip"><p>{formatChartDate(label)}</p>{payload.map(item => <div key={item.dataKey}><span><i style={{ background: attendanceColors[item.dataKey] || item.color }} />{item.name}</span><strong>{item.value == null ? 'Unavailable' : Number(item.value).toLocaleString('en-IN')}</strong></div>)}</div>;
}
export function ChartHelp({ children }) {
  const id = useId();
  return <span className="overview-chart-help"><button type="button" className="overview-chart-help__trigger" aria-label="How attendance is calculated" aria-describedby={id}><CircleHelp size={16} aria-hidden="true" /></button><span id={id} role="tooltip" className="overview-chart-help__tooltip">{children}</span></span>;
}
/** Shared chart body keeps every overview card the same height and treatment. */
export function OverviewChart({ data, series, kind = 'bar', labelKey = 'name', label, unavailable = false, note, showDataTable = true }) {
  const gradientId = useId();
  const [expanded, setExpanded] = useState(false);
  const isCircular = kind === 'donut' || kind === 'pie' || kind === 'circular';
  const chartData = kind === 'horizontal' && !expanded ? data?.slice(0, 6) : data;
  if (unavailable) return <div className="tenant-empty" role="status">This chart is unavailable. Retry the affected sources.</div>;
  if (!data?.length) return <div className="tenant-empty">No records for this selection.</div>;
  const total = isCircular ? data.reduce((sum, row) => sum + Number(row[series?.[0]?.key || 'count'] || 0), 0) : 0;
  const showDailyBars = showDataTable && kind === 'attendance';
  const dailyBarMax = showDailyBars
    ? data.reduce((max, row) => Math.max(max, series.reduce((sum, item) => sum + (row[item.key] ?? 0), 0)), 1)
    : 1;
  return <div className="overview-chart-body">
    <div className="overview-chart" role="group" aria-label={label} style={kind === 'horizontal' ? { height: Math.max(250, chartData.length * 34) } : undefined}>
      {isCircular && !total ? <div className="tenant-empty">No records in this selection.</div> : <ResponsiveContainer width="100%" height="100%">
        {isCircular ? <PieChart margin={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Pie
            data={data}
            dataKey={series?.[0]?.key || 'count'}
            nameKey={labelKey}
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={3}
            cornerRadius={4}
            isAnimationActive={false}
          >
            {data.map((row, index) => <Cell key={row[labelKey] || index} fill={colors[index % colors.length]} stroke="var(--color-surface, #ffffff)" strokeWidth={2} />)}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e2e8dc)', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
          <Legend content={<ChartLegend />} />
        </PieChart> : kind === 'line' ? <LineChart data={data} accessibilityLayer margin={{ top: 12, right: 16, bottom: 8, left: -20 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border, #e2e8dc)" strokeDasharray="3 3" />
          <XAxis dataKey={labelKey} minTickGap={12} tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e2e8dc)', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
          <Legend content={<ChartLegend />} />
          {series.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={colors[index % colors.length]} strokeWidth={3} dot={{ r: 4, fill: colors[index % colors.length] }} activeDot={{ r: 6 }} isAnimationActive={false} />)}
        </LineChart> : kind === 'attendance' ? <AreaChart data={data} accessibilityLayer margin={{ top: 18, right: 20, bottom: 8, left: 0 }}>
          <defs>
            {series.map(item => <linearGradient key={item.key} id={gradientId + item.key} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={attendanceColors[item.key]} stopOpacity={0.24} />
              <stop offset="55%" stopColor={attendanceColors[item.key]} stopOpacity={0.09} />
              <stop offset="100%" stopColor={attendanceColors[item.key]} stopOpacity={0.01} />
            </linearGradient>)}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-gray-100)" strokeDasharray="3 5" />
          <XAxis dataKey={labelKey} tickFormatter={formatChartDate} minTickGap={36} tick={{ fontSize: 11, fill: 'var(--color-gray-500)' }} tickLine={false} axisLine={false} tickMargin={12} padding={{ left: 8, right: 8 }} />
          <YAxis allowDecimals={false} domain={[0, 'auto']} tick={{ fontSize: 11, fill: 'var(--color-gray-500)' }} tickLine={false} axisLine={false} width={34} tickMargin={8} />
          <Tooltip content={<AttendanceTooltip />} cursor={{ stroke: 'var(--color-gray-300)', strokeDasharray: '4 4' }} />
          <Legend content={<ChartLegend items={series.map(item => ({ id: item.key, label: item.label, color: attendanceColors[item.key] }))} />} />
          {series.map(item => <Area key={item.key} type="monotoneX" dataKey={item.key} name={item.label} stroke={attendanceColors[item.key]} fill={'url(#' + gradientId + item.key + ')'} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--color-surface)', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />)}
        </AreaChart> : <BarChart data={chartData} layout={kind === 'horizontal' ? 'vertical' : 'horizontal'} accessibilityLayer margin={{ top: 12, right: 16, bottom: 8, left: kind === 'horizontal' ? 0 : -20 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border, #e2e8dc)" strokeDasharray="3 3" />
          {kind === 'horizontal' ? <><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey={labelKey} width={110} tick={{ fontSize: 11 }} /></> : <><XAxis dataKey={labelKey} tick={{ fontSize: 11 }} minTickGap={12} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /></>}<Tooltip contentStyle={{ background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e2e8dc)', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} /><Legend content={<ChartLegend />} />
          {series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.label} fill={colors[index % colors.length]} maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}
        </BarChart>}
      </ResponsiveContainer>}
    </div>
    {kind === 'horizontal' && data.length > 6 && <Button viewAll={!expanded} size="sm" variant="fadeout" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'View fewer departments' : 'View all departments'}</Button>}
    {note && <p className="overview-chart-note">{note}</p>}
    {showDataTable && <details className="overview-chart-data"><summary>View chart data</summary><div className="overview-table"><table>
      <caption className="sr-only">{label}</caption>
      <thead><tr>
        <th scope="col">{labelKey === 'date' ? 'Date' : 'Category'}</th>
        {series.map(item => <th scope="col" key={item.key}>{item.label}</th>)}
        {showDailyBars && <th scope="col">Daily breakdown</th>}
      </tr></thead>
      <tbody>{data.map((row, index) => (
        <tr key={index}>
          <th scope="row">{showDailyBars ? <time dateTime={row[labelKey]}>{formatChartDate(row[labelKey])}</time> : row[labelKey]}</th>
          {series.map(item => <td key={item.key}>{row[item.key] ?? 'Unavailable'}</td>)}
          {showDailyBars && <td>
            <div className="attendance-day-bar" aria-hidden="true">
              {series.filter(item => row[item.key] > 0).map(item => (
                <span key={item.key} style={{ width: `${row[item.key] / dailyBarMax * 100}%`, backgroundColor: attendanceColors[item.key] }} />
              ))}
            </div>
          </td>}
        </tr>
      ))}</tbody>
    </table></div></details>}
  </div>;
}
