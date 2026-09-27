import React, { useMemo, useId, useState, useRef, useEffect } from 'react';
import Tooltip from 'flowbite/lib/esm/components/tooltip';
import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { DayPicker, DayButton } from 'react-day-picker';
import 'react-day-picker/style.css';
import './UniversalCalendar.scss';

export { DayButton } from 'react-day-picker';

export const HOLIDAY_CATEGORY_CONFIG = {
  national: {
    key: 'national',
    label: 'National / Gazetted',
    color: '#059669', // Emerald
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0'
  },
  religious: {
    key: 'religious',
    label: 'Religious Festival',
    color: '#7c3aed', // Purple Violet
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe'
  },
  regional: {
    key: 'regional',
    label: 'Regional / State',
    color: '#2563eb', // Royal Blue
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe'
  },
  optional: {
    key: 'optional',
    label: 'Optional / Restricted',
    color: '#d97706', // Amber Gold
    bgColor: '#fffbeb',
    borderColor: '#fde68a'
  },
  company: {
    key: 'company',
    label: 'Company Holiday',
    color: '#ea580c', // Coral Orange
    bgColor: '#fff7ed',
    borderColor: '#fed7aa'
  },
  bank: {
    key: 'bank',
    label: 'Bank Holiday',
    color: '#0891b2', // Cyan
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc'
  }
};

export function detectHolidayCategory(holiday) {
  if (!holiday) return HOLIDAY_CATEGORY_CONFIG.company;
  const type = String(holiday.type || '').toLowerCase();
  if (/restrict|option/.test(type)) return HOLIDAY_CATEGORY_CONFIG.optional;
  const text = `${holiday.type || ''} ${holiday.name || ''}`.toLowerCase();
  if (text.includes('national') || text.includes('gazetted') || text.includes('republic') || text.includes('independence') || text.includes('gandhi')) {
    return HOLIDAY_CATEGORY_CONFIG.national;
  }
  if (text.includes('relig') || text.includes('diwali') || text.includes('eid') || text.includes('christmas') || text.includes('dussehra') || text.includes('dussera') || text.includes('durga') || text.includes('holi') || text.includes('easter') || text.includes('navratri') || text.includes('muharram') || text.includes('buddha') || text.includes('mahavir') || text.includes('guru nanak') || text.includes('ganesh') || text.includes('pongal') || text.includes('onam') || text.includes('raksha') || text.includes('janmashtami') || text.includes('ram navami') || text.includes('shivratri') || text.includes('good friday')) {
    return HOLIDAY_CATEGORY_CONFIG.religious;
  }
  if (text.includes('state') || text.includes('region') || text.includes('local') || text.includes('provinc')) {
    return HOLIDAY_CATEGORY_CONFIG.regional;
  }
  if (text.includes('restrict') || text.includes('option')) {
    return HOLIDAY_CATEGORY_CONFIG.optional;
  }
  if (text.includes('bank')) {
    return HOLIDAY_CATEGORY_CONFIG.bank;
  }
  return HOLIDAY_CATEGORY_CONFIG.company;
}

const formatDateKey = date => {
  if (!date || isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function HolidayLegend({ holidays = [], className = '', showAll = false }) {
  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const h of holidays || []) {
      if (!h || h.active === false) continue;
      const cat = detectHolidayCategory(h);
      counts[cat.key] = (counts[cat.key] || 0) + 1;
    }
    return counts;
  }, [holidays]);

  const dropdownId = useId();
  const trigger = useRef(null);
  const [position, setPosition] = useState({});
  const [expanded, setExpanded] = useState(false);
  const primary = ['national', 'optional'].map(key => HOLIDAY_CATEGORY_CONFIG[key]);
  const others = Object.values(HOLIDAY_CATEGORY_CONFIG).filter(cat =>
    !['national', 'optional'].includes(cat.key));
  const badge = cat => <span key={cat.key} className="uc-legend-item">
    <span className="uc-legend-solid-badge" style={{ '--holiday-color': cat.color }}>
      {cat.label}<span className="uc-legend-count">{categoryCounts[cat.key] || 0}</span>
    </span>
  </span>;
  return <div className={`uc-holiday-legend ${className}`.trim()}>
    <button type="button" ref={trigger} className="uc-legend-trigger" popoverTarget={dropdownId}
      aria-expanded={expanded} aria-controls={dropdownId}
      onClick={() => {
        const rect = trigger.current.getBoundingClientRect();
        setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 320)) });
      }}>
      Holiday legends <ChevronDown size={14} aria-hidden="true" />
    </button>
    <div id={dropdownId} popover="auto" className="uc-legend-popover" style={position}
      onToggle={event => setExpanded(event.newState === 'open')} aria-label="Holiday categories">
      <div className="uc-legend-options">{[...primary, ...others].map(badge)}</div>
    </div>
  </div>;
}

