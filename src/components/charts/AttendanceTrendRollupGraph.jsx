import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { getWorkingDays, getWeeklyOffDays, generateAttendanceTrendData } from '../../lib/shiftStore';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#27292C] text-white rounded-lg px-3 py-2 text-[12px] shadow-xl">
      <p className="font-semibold">{label}</p>
      <p className="text-[#A5F3A0] font-bold">{payload[0]?.value}% present</p>
    </div>
  );
};

export function AttendanceTrendRollupGraph({ data: propData }) {
  const workingDays = getWorkingDays();
  const weeklyOffDays = getWeeklyOffDays();

  const data = useMemo(() => {
    const raw = (propData?.length > 0 ? propData : generateAttendanceTrendData(workingDays))
      .filter((item) => !weeklyOffDays.includes(item.dayOfWeek || item.day));
    return raw.map((d) => ({
      label: `${d.day} ${d.date}`,
      rate: d.presentRate
    }));
  }, [propData, workingDays, weeklyOffDays]);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#27292C" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#27292C" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[80, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="rate"
          stroke="#27292C"
          strokeWidth={2}
          fill="url(#areaGrad)"
          dot={false}
          activeDot={{ r: 4, fill: '#27292C', stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default AttendanceTrendRollupGraph;
