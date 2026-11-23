import { ChartLegend } from './ChartLegend';
import { chartPalette } from './chartColors';
import React, { useState } from 'react';

export function DonutChart({
  data = [
    { label: 'Full-time', value: 118, color: chartPalette[0] },
    { label: 'Hybrid', value: 18, color: chartPalette[1] },
    { label: 'Contract', value: 8, color: chartPalette[2] },
    { label: 'Intern', value: 4, color: chartPalette[3] },
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
    <div className="flex flex-col items-center justify-center gap-3 py-2">
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

      <ChartLegend
        items={data.map(item => ({
          id: item.label,
          label: item.label,
          color: item.color,
          detail: total ? Math.round(item.value / total * 100) + '%' : '0%',
        }))}
        onHighlight={setHoveredIdx}
      />
    </div>
  );
}
