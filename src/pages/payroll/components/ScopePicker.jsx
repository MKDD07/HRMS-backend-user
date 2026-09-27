import React from 'react';
import { Calendar } from 'lucide-react';
import { MONTH_NAMES } from '../lib/customRowsStore';

const YEARS = ['2023', '2024', '2025', '2026', '2027', '2028'];

/**
 * Chooses which months a custom row applies to.
 * value: { mode: 'once' | 'ongoing' | 'selected', year?: string, months: [] }
 */
export function ScopePicker({ value, onChange, year, month }) {
  const activeYear = String(value.year || year || '2026');
  const selectedMonths = value.months || [];

  const options = [
    ['once', `Only ${month} ${activeYear}`],
    ['ongoing', `Ongoing from ${month} ${activeYear}`],
    ['selected', 'Selected months']
  ];

  const toggleMonth = (m) => {
    const has = selectedMonths.includes(m);
    onChange({
      ...value,
      year: activeYear,
      months: has ? selectedMonths.filter((x) => x !== m) : [...selectedMonths, m]
    });
  };

  const handleYearChange = (newYear) => {
    onChange({ ...value, year: String(newYear) });
  };

  // Windows / Mac built-in calendar picker (input type="month")
  const handleNativeMonthPicker = (e) => {
    const val = e.target.value; // "YYYY-MM"
    if (!val) return;
    const [y, mStr] = val.split('-');
    const mIndex = parseInt(mStr, 10) - 1;
    if (mIndex >= 0 && mIndex < 12) {
      const pickedMonth = MONTH_NAMES[mIndex];
      const has = selectedMonths.includes(pickedMonth);
      onChange({
        ...value,
        mode: 'selected',
        year: String(y),
        months: has ? selectedMonths : [...selectedMonths, pickedMonth]
      });
    }
  };

  const selectAll = () => {
    onChange({ ...value, year: activeYear, months: [...MONTH_NAMES] });
  };

  const clearAll = () => {
    onChange({ ...value, year: activeYear, months: [] });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {options.map(([mode, label]) => (
            <label
              key={mode}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[13px] cursor-pointer select-none transition-colors ${value.mode === mode
                  ? 'border-[#587443] bg-[#f0f5e9] text-[#587443] font-semibold ring-1 ring-[#587443]/20'
                  : 'border-[#e2e9da] bg-white text-[#7d8e70] hover:border-[#CBD5E1]'
                }`}
            >
              <input
                type="radio"
                className="sr-only"
                checked={value.mode === mode}
                onChange={() => onChange({ ...value, mode, year: activeYear })}
              />
              {label}
            </label>
          ))}
        </div>

        {/* Right top dropdown & native Windows/Mac calendar */}
        {value.mode === 'selected' && (
          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-[#e2e9da] shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-[#587443] shrink-0" />
            <select
              value={activeYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="h-6 text-[13px] font-semibold text-[#3e5432] bg-transparent border-0 focus:ring-0 cursor-pointer p-0"
              aria-label="Year"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span className="text-[#e2e9da]">|</span>
            <input
              type="month"
              onChange={handleNativeMonthPicker}
              className="h-6 text-[13px] text-[#3e5432] bg-transparent border-0 focus:ring-0 cursor-pointer p-0 w-24"
              title="Pick with Windows/Mac native calendar"
              aria-label="Windows/Mac built-in month calendar"
            />
          </div>
        )}
      </div>

      {value.mode === 'selected' && (
        <div className="p-2.5 bg-white rounded-xl border border-[#e2e9da] space-y-2">
          <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-[#edf1e7]">
            <span className="text-[#7d8e70] font-medium">
              Selected: <strong className="text-[#3e5432] font-mono">{selectedMonths.length}</strong> months for{' '}
              <strong className="text-[#587443] font-semibold">{activeYear}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-[#587443] font-semibold hover:underline"
              >
                Select all
              </button>
              <span className="text-[#e2e9da]">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-[#7d8e70] hover:text-[#DC2626]"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {MONTH_NAMES.map((m) => {
              const on = selectedMonths.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMonth(m)}
                  className={`h-7 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${on
                      ? 'bg-[#587443] border-[#587443] text-white shadow-xs'
                      : 'bg-white border-[#e2e9da] text-[#7d8e70] hover:border-[#CBD5E1] hover:bg-[#f8faf5]'
                    }`}
                  title={`${m} ${activeYear}`}
                >
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
