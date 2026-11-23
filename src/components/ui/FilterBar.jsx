import { Button } from './Button';
import { UniversalSearch } from './UniversalSearch';
import React, { useState, useRef, useEffect } from 'react';
import { X, SlidersHorizontal, ArrowDownWideNarrow } from 'lucide-react';

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
        <UniversalSearch className="flex-1 max-w-[480px]" variant="outlined" value={searchValue} onChange={onSearchChange} label={searchPlaceholder} />
      )}

      {/* Right Side Actions / Filter Controls */}
      <div className="flex items-center gap-2.5 justify-end sm:ml-auto flex-wrap">
        {hasPopover ? (
          <div className="relative">
            <Button type="button" id="btn-toggle-filters" onClick={() => setIsFilterOpen(!isFilterOpen)} className={`          flex items-center gap-2    shrink-0 ${isFilterOpen || activeFilterCount > 0 ? "" : ''}`} title="Filter settings" aria-label="Filter settings" variant="outline" wrapContent={false}>
              <SlidersHorizontal className="w-4 h-4 text-[#27292C] shrink-0" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#27292C] text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>

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
                  <Button type="button" onClick={() => setIsFilterOpen(false)} className="" variant="outline" wrapContent={false} iconOnly={true} size="sm">
                    <X className="w-3.5 h-3.5" />
                  </Button>
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
                    <Button type="button" onClick={() => {
  onResetFilters();
  setIsFilterOpen(false);
}} className="" variant="outline" wrapContent={false}>
                      Reset Filters
                    </Button>
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
          <Button type="button" id="btn-toggle-sort" onClick={() => onSortToggle()} className=" w-10 flex items-center justify-center shrink-0" title="Sort" aria-label="Sort" variant="outline" wrapContent={false} iconOnly={true} size="sm">
            <ArrowDownWideNarrow className="w-4 h-4 text-[#27292C]" />
          </Button>
        )}
      </div>
    </div>
  );
}

