# Payroll module

Drop the `payroll` folder into `src/pages/` (so `PayrollPage.jsx` sits at `src/pages/payroll/PayrollPage.jsx`).
Imports expect `src/components/ui/*` and `src/lib/salaryStore`, `src/lib/pdfGenerator`.

```
payroll/
  PayrollPage.jsx          shell: month/year, bulk buttons, tabs, shared state
  tabs/
    PersonLedgerTab.jsx    tab 1: one person, all months, pagination, icon download
    ProcessingTab.jsx      tab 2: edit values, save draft, finalize, unlock, add row, copy last month
    RegisterTab.jsx        tab 3: company table, KPIs, filters, pagination
    StructureTab.jsx       tab 4: custom rows (single or multi person) + company bands
  components/
    # Uses shared components/employees/EmployeeDirectory (single or multi-select)
    AddRowForm.jsx         name, amount, type, templates, month scope
    ScopePicker.jsx        only this month / ongoing / selected months
    Pagination.jsx  DownloadIconButton.jsx
  lib/
    customRowsStore.js     custom rows + month scope (swap for your API here)
    payrollHelpers.js      totals, merge rows into drafts, CSV
  constants/rowTemplates.js  corporate templates
```

Where to change things
- New template chip: `constants/rowTemplates.js`
- Move custom rows to a real database: rewrite only `lib/customRowsStore.js`
- New salary field: add it to `EARNING_FIELDS` / `DEDUCTION_FIELDS` in `lib/payrollHelpers.js`
- New tab: create a file in `tabs/` and add one line in `PayrollPage.jsx`
