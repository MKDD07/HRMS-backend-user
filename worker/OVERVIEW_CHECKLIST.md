# Overview improvements — 2026-10-10

## Existing features retained

- Loading/error/empty states, manual refresh and IST refresh timestamp.
- Department filter, team distribution, employee/punch/leave counts, pending leave requests, approved leave schedule and incomplete-profile checks.
- Attendance chart with 7- and 30-day selection. Its source now includes scheduled absence and approved leave.

## Implemented

- Unambiguous distribution labels, e.g. `1 employee · 50%`.
- Upcoming holidays collapse repeated entries with the same date and normalized name, including imports with different IDs/categories or capitalization/spacing. Distinct holidays on the same date remain separate. This runs in both the overview API and dashboard rendering; saved calendar records are preserved.
- One company-scoped `/api/v1/overview` endpoint in place of one attendance request per employee.
- Server-side IST dates. Browser punch aliases (`punch_in`, `punch_out`) are accepted alongside `check-in`, `check-out`. Checkout closes the latest open record from the preceding 24 hours, including across midnight.
- Absent, late, early-exit and half-day metrics using configured shifts, grace periods, working days, holidays and approved leave. No configured shift means unknown schedule, not absence. Early-exit grace and half-day thresholds are editable in Shifts; 0 half-day hours disables that classification.
- Probation, confirmations due within 30 days (including overdue), current-month joiners, completed exits and active notice plans. Confirmation dates fall back to onboarding probation settings.
- Needs attention: missing punch-outs from the previous day, regularizations, leave requests, expense approvals/payments, overdue self/manager appraisals, incomplete onboarding/offboarding checklist tasks, expiring documents and incomplete profiles.
- Optional expiry date on document upload, stored in existing document metadata and visible in preview. Expired and next-30-day personnel documents feed the attention list.
- Birthdays/anniversaries for the selected Monday–Sunday week; company holidays for the following 30 days.
- Headcount by recorded joining/exit dates and employment type; policy-based leave balance estimate and leave-type usage.
- Monthly payroll summary uses the newest Payroll Studio revision per employee; core Paid records take precedence. Finalized means Processed, never Paid. Next pay date uses saved payroll dates.
- Published announcements, hiring pipeline and recent approval/appraisal audit events. Sensitive audit payloads and anonymous peer actions are excluded.
- Quick actions: add employee, view pending leave, payroll, publish announcement and export attendance CSV.
- Department, work-location and shift filters; custom dates up to 90 days. KPI/attention cards open the matching filtered records, with employee profile links and permission-aware module links.
- Refresh every 60 seconds while the browser tab is visible. Failed background refreshes retain prior data with an error; failed individual sources are marked unavailable.
- Setup checklist for departments, active shifts, leave policies, holidays and saved payroll assignments. It disappears automatically when complete.

## Scope and permissions

The endpoint requires company-admin access or an explicit Dashboard page grant. Admins see the company workforce. Explicit HR grants currently use the existing `appraisal_roles` HR designation. Other dashboard users receive a manager view containing only unambiguous direct reports from Org Hierarchy (profile manager fallback when no direct links exist). Payroll, expenses, documents, recruitment and lifecycle module links respect page grants; employees keep their existing appraisal access. No live permission grants were changed.

Daily metrics use the selected end date. Current status/workflow queues are current records, rather than historical snapshots; trends use the selected period. Upcoming holidays and celebrations are anchored to that end date. Company setup is independent of employee filters. Company-wide audits are hidden while employee filters are active, and recruitment is hidden under a shift filter because vacancies have no shift assignment. Announcements are visible only to authorized recipients/managers and are matched to the selected workforce; posting explicitly shows its audience and uses department/all-company scope.

Historical attendance uses current shift configuration, because the repository has no historical roster ledger. Leave balances are estimates from saved policy assignments/accrual and approved calendar-day leave; there is no authoritative transaction ledger for carry-forward/manual adjustments/partial days. They are labelled accordingly. Missing joining dates are excluded from historical headcount and reported.

## Checks and remaining external verification

- `npm run test:overview`: IST boundaries, grace periods, holidays, overnight shifts, no-schedule handling, all workforce filters, payroll deduplication, setup completion, role/company isolation, partial errors, expiry validation and web punch aliases.
- Appraisals, operations, talent, lifecycle and payroll regression suites, TypeScript and production build passed. The build still has its existing large-chunk warning.
- Read-only D1 smoke check: one active tenant, 2 active employees, 0 punch rows in the selected seven days, no overview source errors, no employees lacking an active default/assigned schedule.
- Attendance records have no device/web/mobile source identifier. Stored zero counts are confirmed; terminal connectivity and actual mobile delivery still require a real punch from those clients. No device integration or mock live attendance was fabricated.
- Browser visual verification could not run: the computer-use tool returned no connected browsers/apps.
- No new database migration is required. No live employee records, announcements, salary decisions or permissions were changed. Hosted frontend/Worker deployment was not performed; the updated sources must be deployed together for hosted use.
- The pre-existing `worker/worker.test.mjs:80` profile lookup test failure documented with the appraisal work is outside these overview changes.
