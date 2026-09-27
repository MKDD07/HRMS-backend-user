import React, { useState } from 'react';

export function PayrollChart({
  data = [
    { month: 'Apr', amount: 76.2 },
    { month: 'May', amount: 78.5 },
    { month: 'Jun', amount: 80.1 },
    { month: 'Jul', amount: 81.9 },
    { month: 'Aug', amount: 83.4 },
    { month: 'Sep', amount: 84.6 },
  ],
  height = 200
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const maxVal = 100;
  const paddingX = 35;
  const paddingY = 25;
  const width = 480;
  const chartHeight = height - paddingY * 2;
  const colWidth = (width - paddingX * 2) / data.length;

  return (
    <div className="w-full relative" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
      >
        {/* Y-axis grid */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = height - paddingY - (tick / maxVal) * chartHeight;
          return (
            <g key={tick}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - 15}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4 4"
              />
              <text
                x={paddingX - 10}
                y={y + 4}
                fill="#64748b"
                fontSize="10"
                textAnchor="end"
              >
                ₹{tick}L
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const x = paddingX + idx * colWidth + (colWidth - 28) / 2;
          const barH = (item.amount / maxVal) * chartHeight;
          const y = height - paddingY - barH;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={item.month}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={x}
                y={y}
                width={28}
                height={barH}
                rx="6"
                fill={isHovered ? '#818cf8' : '#6366f1'}
                className="transition-all duration-200"
              />

              {/* Month label */}
              <text
                x={x + 14}
                y={height - 8}
                fill={isHovered ? '#fff' : '#94a3b8'}
                fontSize="11"
                fontWeight={isHovered ? 'bold' : 'normal'}
                textAnchor="middle"
              >
                {item.month}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg shadow-xl text-[13px] flex items-center gap-2 pointer-events-none">
          <span className="font-bold text-white">{data[hoveredIdx].month}:</span>
          <span className="text-indigo-400 font-semibold">
            ₹{data[hoveredIdx].amount} Lakhs CTC
          </span>
        </div>
      )}
    </div>
  );
}
