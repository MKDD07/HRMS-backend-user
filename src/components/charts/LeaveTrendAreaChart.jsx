import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const DEFAULT_DATA = [
  { month: 'Jan', casual: 12, sick: 5, privilege: 8, total: 25 },
  { month: 'Feb', casual: 15, sick: 8, privilege: 6, total: 29 },
  { month: 'Mar', casual: 18, sick: 6, privilege: 11, total: 35 },
  { month: 'Apr', casual: 14, sick: 9, privilege: 14, total: 37 },
  { month: 'May', casual: 20, sick: 7, privilege: 16, total: 43 },
  { month: 'Jun', casual: 22, sick: 4, privilege: 12, total: 38 },
  { month: 'Jul', casual: 16, sick: 11, privilege: 10, total: 37 },
  { month: 'Aug', casual: 24, sick: 8, privilege: 15, total: 47 },
  { month: 'Sep', casual: 19, sick: 6, privilege: 13, total: 38 },
  { month: 'Oct', casual: 26, sick: 7, privilege: 20, total: 53 },
  { month: 'Nov', casual: 21, sick: 9, privilege: 18, total: 48 },
  { month: 'Dec', casual: 28, sick: 5, privilege: 25, total: 58 }
];

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const total = payload.reduce((acc, curr) => acc + (curr.value || 0), 0);
    return (
      <div className="bg-white/95 backdrop-blur-xs border border-[#E5E7EB] rounded-xl p-3 shadow-lg text-[13px] min-w-[170px]">
        <div className="flex items-center justify-between border-b border-[#F1F3F5] pb-1.5 mb-2">
          <span className="font-semibold text-[#27292C]">{label} 2026</span>
          <span className="font-bold text-[#4F46E5] bg-[#EEF2FF] px-1.5 py-0.5 rounded text-[11px]">
            {total} days total
          </span>
        </div>
        <div className="space-y-1.5">
          {payload.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 text-[#5F6368]">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="capitalize">{item.name}</span>
              </span>
              <span className="font-semibold text-[#27292C] font-mono">
                {item.value}d
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export function LeaveTrendAreaChart({ data = DEFAULT_DATA, height = 300 }) {
  const [filter, setFilter] = useState('full'); // 'full' | 'last6' | 'q3'

  let chartData = data;
  if (filter === 'last6') {
    chartData = data.slice(-6);
  } else if (filter === 'q3') {
    chartData = data.slice(6, 9);
  }

  return (
    <div className="w-full">
      {/* Chart Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-2 border-b border-[#F1F3F5]">
        <div>
          <h4 className="text-sm font-semibold text-[#27292C]">
            Monthly Leave Application Trend
          </h4>
          <p className="text-[13px] text-[#5F6368]">
            Seasonal absenteeism distribution across approved leave classifications
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#F9FAFB] p-0.5 rounded-lg border border-[#E5E7EB] self-start sm:self-auto text-[13px]">
          <button
            type="button"
            onClick={() => setFilter('full')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${filter === 'full'
              ? 'bg-white text-[#27292C] shadow-xs'
              : 'text-[#5F6368] hover:text-[#27292C]'
              }`}
          >
            12 Months
          </button>
          <button
            type="button"
            onClick={() => setFilter('last6')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${filter === 'last6'
              ? 'bg-white text-[#27292C] shadow-xs'
              : 'text-[#5F6368] hover:text-[#27292C]'
              }`}
          >
            Past 6M
          </button>
          <button
            type="button"
            onClick={() => setFilter('q3')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${filter === 'q3'
              ? 'bg-white text-[#27292C] shadow-xs'
              : 'text-[#5F6368] hover:text-[#27292C]'
              }`}
          >
            Current Q3
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              {/* Casual Leave Gradient */}
              <linearGradient id="colorCasual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
              </linearGradient>

              {/* Sick Leave Gradient */}
              <linearGradient id="colorSick" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0D9488" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
              </linearGradient>

              {/* Privilege Leave Gradient */}
              <linearGradient id="colorPrivilege" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              tick={{ fill: '#5F6368', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#5F6368', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
            />

            <Area
              type="monotone"
              dataKey="casual"
              name="Casual Leave"
              stroke="#4F46E5"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCasual)"
            />
            <Area
              type="monotone"
              dataKey="sick"
              name="Sick Leave"
              stroke="#0D9488"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSick)"
            />
            <Area
              type="monotone"
              dataKey="privilege"
              name="Privilege Leave"
              stroke="#F59E0B"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPrivilege)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
