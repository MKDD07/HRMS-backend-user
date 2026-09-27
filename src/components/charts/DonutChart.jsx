import React, { useState } from 'react';

export function DonutChart({
  data = [
    { label: 'Full-time', value: 118, color: '#6366f1' },
    { label: 'Hybrid', value: 18, color: '#06b6d4' },
    { label: 'Contract', value: 8, color: '#10b981' },
    { label: 'Intern', value: 4, color: '#f59e0b' },
  ],
  size = 180,
  strokeWidth = 24
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Base circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
          />

          {data.map((item, idx) => {
            const strokeDasharray = (item.value / total) * circumference;
            const strokeDashoffset = -currentOffset;
            currentOffset += strokeDasharray;
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${strokeDasharray} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-2xl font-bold font-display text-white">
            {hoveredIdx !== null ? data[hoveredIdx].value : total}
          </span>
          <span className="text-[11px] text-slate-400">
            {hoveredIdx !== null ? data[hoveredIdx].label : 'Total Staff'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-[130px]">
        {data.map((item, idx) => {
          const isHovered = hoveredIdx === idx;
          const pct = Math.round((item.value / total) * 100);

          return (
            <div
              key={item.label}
              className={`flex items-center justify-between text-[13px] p-1 rounded transition-colors cursor-pointer ${isHovered ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className={isHovered ? 'font-semibold text-white' : ''}>
                  {item.label}
                </span>
              </div>
              <span className="font-semibold text-slate-300 ml-2">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
