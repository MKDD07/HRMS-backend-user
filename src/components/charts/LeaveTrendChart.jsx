import React, { useState } from 'react';

export function LeaveTrendChart({
  data = [
    { month: 'Apr', casual: 14, sick: 6, privilege: 8 },
    { month: 'May', casual: 18, sick: 9, privilege: 12 },
    { month: 'Jun', casual: 22, sick: 5, privilege: 15 },
    { month: 'Jul', casual: 16, sick: 11, privilege: 10 },
    { month: 'Aug', casual: 25, sick: 8, privilege: 14 },
    { month: 'Sep', casual: 19, sick: 7, privilege: 9 },
  ],
  height = 200
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const width = 500;
  const paddingX = 40;
  const paddingY = 25;
  const chartHeight = height - paddingY * 2;
  const maxVal = 30;

  // Build curved SVG path
  const getPoints = (key) => {
    return data.map((d, i) => {
      const x = paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
      const y = height - paddingY - (d[key] / maxVal) * chartHeight;
      return { x, y };
    });
  };

  const toSmoothPath = (pts) => {
    if (pts.length === 0) return '';
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const mx = (p0.x + p1.x) / 2;
      path += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const casualPts = getPoints('casual');
  const sickPts = getPoints('sick');
  const privPts = getPoints('privilege');

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full relative" style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          {/* Horizontal grid lines */}
          {[0, 10, 20, 30].map((val) => {
            const y = height - paddingY - (val / maxVal) * chartHeight;
            return (
              <g key={val}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingX - 10}
                  y={y + 3}
                  fill="#64748b"
                  fontSize="9"
                  textAnchor="end"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area under casual curve */}
          <path
            d={`${toSmoothPath(casualPts)} L ${width - paddingX} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`}
            fill="url(#casualGrad)"
            opacity="0.25"
          />

          <defs>
            <linearGradient id="casualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Lines */}
          <path
            d={toSmoothPath(casualPts)}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
          />
          <path
            d={toSmoothPath(sickPts)}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          <path
            d={toSmoothPath(privPts)}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
          />

          {/* Points & Interactive column */}
          {data.map((d, i) => {
            const x = paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
            const isHovered = hoveredIdx === i;

            return (
              <g
                key={d.month}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Vertical guide line on hover */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingY}
                    x2={x}
                    y2={height - paddingY}
                    stroke="rgba(255,255,255,0.2)"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Casual Dot */}
                <circle
                  cx={casualPts[i].x}
                  cy={casualPts[i].y}
                  r={isHovered ? 5 : 3.5}
                  fill="#6366f1"
                  stroke="#090d16"
                  strokeWidth="2"
                />

                {/* X-axis Month */}
                <text
                  x={x}
                  y={height - 6}
                  fill={isHovered ? '#fff' : '#94a3b8'}
                  fontSize="11"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  textAnchor="middle"
                >
                  {d.month}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredIdx !== null && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700/90 px-3 py-1.5 rounded-lg shadow-xl text-[13px] flex items-center gap-3 pointer-events-none">
            <span className="font-bold text-white">{data[hoveredIdx].month}:</span>
            <span className="text-indigo-400 font-semibold">{data[hoveredIdx].casual} Casual</span>
            <span className="text-amber-400 font-semibold">{data[hoveredIdx].sick} Sick</span>
            <span className="text-emerald-400 font-semibold">{data[hoveredIdx].privilege} Privilege</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-5 mt-2 text-[13px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <span>Casual Leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Sick Leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Privilege Leave</span>
        </div>
      </div>
    </div>
  );
}
