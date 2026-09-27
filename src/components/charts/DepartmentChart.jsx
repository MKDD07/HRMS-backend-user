import React, { useState } from 'react';

export function DepartmentChart({
  data = [
    { department: 'Engineering', count: 68, color: '#6366f1' },
    { department: 'Product & Design', count: 24, color: '#8b5cf6' },
    { department: 'Sales & Ops', count: 32, color: '#06b6d4' },
    { department: 'Human Resources', count: 12, color: '#10b981' },
    { department: 'Finance & Legal', count: 12, color: '#f59e0b' },
  ]
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="w-full space-y-3.5 py-1">
      {data.map((item, idx) => {
        const isHovered = hoveredIdx === idx;
        const percent = Math.round((item.count / maxCount) * 100);

        return (
          <div
            key={item.department}
            className="group cursor-pointer"
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div className="flex items-center justify-between text-[13px] mb-1.5">
              <span
                className={`font-medium transition-colors ${isHovered ? 'text-white' : 'text-slate-300'
                  }`}
              >
                {item.department}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">
                  {item.count} members
                </span>
                <span className="font-semibold text-slate-200">
                  {Math.round((item.count / 148) * 100)}%
                </span>
              </div>
            </div>

            <div className="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden p-0.5 flex">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${percent}%`,
                  backgroundColor: item.color,
                  boxShadow: isHovered
                    ? `0 0 12px ${item.color}88`
                    : 'none'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
