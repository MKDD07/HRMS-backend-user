# Approval workflows

## What is implemented

The organizational hierarchy has Responsibilities, Policies & preview, and Requests & audit tabs. Live-directory relationships can carry separate leave, attendance, expense and other responsibilities. Settings default to off; a missing approver blocks a request rather than approving it.

Policies select by request type, department, profile.location, and leave duration (calendar days, not deducted working days). Higher priority wins; more specific policies win ties. Approval rules support any-one, all and sequential. Steps run from 1 to 6. An include-through-step limit lets a short-leave policy include only step 1 while a longer-leave policy also includes step 2 (for example HR).

Backups are used when a responsible employee is inactive or Use backup now is selected. Effective dates apply when submitting. Requests snapshot the policy, participants and configuration revision. Changes apply to new requests only. Company administrators can explicitly reassign an open request with a reason. All changes and decisions are audited. Policy audit records contain before/after configuration snapshots.

Approvers receive full request details and may decide only their current step. Reviewers may inspect details but cannot approve. CC recipients see summaries without private reasons. Requester, approver and CC lists are available through authenticated company-scoped endpoints for a future employee app.

Leave submission writes the leave and route atomically. Final approval/rejection updates the leave row. Attendance correction approval updates the recorded check-in/out times atomically. Expense/other workflows record approvals only; they do not execute reimbursements or other external actions.

Notifications are stored per recipient and polled every 15 seconds while the header is mounted. They are in-app notifications, not email or push. The hourly Worker schedule sends a single reminder per active stage and can transfer the active stage to its configured escalation approver. A declined request is final. Escalated participants lose approval authority. Reviewers and CC never receive approval rights.

## Database / deployment requirement

Apply `migrations/hrms/0004_approval_workflows.sql` to the company database before running this feature against it, and deploy the updated Worker. This implementation does not apply remote migrations or deploy automatically.

Using the repository's Worker configuration:

```
npx wrangler d1 migrations apply hrms-db --remote --config wrangler.company.toml
npx wrangler deploy --config wrangler.company.toml
```

The local Express company gateway executes the same Worker against the company D1 database. Restart it after updating the code. The existing hourly cron in `wrangler.company.toml` handles reminders/escalation in production; the local Express server does not run scheduled Worker events automatically.

Configuration now lives in authenticated D1 storage. The legacy unauthenticated `hierarchy_store.json` and browser snapshots are not trusted approval authorities and are not automatically imported. No fabricated reporting defaults are created. Establish and publish verified reporting relationships in the new configuration.

## API

All routes are under `/api/v1/workflows/` on the Worker or `/api/company-auth/workflows/` locally, with the same bearer session as company authentication.

- `GET/POST configuration`: admin-only; POST includes `configuration` and last-read `revision` (optimistic concurrency).
- `GET directory`: complete live company employee directory, admin-only.
- `POST preview`: admin-only, accepts requester, kind, days and optional draft configuration.
- `POST requests`: submit attendance/expense/other; employees submit only for themselves.
- `GET requests?view=mine|approvals|following|all&offset=0`: 100 records/page; all requires admin.
- `POST requests/:id/decision`: active assigned approver only; decision Approved/Rejected and remarks.
- `POST requests/:id/reassign`: admin-only; userId, fromUserId (pending requests), reason.
- `GET notifications`, `POST notifications/read`: recipient-scoped, optional notification ID for marking read.
- `GET audit?offset=0`: admin-only, 100 records/page.

`POST /api/v1/apply-leave` creates a routed leave. `POST /api/v1/review-leave` delegates to the workflow decision engine; it is no longer a blanket admin override. Legacy leaves without routes cannot be approved through this endpoint.

## Verification

```
node --test shared/workflowModel.test.mjs src/lib/reportingMatrix.test.mjs
node worker/worker.test.mjs
npm run lint
npm run build
```
