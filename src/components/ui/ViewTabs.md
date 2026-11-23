# Universal view tabs

Use `ViewTabs` for page-level view switching. Labels, icons and counts are configured by the parent; the parent retains the selected view and its content.

```jsx
<ViewTabs
  label="Attendance views"
  value={view}
  onChange={setView}
  tabs={[
    { id: 'matrix', label: 'All Matrix', icon: Table2 },
    { id: 'logs', label: 'Punch Logs', icon: List, count: records.length }
  ]}
/>
```

Props: `tabs`, `value`, `onChange`, `label`, `disabled`. Each tab supports `id`, `label`, `icon`, `count`, `disabled` and `visible`. Uses the universal small Button and theme tokens. Uses navigation with pressed buttons because the existing views do not implement ARIA tab panels.
