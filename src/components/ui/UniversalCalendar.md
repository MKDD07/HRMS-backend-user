# Shared calendar snippets

Import the component and keep the selected date in the consuming section:

```jsx
import { useState } from 'react';
import { UniversalCalendar } from './components/ui/UniversalCalendar';

export function SectionCalendar({ holidays = [] }) {
  const [selected, setSelected] = useState(new Date());
  return (
    <UniversalCalendar
      size="small"
      selected={selected}
      onSelect={setSelected}
      holidaysMap={holidays}
      showLegend
    />
  );
}
```

Use `size="large"` for a section calendar or `size="medium"` for a panel.
Small, medium, and large have maximum widths of 300, 420, and 760 pixels;
all shrink to their container and keep date buttons square.
Override `--uc-width` on a custom `className` to change the maximum width.
Adjust the import path for the consuming file.

Holiday records use `{ holiday_date: '2026-10-02', name: 'Holiday name', type: 'National', optional_note: 'Details' }`.
A date-keyed object is also accepted. Inactive holidays are excluded.
`showLegend` is optional; `HolidayLegend` is also exported for separate placement.
Tooltips open on hover or keyboard focus and close with Escape, blur, scroll, or resize.

Range selection uses the same component:

```jsx
const [range, setRange] = useState();
<UniversalCalendar size="large" mode="range" selected={range} onSelect={setRange} />
```

DayPicker props such as `disabled`, `month`, `onMonthChange`, `weekStartsOn`,
`modifiers`, and `footer` pass through. A custom `components.DayButton` controls
its own content and tooltips, as used by the attendance ledger.
