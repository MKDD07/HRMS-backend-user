import React, { useState, useMemo } from 'react';
import './BezierLeaveChart.scss';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getBezierSpline(points) {
  if (!points || !points.length) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const curvature = (p1.x - p0.x) * 0.45;
    const cp1x = p0.x + curvature;
    const cp1y = p0.y;
    const cp2x = p1.x - curvature;
    const cp2y = p1.y;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }
  return d;
}

export function BezierLeaveChart({
  types = [],
  monthlyByType = {},
  selectedType = 'all',
  onSelectType,
  year = 2026,
  height = 300
}) {
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const activeTypes = useMemo(() => {
    if (!types || !types.length) return [];
    if (selectedType && selectedType !== 'all') {
      const match = types.find(t => t.name === selectedType || t.code === selectedType)
        || types.find(t => t.name.toLowerCase().includes(selectedType.toLowerCase()));
      if (match) return [match];
    }
    const earned = types.find(t =>
      t.name.toLowerCase().includes('earned') ||
      t.name.toLowerCase().includes('privilege') ||
      t.code === 'EL' ||
      t.code === 'PL'
    );
    return earned ? [earned] : [types[0]];
  }, [types, selectedType]);

  const svgWidth = 840;
  const svgHeight = height;
  const padding = { top: 38, right: 35, bottom: 48, left: 55 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Compute maximum days across active types for Y-axis scaling
  const maxDaysVal = useMemo(() => {
    let max = 0;
    for (const type of activeTypes) {
      const series = monthlyByType[type.name]?.days || [];
      for (const d of series) {
        if (d > max) max = d;
      }
    }
    if (max <= 4) return 6;
    if (max <= 8) return 10;
    if (max <= 14) return 16;
    if (max <= 20) return 24;
    return Math.ceil(max / 5) * 5 + 5;
  }, [activeTypes, monthlyByType]);

  const step = maxDaysVal <= 8 ? 2 : maxDaysVal <= 16 ? 4 : Math.ceil(maxDaysVal / 4);
  const yTicks = useMemo(() => {
    const ticks = [];
    for (let v = 0; v <= maxDaysVal; v += step) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] < maxDaysVal) {
      ticks.push(maxDaysVal);
    }
    return ticks;
  }, [maxDaysVal, step]);

  // Compute month points for each active type
  const linesData = useMemo(() => {
    return activeTypes.map(type => {
      const daysSeries = monthlyByType[type.name]?.days || Array(12).fill(0);
      const countsSeries = monthlyByType[type.name]?.counts || Array(12).fill(0);
      const color = type._color || type.color || '#4f772d';

      const points = MONTH_NAMES.map((mName, mIdx) => {
        const x = padding.left + (mIdx / 11) * plotWidth;
        const days = Number(daysSeries[mIdx]) || 0;
        const count = Number(countsSeries[mIdx]) || 0;
        const y = padding.top + plotHeight - (days / (maxDaysVal || 1)) * plotHeight;
        return {
          monthIndex: mIdx,
          monthName: mName,
          x,
          y,
          days,
          count,
          typeName: type.name,
          typeCode: type.code,
          color
        };
      });

      const path = getBezierSpline(points);
      const areaPath = points.length > 0
        ? `${path} L ${points[points.length - 1].x},${padding.top + plotHeight} L ${points[0].x},${padding.top + plotHeight} Z`
        : '';

      return {
        type,
        color,
        points,
        path,
        areaPath,
        totalDays: type.days || points.reduce((acc, p) => acc + p.days, 0)
      };
    });
  }, [activeTypes, monthlyByType, padding.left, padding.top, plotWidth, plotHeight, maxDaysVal]);

  const isSingle = activeTypes.length === 1;

  return (
    <div className="bezier-chart-wrapper">
      <div className="bezier-canvas-container">
        <svg
          className="bezier-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Monthly leave bezier lines chart"
        >
          <defs>
            {linesData.map((line, idx) => (
              <linearGradient
                key={`grad-${line.type.name}-${idx}`}
                id={`bezierGrad-${idx}`}
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor={line.color} stopOpacity={isSingle ? 0.32 : 0.14} />
                <stop offset="70%" stopColor={line.color} stopOpacity={isSingle ? 0.08 : 0.02} />
                <stop offset="100%" stopColor={line.color} stopOpacity={0} />
              </linearGradient>
            ))}
            <filter id="dotGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#1e293b" floodOpacity="0.28" />
            </filter>
          </defs>

          {/* Y-Axis Horizontal Grid Lines & Ticks (Days) */}
          <g className="bezier-grid">
            {yTicks.map(val => {
              const y = padding.top + plotHeight - (val / (maxDaysVal || 1)) * plotHeight;
              return (
                <g key={`y-${val}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    stroke="#e8efe3"
                    strokeWidth="1"
                    strokeDasharray={val === 0 ? 'none' : '3 4'}
                  />
                  <text
                    x={padding.left - 12}
                    y={y + 4}
                    textAnchor="end"
                    className="bezier-axis-label"
                  >
                    {val}d
                  </text>
                </g>
              );
            })}
          </g>

          {/* X-Axis Vertical Guide Lines & Month Labels */}
          <g className="bezier-x-axis">
            {MONTH_NAMES.map((mName, mIdx) => {
              const x = padding.left + (mIdx / 11) * plotWidth;
              const isHovered = hoveredMonth === mIdx;
              return (
                <g key={`m-${mName}`}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + plotHeight}
                    stroke={isHovered ? '#b8d5a2' : '#f1f5ee'}
                    strokeWidth={isHovered ? '1.5' : '1'}
                    strokeDasharray="2 3"
                  />
                  <text
                    x={x}
                    y={padding.top + plotHeight + 22}
                    textAnchor="middle"
                    className={`bezier-axis-month ${isHovered ? 'is-active' : ''}`}
                  >
                    {mName}
                  </text>
                </g>
              );
            })}
            {/* Axis titles */}
            <text
              x={padding.left}
              y={padding.top - 16}
              className="bezier-axis-title"
              textAnchor="start"
            >
              DAYS (Y-AXIS)
            </text>
            <text
              x={svgWidth - padding.right}
              y={padding.top + plotHeight + 36}
              className="bezier-axis-title"
              textAnchor="end"
            >
              MONTHS ({year})
            </text>
          </g>

          {/* Area Fills under Bézier Splines */}
          <g className="bezier-areas">
            {linesData.map((line, idx) => (
              <path
                key={`area-${line.type.name}-${idx}`}
                d={line.areaPath}
                fill={`url(#bezierGrad-${idx})`}
                className="bezier-area-path"
              />
            ))}
          </g>

          {/* Bézier Spline Curves */}
          <g className="bezier-lines">
            {linesData.map((line, idx) => {
              const isTypeHovered = hoveredPoint && hoveredPoint.typeName === line.type.name;
              return (
                <path
                  key={`line-${line.type.name}-${idx}`}
                  d={line.path}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={isSingle ? 3 : isTypeHovered ? 3.5 : 2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="bezier-curve-stroke"
                  style={{
                    opacity: hoveredPoint && !isTypeHovered && !isSingle ? 0.45 : 1,
                    transition: 'opacity 0.2s, stroke-width 0.2s'
                  }}
                />
              );
            })}
          </g>

          {/* Interactive Column Hover Hit Areas */}
          <g className="bezier-hit-columns">
            {MONTH_NAMES.map((_, mIdx) => {
              const colWidth = plotWidth / 11;
              const xStart = padding.left + (mIdx / 11) * plotWidth - colWidth / 2;
              return (
                <rect
                  key={`col-${mIdx}`}
                  x={Math.max(padding.left - 5, xStart)}
                  y={padding.top}
                  width={colWidth}
                  height={plotHeight}
                  fill="transparent"
                  className="bezier-col-hit"
                  onMouseEnter={() => setHoveredMonth(mIdx)}
                  onMouseLeave={() => setHoveredMonth(null)}
                />
              );
            })}
          </g>

          {/* Dots on each line for every month & Value Badges */}
          <g className="bezier-dots">
            {linesData.map(line =>
              line.points.map((pt, pIdx) => {
                const isHoveredCol = hoveredMonth === pt.monthIndex;
                const isCurrentPointHovered = hoveredPoint && hoveredPoint.typeName === pt.typeName && hoveredPoint.monthIndex === pt.monthIndex;
                return (
                  <g
                    key={`dot-${line.type.name}-${pIdx}`}
                    className="bezier-dot-group"
                    onMouseEnter={() => {
                      setHoveredPoint(pt);
                      setHoveredMonth(pt.monthIndex);
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Pulsing ring on hover */}
                    {(isCurrentPointHovered || (isHoveredCol && isSingle)) && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={11}
                        fill={line.color}
                        fillOpacity="0.22"
                        className="bezier-dot-ring"
                      />
                    )}

                    {/* Dot Marker */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isCurrentPointHovered ? 6 : pt.days > 0 ? (isSingle ? 5 : 2.2) : 3}
                      fill={pt.days > 0 ? '#ffffff' : '#f8faf6'}
                      stroke={line.color}
                      strokeWidth={isCurrentPointHovered ? 3 : pt.days > 0 ? 2.5 : 1.5}
                      filter="url(#dotGlow)"
                      className="bezier-dot-circle"
                    />
                  </g>
                );
              })
            )}
          </g>
        </svg>

        {/* Floating Tooltip Box when Month or Dot is Hovered */}
        {hoveredMonth !== null && (
          <div
            className="bezier-floating-tooltip"
            style={{
              left: `${((padding.left + (hoveredMonth / 11) * plotWidth) / svgWidth) * 100}%`
            }}
          >
            <div className="bezier-tooltip-header">
              <span className="bezier-tooltip-month">{MONTH_NAMES[hoveredMonth]} {year}</span>
              <span className="bezier-tooltip-total">
                {linesData.reduce((acc, l) => acc + (l.points[hoveredMonth]?.days || 0), 0)} days total
              </span>
            </div>
            <div className="bezier-tooltip-list">
              {linesData.map(line => {
                const pt = line.points[hoveredMonth];
                if (!pt || (!isSingle && pt.days === 0 && linesData.length > 3)) return null;
                return (
                  <div key={line.type.name} className="bezier-tooltip-row">
                    <span className="bezier-tooltip-dot" style={{ background: line.color }} />
                    <span className="bezier-tooltip-name">{line.type.name}</span>
                    <strong className="bezier-tooltip-days">{pt.days}d</strong>
                    <small className="bezier-tooltip-count">({pt.count} req)</small>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
