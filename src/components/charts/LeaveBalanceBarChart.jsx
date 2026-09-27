import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const DEFAULT_CATEGORY_DATA = [
  { category: 'Casual', allotted: 10, utilized: 3, remaining: 7 },
  { category: 'Sick', allotted: 12, utilized: 2, remaining: 10 },
  { category: 'Privilege', allotted: 18, utilized: 4, remaining: 14 },
  { category: 'Compensatory', allotted: 4, utilized: 1, remaining: 3 },
  { category: 'Bereavement', allotted: 5, utilized: 0, remaining: 5 }
];

function CustomBarTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const allotted = payload.find((p) => p.dataKey === 'allotted')?.value || 0;
    const utilized = payload.find((p) => p.dataKey === 'utilized')?.value || 0;
    const remaining = payload.find((p) => p.dataKey === 'remaining')?.value || 0;
    const usagePercent = allotted > 0 ? Math.round((utilized / allotted) * 100) : 0;

    return (
      <div className="bg-white/95 backdrop-blur-xs border border-[#E5E7EB] rounded-xl p-3 shadow-lg text-[13px] min-w-[180px]">
        <div className="flex items-center justify-between border-b border-[#F1F3F5] pb-1.5 mb-2">
          <span className="font-semibold text-[#27292C]">{label} Leave</span>
          <span className="font-bold text-[#000000] bg-[#ECFDF5] px-1.5 py-0.5 rounded text-[11px]">
            {usagePercent}% Used
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[#5F6368]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#27292C]" />
              <span>Allotted Quota</span>
            </span>
            <span className="font-semibold text-[#27292C] font-mono">{allotted}d</span>
          </div>
          <div className="flex items-center justify-between text-[#5F6368]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" />
              <span>Days Consumed</span>
            </span>
            <span className="font-semibold text-[#EF4444] font-mono">{utilized}d</span>
          </div>
          <div className="flex items-center justify-between text-[#5F6368]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#000000]" />
              <span>Available Balance</span>
            </span>
            <span className="font-semibold text-[#000000] font-mono">{remaining}d</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function LeaveBalanceBarChart({ data = DEFAULT_CATEGORY_DATA, height = 300 }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#F1F3F5]">
        <div>
          <h4 className="text-sm font-semibold text-[#27292C]">
            Leave Quota vs Consumption by Category
          </h4>
          <p className="text-[13px] text-[#5F6368]">
            Comparative balance sheet of allotted entitlement vs days utilized
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#5F6368]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#000000]" />
            Healthy Quota
          </span>
        </div>
      </div>

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" vertical={false} />
            <XAxis
              dataKey="category"
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
              tick={{ fill: '#5F6368', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#5F6368', fontSize: 11 }}
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
            />

            <Bar
              dataKey="allotted"
              name="Allotted Quota"
              fill="#27292C"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="utilized"
              name="Days Utilized"
              fill="#EF4444"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="remaining"
              name="Available Balance"
              fill="#10B981"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
