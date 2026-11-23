import { ChartLegend } from './ChartLegend';
import { attendanceColors } from './chartColors';
import React, { useState } from 'react';
import './charts.scss';

export function AttendanceChart({
  data = [
    { day: 'Mon', present: 94, late: 4, absent: 2 },
    { day: 'Tue', present: 96, late: 3, absent: 1 },
    { day: 'Wed', present: 95, late: 3, absent: 2 },
    { day: 'Thu', present: 97, late: 2, absent: 1 },
    { day: 'Fri', present: 92, late: 6, absent: 2 },
    { day: 'Sat', present: 88, late: 8, absent: 4 },
  ],
  height = 220
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const maxVal = 100;
  const paddingX = 40;
  const paddingY = 30;
  const width = 500;
  const chartHeight = height - paddingY * 2;
  const colWidth = (width - paddingX * 2) / data.length;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full relative" style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          {/* Y-axis grid lines */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = height - paddingY - (tick / maxVal) * chartHeight;
            return (
              <g key={tick}>
                <line
                  x1={paddingX - 10}
                  y1={y}
                  x2={width - 10}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 16}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="sans-serif"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Bar Groups */}
          {data.map((item, idx) => {
            const xCenter = paddingX + idx * colWidth + colWidth / 2;
            const barW = 16;
            const isHovered = hoveredIdx === idx;

            // Heights
            const hPresent = (item.present / maxVal) * chartHeight;
            const hLate = (item.late / maxVal) * chartHeight;
            const hAbsent = (item.absent / maxVal) * chartHeight;

            const yPresent = height - paddingY - hPresent;
            const yLate = yPresent - hLate;
            const yAbsent = yLate - hAbsent;

            return (
              <g
                key={item.day}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Background highlight pill on hover */}
                {isHovered && (
                  <rect
                    x={xCenter - colWidth / 2 + 4}
                    y={paddingY - 5}
                    width={colWidth - 8}
                    height={chartHeight + 10}
                    rx="8"
                    fill="rgba(255, 255, 255, 0.04)"
                  />
                )}

                {/* Stacked Bars */}
                {/* Present (Emerald) */}
                <rect
                  x={xCenter - barW / 2}
                  y={yPresent}
                  width={barW}
                  height={hPresent}
                  rx="3"
                  fill={attendanceColors.present}
                  opacity={isHovered ? 1 : 0.9}
                />
                {/* Late (Amber) */}
                <rect
                  x={xCenter - barW / 2}
                  y={yLate}
                  width={barW}
                  height={hLate}
                  rx="2"
                  fill={attendanceColors.late}
                />
                {/* Absent (Rose) */}
                <rect
                  x={xCenter - barW / 2}
                  y={yAbsent}
                  width={barW}
                  height={hAbsent}
                  rx="2"
                  fill={attendanceColors.absent}
                />

                {/* X-axis Label */}
                <text
                  x={xCenter}
                  y={height - 10}
                  fill={isHovered ? '#f8fafc' : '#94a3b8'}
                  fontSize="11"
                  fontWeight={isHovered ? 'bold' : '500'}
                  textAnchor="middle"
                >
                  {item.day}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredIdx !== null && (
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-xl text-[13px] flex items-center gap-3 z-10 pointer-events-none"
          >
            <span className="font-bold text-white">
              {data[hoveredIdx].day}:
            </span>
            <span className="font-semibold" style={{ color: attendanceColors.present }}>
              {data[hoveredIdx].present}% Present
            </span>
            <span style={{ color: attendanceColors.late }}>
              {data[hoveredIdx].late}% Late
            </span>
            <span style={{ color: attendanceColors.absent }}>
              {data[hoveredIdx].absent}% Absent
            </span>
          </div>
        )}
      </div>

      <ChartLegend items={[
        { label: 'Present', color: attendanceColors.present },
        { label: 'Late In', color: attendanceColors.late },
        { label: 'Absent', color: attendanceColors.absent },
      ]} />
    </div>
  );
}
