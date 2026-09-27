# Talent and operations modules

All seven navigation entries now use the existing theme through reusable workspaces,
forms, tables, statuses, and buttons. `TalentWorkspace.scss` uses the app's SCSS/CSS
tokens for colors, fonts, spacing, radii, shadows, and breakpoints.

## Supported workflows

- Recruitment: create/edit openings; add candidates against an opening; update stage;
  search and filter; inspect pipeline; export records.
- Onboarding: employee and coordinator selection, joining/due dates, editable tasks,
  task completion, and plan status.
- Offboarding: employee/coordinator, notice/last-working dates, handover and clearance
  checklist, and status. Completing a checklist records confirmation only; it does
  not disable accounts, send notices, or run payroll settlement.
- Goals: employee objectives with due dates and numeric key results. Progress is the
  equal-weight average of current/target, capped at 100%. These key results measure
  increasing quantities. Completion requires every target to be met.
- Assets: inventory, unique company asset tags, employee assignment, condition, issue
  dates, returns (clear assignee and choose Available), maintenance, and retirement.
- Reports: status summaries and created-date filtering for all eight record types;
  real CSV downloads, including spreadsheet formula-prefix escaping.
- Learning: course metadata and links; employee assignments with manual progress and
  completion. This is a learning tracker, not a hosted course player or SCORM engine.

## Storage and access

`worker/talent.mjs` handles `/api/v1/talent/:collection[/:id]` via the existing
company-auth gateway. No browser-only persistence or mock records are used.
`migrations/hrms/0009_talent_operations.sql` adds the company-scoped table and unique
indexes. The Worker deployment must include the new handler. Local development
loads the handler through the existing Express gateway.

Company admins can manage all modules. Delegated dashboard users need the matching
page permission. Reports permission grants read-only access to report source data,
not write access. Regular employee sessions cannot access these administrative routes.
Employee and record references are checked against the authenticated company.
Revisions prevent silent overwrites. The last 100 status-save events are retained.

No existing legacy/mock data is automatically imported. Creating a candidate marked
Hired does not create an employee account; create the employee using the directory,
then create their onboarding plan. Outbound messages, job-board publication, resume
uploads, and automated account/asset integrations are outside this initial release.

## Reuse

```jsx
import { TalentWorkspace } from './pages/talent/TalentWorkspace';

<TalentWorkspace key="onboarding" module="onboarding" onShowToast={showToast} />
```

Use `shared/talentModel.mjs` for module fields and labels shared by frontend and server.
Validate new specialized workflows server-side in `worker/talent.mjs`.

Verification: `node worker/talent.test.mjs`, `node worker/worker.test.mjs`, and
`npm run build`. UI browser verification requires an available browser session.

## Asset inventory and handovers

Assets now has two tabs: IT assets list and Issue & return. Inventory holds asset
name/tag, type (with a custom Other name), brand/model, technical specifications,
condition, location, maintenance status, and purchase/warranty metadata. Employee
assignment is not part of inventory creation.

Issue records hold asset, employee, issued/sent date, employee received date,
returned-to-company date, acknowledgement note, and return condition. Receipt and
return confirmations are recorded by the administrator; the note is not an employee
electronic signature. Returning an issue releases the asset for a new issue.

Apply `migrations/hrms/0010_asset_issues.sql` before using the updated asset routes.
It converts legacy assignments into issue records, removes legacy assignment fields
from inventory, and adds a unique index preventing two active issues for one asset.
This migration is idempotent and tested locally. Remote application requires approval.

Purchase date, price/currency, vendor, invoice, warranty, and purchase notes are
company-administrator-only. Delegated dashboard users receive redacted inventory
responses and cannot change these fields. Editing other asset details preserves
existing protected data. The reports screen also omits these fields for delegates.
