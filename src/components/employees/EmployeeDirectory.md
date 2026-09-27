# Universal EmployeeDirectory

`EmployeeDirectory.jsx` and the adjacent `EmployeeDirectory.css` are the single employee-card implementation. Used by Employees, Attendance, Geofence, Leave, Payroll, Documents and Performance.

```jsx
<div className="employee-workspace">
  <div className="employee-workspace-content">{selectedEmployee && <EmployeeDetails employee={selectedEmployee} />}</div>
  <EmployeeDirectory employees={employees} selectedId={selectedEmployee?.userid} onSelect={setSelectedEmployee} />
</div>
```

Parents own fetching and selection. The card provides search, department filtering, pagination, photo fallback, keyboard selection and loading/error/empty states. Pass `loading`, `error` and `onRefresh` for request state. A supplied `toolbar` replaces the built-in filters; in that case pass already-filtered employees and the full `totalCount`.

For payroll multi-selection, pass `multi`, `selectedIds`, `onToggle(id)`, `onSelectAll(filteredIds)` and `onClearAll`. `renderMeta(person)` adds non-interactive per-person details; `headerExtra` adds mode controls. Select-all operates on all filtered records, across pages.

`employee-workspace` keeps details on the left and the card on the right. At widths of 1100px or less it stacks the directory above the content. Use `employee-workspace-directory` when wrapping the card with extra actions. Do not duplicate card CSS in page styles.
