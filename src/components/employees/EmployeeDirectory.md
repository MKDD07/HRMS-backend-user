# EmployeeDirectory

Reusable employee browser and selector. The component uses the shared `card` and `card-head` classes. Its internal styling lives in `EmployeeDirectory.scss`.

```jsx
<EmployeeDirectory
  employees={employees}
  loading={loading}
  error={error}
  selectedId={selectedId}
  onSelect={person => setSelectedId(person.userid)}
  onRefresh={refresh}
  headerTitle="Employee Directory"
  subtitle="Choose an employee to view their details."
/>
```

- Omit `onSelect` for read-only rows. The component removes row buttons and navigation chevrons.
- Use `multi`, `selectedIds`, `onToggle`, `onSelectAll`, and `onClearAll` for bulk selection.
- Use `headerTitle` and `headerSubtitle` for custom headings in either header arrangement.
- Use `toolbar` for externally controlled search and filters. Input labels and placeholders are preserved; the parent owns the filtered array.
- Set `actionsPlacement="inline"` to place an explicit action beside each compact employee row. The duplicate row chevron is hidden; narrow mobile layouts stack the action below the row.
- Use `renderMeta` and `renderActions` for page-specific content. Row actions stay outside the selection button.
- Use `getCardProps` for entry classes, data attributes, styles, and drag handlers. Shared entry classes are retained.
- `list` and `soft` share the same compact rows. `grid` changes their arrangement into tiles.
- Identity supports `userid`, `user_id`, `id`, and `employee_code`. Presence is shown only when `getStatus` supplies it.
- Set `--directory-max-height` on a containing page class to change the scroll area. Keep page CSS focused on placement and sizing.

The directory provides pagination, count summaries, loading placeholders, empty and error states, and keyboard focus styling. Do not duplicate its markup or introduce another page-specific sidebar skin.

Run checks with `node src/components/employees/EmployeeDirectory.test.mjs`.
