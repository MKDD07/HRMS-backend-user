import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';

const DEFAULT_PIE_DATA = [
  { name: 'Available Balance', value: 16, color: '#10B981' },
  { name: 'Approved & Taken', value: 6, color: '#4F46E5' },
  { name: 'Pending Review', value: 2, color: '#F59E0B' }
];

function CustomDonutTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-2.5 shadow-md text-[13px]">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: data.payload.color }}
          />
          <span className="font-medium text-[#27292C]">{data.name}:</span>
          <span className="font-bold text-[#27292C] font-mono">{data.value} Days</span>
        </div>
      </div>
    );
  }
  return null;
}

export function LeaveDistributionDonut({
  data = DEFAULT_PIE_DATA,
  totalDays = 24,
  availableDays = 16,
  height = 200
}) {
  const percentAvailable = totalDays > 0 ? Math.round((availableDays / totalDays) * 100) : 0;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full relative flex items-center justify-center" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomDonutTooltip />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center overlay label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-[#27292C] leading-none">
            {percentAvailable}%
          </span>
          <span className="text-[10px] text-[#5F6368] uppercase font-semibold mt-0.5 tracking-wider">
            Available
          </span>
        </div>
      </div>

      {/* Legend chips */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[13px]">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-[#5F6368]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[11px]">{item.name}</span>
            <span className="font-semibold text-[#27292C] text-[11px]">
              ({item.value}d)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
