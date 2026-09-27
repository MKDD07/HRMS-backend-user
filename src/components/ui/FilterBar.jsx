import React, { useState, useRef, useEffect } from 'react';
import { Search, X, SlidersHorizontal, ArrowDownWideNarrow, Scan } from 'lucide-react';

export function FilterBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  showSearch = true,
  children,
  className = '',
  onSortToggle,
  onResetFilters,
  activeFilterCount = 0,
  popover
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const containerRef = useRef(null);

  const hasPopover = popover ?? Boolean(onResetFilters || activeFilterCount > 0);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
    }
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  return (
    <div
      ref={containerRef}
      className={`card p-4 bg-white border border-[#E5E7EB] rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs relative w-full ${className}`}
    >
      {/* Universal Search Input (Left) */}
      {showSearch && (
        <div className="flex-1 max-w-[480px] relative flex items-center bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl h-10 px-3.5 hover:border-[#D1D5DB] focus-within:bg-white focus-within:border-[#27292C] focus-within:ring-1 focus-within:ring-[#27292C] transition-all shadow-2xs">
          <Search className="w-4 h-4 text-[#9CA3AF] shrink-0 mr-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full text-sm text-[#27292C] placeholder-[#9CA3AF] bg-transparent border-none focus:border-none focus:outline-none font-normal"
          />
          {searchValue ? (
            <button
              type="button"
              onClick={() => onSearchChange && onSearchChange('')}
              className="p-1 rounded text-[#9CA3AF] hover:text-[#27292C] transition-colors cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <Scan className="w-4 h-4 text-[#9CA3AF] shrink-0 pointer-events-none" />
          )}
        </div>
      )}

      {/* Right Side Actions / Filter Controls */}
      <div className="flex items-center gap-2.5 justify-end sm:ml-auto flex-wrap">
        {hasPopover ? (
          <div className="relative">
            <button
              type="button"
              id="btn-toggle-filters"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`h-10 px-3.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-sm font-medium text-[#27292C] flex items-center gap-2 cursor-pointer transition-colors shadow-2xs shrink-0 ${isFilterOpen || activeFilterCount > 0 ? 'border-[#27292C] bg-[#F9FAFB]' : ''
                }`}
              title="Filter settings"
              aria-label="Filter settings"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#27292C] shrink-0" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#27292C] text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filter Settings Popover Dropdown */}
            {isFilterOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[300px] bg-white rounded-xl shadow-xl border border-[#E5E7EB] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F0F1F3]">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#27292C]" />
                    <span className="text-xs font-bold text-[#27292C] uppercase tracking-wider">
                      Filter Settings
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="p-1 rounded text-[#9CA3AF] hover:text-[#27292C] hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {children ? (
                  <div className="flex flex-col gap-2.5">
                    {children}
                  </div>
                ) : (
                  <p className="text-xs text-[#9CA3AF] py-2 text-center">
                    No additional filter options available.
                  </p>
                )}

                {onResetFilters && (
                  <div className="pt-2 border-t border-[#F0F1F3] flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onResetFilters();
                        setIsFilterOpen(false);
                      }}
                      className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          children
        )}

        {/* Sort Button */}
        {onSortToggle && (
          <button
            type="button"
            id="btn-toggle-sort"
            onClick={() => onSortToggle()}
            className="h-10 w-10 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#27292C] flex items-center justify-center cursor-pointer transition-colors shadow-2xs shrink-0"
            title="Sort"
            aria-label="Sort"
          >
            <ArrowDownWideNarrow className="w-4 h-4 text-[#27292C]" />
          </button>
        )}
      </div>
    </div>
  );
}

