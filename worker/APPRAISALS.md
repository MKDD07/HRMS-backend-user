# Appraisal Reviews

The dedicated **Appraisal Reviews** sidebar entry preserves the existing workspace theme. It contains Reviews, Review cycles, Calibration, Templates, Audit trail and HR access tabs, shown according to the signed-in user's permissions.

## Setup and operation

1. A company administrator creates a template: competencies/goals/KRAs, questions, section weights totaling 100%, increment suggestions and optional distribution targets.
2. The administrator grants appraisal HR access to selected employees. Ordinary employees can sign in to the workspace for appraisals without receiving access to other dashboard sections.
3. HR creates a draft cycle, selects scope and deadlines, previews eligibility, then launches. Scope filters intersect; probation and joining cutoff exclusions apply. Every selected employee needs one active direct manager. Cycles support up to 500 employees.
4. Employees self-review. Assigned current direct managers review their reports. If enabled, HR assigns 3–10 peers before manager submission; all peers complete their feedback before calibration.
5. HR calibrates with a reason and finalizes outcomes. Publishing releases every finalized result in the cycle and records immutable payroll adjustments. Employees acknowledge receipt; HR can then archive the cycle.

Manager relationships use direct links in Org Hierarchy, with `profile.reports_to_userid` as fallback when no direct links exist. Multiple direct managers prevent launch. A changed reporting line removes the former manager's review access. HR can reassign to the current manager; reassignment clears downstream ratings and outcomes and retains prior values in audit. Reassignment during self-review keeps that stage open.

## Scores, privacy and locking

- Each section averages question ratings and contributes its percentage weight. Question ratings are whole numbers from 1 to 5. Weighted and calibrated scores are rounded to two decimal places before band mapping.
- Bands: Outstanding ≥4.5; Exceeds expectations ≥3.5; Meets expectations ≥2.5; Needs Improvement <2.5. Manager scores replace self scores for the final result; HR may calibrate.
- Employees cannot receive manager ratings, final scores, manager narrative or outcomes before publication, including through lists and CSV exports. HR cannot calibrate, finalize or inspect unpublished ratings for their own review.
- Peer feedback is pooled only after at least three submissions. The API does not attach names to feedback; peer audit entries omit response details and actor identity. HR can see assigned peers and completion status. Raw database audit records remain attributable for accountability, so anonymity applies to the application interface, not database administrators. Free-text comments can still identify their authors.
- Overdue stages reject writes. HR may reopen unpublished stages with a reason and future deadline. Earlier-stage reopening clears downstream data. Published/closed reviews are immutable except acknowledgement.
- Revision guards, reporting-authority checks and audit writes run in the same D1 transaction. Stale requests return 409. Publication checks every review revision with a bounded-parameter JSON snapshot.
- Hourly Worker cron creates idempotent in-app reminders and escalations. These are not email/SMS notifications. The local Express server does not run the Worker cron.

## Payroll

Published increments/bonuses appear in **Payroll → Processing → Published appraisal outcomes**. The payroll administrator explicitly imports them before saving; the server recalculates authoritative amounts from the tenant's published outcomes and replaces generated rows on repeat import.

Annual payroll CTC here means 12 × monthly gross, excluding employer-only benefits. Keep underlying pre-appraisal salary components unchanged while using the additive appraisal import. Monthly increments are `(revised_ctc - base_ctc) / 12`, prorated by calendar days in the first effective month, then recurring. Bonuses apply once in the effective month. Subsequent increases add their incremental differences. This does not automatically change salary structures, employee designations, issue payouts, create PIP cases or enrol employees in training; the published outcome records those decisions for follow-up.

## Database and deployment

`migrations/hrms/0012_appraisal_workflow.sql` adds 12 `appraisal_*` tables without changing the earlier `hr_review_cycles` / `hr_appraisals` records. Those legacy records are preserved but are not automatically converted into the staged workflow.

The migration was applied and its 12 tables verified against the configured `hrms-db` on 2026-10-10. No employee reviews, outcomes or notifications were created by migration. Remote D1 batch parameter binding and rollback were also checked using temporary assertion rows that rolled back.

The local gateway uses the same Worker handlers with parameterized D1 REST batches. Database and document-bucket configuration can fall back to `wrangler.company.toml`; environment overrides still take precedence. Hosted usage requires deploying the updated company Worker and frontend; this implementation session did not deploy them. Restart local development to load server changes if hot reload is not running.

## Validation

Run `npm run test:appraisals`, `npm run test:operations`, `npm run test:payroll`, `npm run lint`, and `npm run build`.

Appraisal checks cover authentication and tenant boundaries, role permissions, scope exclusions, template snapshots, hidden ratings, peer anonymity, concurrency, deadline guards, reopening, reporting changes, calibration/finalization/publication/acknowledgement/archive, timer deduplication, a 500-employee cycle, and payroll import amounts and idempotency. Tests use temporary in-memory SQLite databases. Browser visual verification remains separate from these API/build checks.

Latest checks: 74 appraisal API assertions plus payroll integration, operations, talent, lifecycle and payroll suites pass; TypeScript and production build pass. The pre-existing `worker/worker.test.mjs:80` profile lookup assertion still fails (expects 404, receives the signed-in administrator's own profile with 200). The build retains its existing large-chunk warning.

Cloudflare references: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/), [parameterized REST batches](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
