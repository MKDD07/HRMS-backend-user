import React from 'react';

export function Tabs({
  tabs, // Array of { id, label, count?, icon? }
  activeTab,
  onChange,
  fullWidth = false,
  className = ''
}) {
  return (
    <div
      role="tablist"
      className={`tabs flex items-center gap-1 border-b border-[#E5E7EB] overflow-x-auto scrollbar-none ${fullWidth ? 'tabs--full w-full' : ''
        } ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tabs__tab group relative flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-all border-b-2 -mb-px cursor-pointer select-none ${fullWidth ? 'flex-1 justify-center' : ''
              } ${isActive
                ? 'tabs__tab--active border-[#4F46E5] text-[#4F46E5]'
                : 'border-transparent text-[#5F6368] hover:text-[#27292C] hover:border-[#D1D5DB]'
              }`}
            onClick={() => onChange(tab.id)}
          >
            {Icon && (
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#4F46E5]' : 'text-[#9CA3AF] group-hover:text-[#5F6368]'
                  }`}
              />
            )}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`tabs__tab__count ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${isActive
                  ? 'bg-[#EEF2FF] text-[#4F46E5]'
                  : 'bg-[#F3F4F6] text-[#6B7280] group-hover:bg-[#E5E7EB] group-hover:text-[#27292C]'
                  }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
