# HR operations

Six independent sidebar sections reuse the existing TalentWorkspace styles and shared Button component. They use authenticated company API routes, not browser-only persistence.

| Section | Database tables | Behavior |
| --- | --- | --- |
| Expenses & Reimbursements | `hr_expenses`, `hr_expense_receipts` | Draft claims, PDF/PNG/JPEG receipt uploads to the existing private R2 bucket, submission, assigned approver/admin review, admin-recorded payments |
| HR Analytics | `hr_analytics_views`; reads existing employee, attendance, payroll, payslip and offboarding tables | Monthly headcount and attrition, punch-day/hour totals, current departments, separate core payroll and Payroll Studio summaries, saved date ranges and CSV export |
| Appraisal Reviews | `hr_review_cycles`, `hr_appraisals` | Review periods, HR-recorded self-reviews, assigned manager feedback, ratings and immutable finalized outcomes |
| Benefits & Insurance | `hr_benefit_plans`, `hr_benefit_enrollments`, `hr_dependants` | Plans, providers, premiums, coverage periods, enrollments, dependants and upcoming renewal counts |
| Employee Surveys | `hr_surveys`, `hr_survey_responses` | Rating/text questionnaires, identified HR-recorded responses, one response per employee/survey, average scores and answer distributions |
| Projects & Timesheets | `hr_projects`, `hr_timesheets` | Projects, quarter-hour entries, assigned approver/admin review, approved/billable/budget totals |

## Database and runtime

Apply `migrations/hrms/0011_hr_operations.sql` to the company database configured in `wrangler.company.toml`. This is an additive, idempotent migration. Existing business records are not changed. Atomic SQL write conditions prevent aggregate daily time exceeding 24 hours, including concurrent writes. No new R2 bucket or secret is required.

Local `npm run dev` uses the Express company gateway, which runs the same Worker handlers against the configured Cloudflare D1 database. Hosted clients using the remote company API require deployment of the updated Worker. Deploying the web frontend alone does not deploy the API.

Routes:

- `GET/POST /api/v1/operations/:collection[/:id]`
- `POST /api/v1/operations/{expenses|timesheets}/:id/review`
- `POST /api/v1/operations/expenses/:id/pay`
- `GET/POST /api/v1/operations/expenses/:id/receipts`
- `GET /api/v1/operations/expenses/:id/receipts/:receiptId`
- `GET /api/v1/hr-analytics?from=YYYY-MM&to=YYYY-MM`
- `GET/POST /api/v1/hr-analytics/views`

## Permissions and workflow boundaries

Company admins can access all six pages. Delegated users need the individual page permission from Dashboard Users. All record lookups, employee references, receipt retrieval and analytics queries are company-scoped. Optimistic revisions prevent lost updates.

Expenses and timesheets have module-specific assigned approvals. They are not automatically added to the existing Org Hierarchy workflow inbox. A reviewer must have the matching dashboard page permission, or a company administrator can review. Self-approval is rejected. Submitted records cannot be edited; rejected records may be revised and resubmitted. Only company administrators can mark expenses paid; this records an already completed payment and does not transfer money or update payroll.

Appraisals and survey responses are administrative recording tools. They do not add an employee self-service login, send invitations, or send messages. Survey responses are identified, not anonymous. Questions are frozen once a survey receives a response. Benefit records track coverage, not insurance purchases. Archiving/ending records preserves history; there is no destructive record deletion.

Analytics uses recorded joining dates (account creation date if missing) and exit dates/completed exit plans. Missing exit dates and fallback dates produce data-coverage warnings. Payroll Studio uses the latest finalized salary per employee/month; core payroll remains a separate source to prevent double counting. Finalization does not imply payment. Punch hours use complete timestamp pairs, not scheduled attendance percentages. Analytics does not copy or fabricate historical records.

## Checks

`npm run test:operations` verifies all six authenticated module routes, company isolation, delegated access, revision conflicts, receipt storage/download, claim approval and payment guards, review finalization, coverage references, survey uniqueness/immutability, timesheet daily limits, analytics totals and migration idempotency.

Run `npm run lint` and `npm run build` for frontend/compiled-server validation.