/**
 * Universal Calendar component for standardizing calendars across all pages
 * Supports automatic holiday categorization, solid color themes, and hover tooltips
 *
 * @param {'sm' | 'small' | 'md' | 'medium' | 'lg' | 'large'} size - Calendar display scale
 * @param {string} className - Additional CSS classes
 * @param {'single' | 'multiple' | 'range'} mode - Selection mode
 * @param {Date | Array | Object} selected - Currently selected date(s)
 * @param {Function} onSelect - Date selection handler
 * @param {Date} month - Controlled current month
 * @param {Function} onMonthChange - Month navigation change handler
 * @param {number} weekStartsOn - Week start day (0=Sunday, 1=Monday, default 1)
 * @param {boolean} showOutsideDays - Whether to render days from adjacent months
 * @param {Object | Array} holidaysMap - Map or list of holidays for auto-detection and hover tooltips
 * @param {Object} modifiers - Custom day modifiers
 * @param {Object} modifiersClassNames - CSS class mappings for modifiers
 * @param {Object} components - Custom component overrides (e.g. DayButton)
 * @param {React.ReactNode} footer - Custom calendar footer/legend
 */
export function UniversalCalendar({
  size = 'md',
  className = '',
  mode = 'single',
  weekStartsOn = 1,
  showOutsideDays = false,
  holidaysMap,
  components,
  showLegend = false,
  ...props
}) {
  const normalizedSize = ({ small: 'sm', medium: 'md', large: 'lg', sm: 'sm', md: 'md', lg: 'lg' })[size] || 'md';
  const sizeClass = `universal-calendar--${normalizedSize || 'md'}`;

  // Normalized map of dateKey -> holiday
  const normalizedHolidays = useMemo(() => {
    if (!holidaysMap) return null;
    if (Array.isArray(holidaysMap)) {
      const map = {};
      for (const h of holidaysMap) {
        if (h && h.active !== false && h.holiday_date) map[h.holiday_date] = h;
      }
      return map;
    }
    return holidaysMap;
  }, [holidaysMap]);

  const customComponents = useMemo(() => {
    if (components?.DayButton) return components;
    if (!normalizedHolidays) return components;

    const TooltipDayButton = buttonProps => {
      const id = useId();
      const anchor = useRef(null);
      const tooltip = useRef(null);
      useEffect(() => {
        const button = anchor.current?.querySelector('button');
        if (!button || !tooltip.current) return;
        const instance = new Tooltip(tooltip.current, button, { placement: 'top', triggerType: 'hover' }, { id, override: true });
        return () => instance.destroyAndRemoveInstance();
      }, [id]);
      const { day, modifiers, className: btnClass, children, ...rest } = buttonProps;
      if (!day?.date) return <DayButton {...buttonProps} />;
      const key = formatDateKey(day.date);
      const holiday = normalizedHolidays[key];

      if (!holiday || holiday.active === false || modifiers?.outside) {
        return <DayButton {...buttonProps} />;
      }

      const cat = detectHolidayCategory(holiday);
      const formattedDate = day.date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });

      return (
        <div
          className="uc-day-wrapper" ref={anchor}
          style={{
            '--holiday-color': cat.color,
            '--holiday-bg': cat.bgColor,
            '--holiday-border': cat.borderColor
          }}
        >
          <DayButton
            {...buttonProps}
            className={`${btnClass || ''} uc-has-holiday uc-cat-${cat.key}`}
            aria-label={`${rest['aria-label'] || formattedDate}, ${holiday.name}`} aria-describedby={id}
          >
            {children}
          </DayButton>
          <>{createPortal(<div ref={tooltip} id={id} role="tooltip"
            className="uc-holiday-tooltip invisible absolute z-[10000] opacity-0 transition-opacity duration-150 motion-reduce:transition-none"
            style={{ '--holiday-color': cat.color }}>
            <div className="uc-holiday-tooltip__date">{formattedDate}</div>
            <strong className="uc-holiday-tooltip__title">{holiday.name}</strong>
            <span className="uc-holiday-tooltip__category">
              <span aria-hidden="true" />{holiday.type || cat.label}
            </span>
            {holiday.optional_note && <p className="uc-holiday-tooltip__note">{holiday.optional_note}</p>}
          </div>, document.body)}</>
        </div>
      );
    };

    return {
      ...components,
      DayButton: TooltipDayButton
    };
  }, [components, normalizedHolidays]);

  return (
    <div className={`universal-calendar ${sizeClass} ${className}`.trim()}>
      <DayPicker
        mode={mode}
        weekStartsOn={weekStartsOn}
        showOutsideDays={showOutsideDays}
        components={customComponents}
        {...props}
      />
      {showLegend && <HolidayLegend holidays={Object.values(normalizedHolidays || {})} />}
    </div>
  );
}

export default UniversalCalendar;
