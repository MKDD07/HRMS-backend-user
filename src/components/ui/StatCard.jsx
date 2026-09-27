import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon: Icon,
  trend = null, // e.g. { direction: 'up' | 'down' | 'neutral', value: '+4.2%' }
  metaText = null,
  color = 'indigo',
  className = '',
  onClick
}) {
  return (
    <div
      className={`stat-card ${className}`}
      onClick={onClick}
    >
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        {Icon && (
          <div className="stat-card__icon">
            <Icon className="w-5 h-5 text-[#27292C]" />
          </div>
        )}
      </div>

      <div className="stat-card__value">{value}</div>

      {(trend || metaText) && (
        <div className="stat-card__meta">
          {trend && (
            <span
              className={`stat-card__trend stat-card__trend--${trend.direction || 'up'
                }`}
            >
              {trend.direction === 'up' && <ArrowUpRight className="w-3.5 h-3.5" />}
              {trend.direction === 'down' && <ArrowDownRight className="w-3.5 h-3.5" />}
              {trend.direction === 'neutral' && <Minus className="w-3.5 h-3.5" />}
              {trend.value}
            </span>
          )}
          {metaText && <span className="text-[13px] text-[#5F6368]">{metaText}</span>}
        </div>
      )}
    </div>
  );
}
