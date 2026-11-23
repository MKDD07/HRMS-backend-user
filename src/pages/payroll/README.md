# Payroll module

Payroll summaries, the company register, salary history and CSV exports use the latest saved payslip-service revision for each employee and period. Missing salary records are shown as Not started. Browser salary caches are no longer used as report data.

Payment reconciliation reads Accounts & Payments records for the matching payroll month. Only explicitly Recorded payments count toward paid amounts. Draft/Finalized salary status is separate from Unpaid/Partially paid/Paid payment status; payments without a salary are identified as unmatched. Generating a payslip never marks a payment as paid.

Review & finalize lists missing salary drafts, incomplete preferred payment details and missing assigned templates. It finalizes ready drafts and skips already finalized salaries. Monthly processing checks the same readiness rules. Drafts can be saved without a payslip template; finalization requires one.

Reusable salary rules and recurring components are stored with payroll groups in the payslip service. Structures & Payslip Studio owns rules, component formulas, payslip designs and employee assignments. Salary & Payroll owns employee amounts, period adjustments, statutory costs, salary history, finalization and payment reconciliation. Legacy browser-managed rows are still read into existing drafts.

Every editable draft has an explicit Indian calculation policy: assigned group rules, saved period rules or the Indian default. Editing basic derives base gross from the configured basic percentage; editing gross derives basic and allowances. PF, ESI and gratuity recalculate from actual earnings and verified coverage / wage overrides. PT and TDS remain employee amounts. Period salary snapshots preserve rules independently of subsequent group edits. Apply latest saved rules is explicit and never edits finalized salaries.

Validation: `node shared/payrollWorkspace.test.mjs`, `npm run test:payroll`, `npm run lint`, and `npm run build`.

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
