import React from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
  badge = null,
  breadcrumbs = [],
  className = ''
}) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 ${className}`}>
      <div>
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-[13px] text-[#5F6368] mb-1.5 font-medium">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-[#D1D5DB]">/</span>}
                <span className={idx === breadcrumbs.length - 1 ? 'text-[#27292C] font-semibold' : 'hover:text-[#27292C]'}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#27292C]">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-[13px] md:text-sm text-[#5F6368] mt-1 max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
