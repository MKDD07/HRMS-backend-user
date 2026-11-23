# Talent & Growth implementation review

The supplied backend specification is a reference for staged improvements to the existing HRMS. Its standalone `employees`/`users` migrations, integer IDs, JWT model and `ok` response envelope must not replace this application's company-scoped UUID identities, sessions, delegated dashboard permissions and existing response envelope. Reuse the installed Workers/D1/R2 infrastructure and shared UI components.

## Implemented first slice: requisitions and opening controls

- Recruitment now includes Hiring requisitions, Job openings and Candidates.
- New requisitions and openings begin as drafts. Requisition submission requires justification. Approval and rejection require an original company-administrator role. Rejection requires a reason; rejected requests can return to draft.
- Submitted requisition details are locked. Requester and approver identities are assigned by the service, never trusted from submitted fields.
- Linked openings require an approved requisition and cannot exceed its approved positions. Legacy unlinked openings remain supported; mandatory requisitions are not retroactively imposed.
- Publishing requires a description and, when specified, a future closing date. Opening transitions are controlled; closed/cancelled openings cannot silently reopen.
- Each requisition/opening mutation writes an audit row in the same D1 batch as the record. State changes also write an outbox record. A failed audit write rolls back the record change. Revision and prerequisite guards protect concurrent writes.
- Audit reads: `GET /api/v1/talent/{requisitions|jobs}/:id/audit?offset=0` (100 rows per page, company-scoped).
- Existing themed header, buttons, modal frame, stat values, filters and tables are reused. Editors offer the current state and permitted next states.

Apply `migrations/hrms/0014_talent_recruitment_audit.sql` and `0015_recruitment_offer_delivery.sql` to the existing database before deploying the updated Worker. No remote migration or deployment was performed in these changes.

Outbox events are persisted only in this slice. Queue delivery, handlers and email automation are pending; saved event rows do not mean emails were sent.

## Subsequent slices, in order

### Implemented second slice: internal pipeline, interviews and offer approvals

- Candidate applications now start at Applied, require an open opening, normalize email and enforce controlled stage transitions. Rejection requires a reason. Existing Hired records remain readable, but manual conversion to Hired is blocked until accepted-offer hiring is implemented.
- Candidates have a themed, animated pipeline with per-opening filtering, stage accents, source labels, upcoming interview details and interview/offer shortcuts. Animations respect reduced-motion preferences using the installed Motion library.
- Interviews store an interviewer, date, start/end time in IST, mode and location. An atomic SQL guard blocks overlapping scheduled interviews for the same interviewer; adjacent slots are allowed. Completed/cancelled interviews are locked. Completed interviews require an HR assessment; this is not a blind panelist scorecard.
- Offer drafts track CTC, joining date and validity. Submission requires a completed Hire/Strong hire assessment. Only an original company administrator can approve/reject. Submitted details are locked and only one nonterminal offer is allowed per application. Moving a candidate to Offered requires an approved offer.
- Candidates, interviews and offers use the same transactional audit/outbox writes, company scoping and revision controls as requisitions and jobs. Their audit endpoints use the same URL structure.
- New Interviews and Offer approvals tabs reuse existing editors, buttons, filters and export tools. The candidate view remains compatible with current records.

This slice is internal HR recordkeeping. It does not send interview invitations/offers, record external candidate acceptance, create employee accounts or deliver outbox events. Configurable pipelines, public application intake, multiple panelists, blind scorecards and configurable approval chains remain pending. Migration 0014 is still required; no additional migration, remote schema change or deployment was performed.

### Implemented third slice: offer responses and hiring handoff

Offers can now be sent through the existing Resend integration after approval. The candidate response page supports acceptance or decline through a private, hashed-token link. Immutable delivery snapshots and bounded idempotent retries protect against interrupted sends. Hiring requires a genuine recorded acceptance and atomically creates an employee and onboarding plan, updates capacity and writes audit/outbox events. Accounts start disabled; administrators activate joiners from their onboarding plans on or after the joining date, with a required first-login password change.

See [offer lifecycle setup, API and recovery limits](./RECRUITMENT_OFFER_LIFECYCLE.md). Migration 0015 and server-side signing/public-origin configuration are required. Provider acceptance is not confirmed inbox delivery. No real email or account was created during development.

The earlier second-slice restrictions are superseded by these dedicated services; manual status editing still cannot send, accept or hire. Public careers ingestion, configurable pipelines, panelist scorecards, configurable approval chains and interview invitation automation remain unfinished.

### Remaining slices after the hiring handoff

1. Recruitment pipeline configuration and application state service; public careers ingestion with validated files, consent, idempotency, Turnstile and rate limiting.
2. Multiple interview panelists, blind scorecards, configurable approval chains and interview invitations. Basic scheduling, offer approval, secure responses and transactional hiring are implemented.
3. Onboarding task templates, ownership/dependencies, joining activation and training assignments, extending the existing document generation and delivery services.
4. Exit approvals and clearance dependencies, access revocation, settlement review and exit lifecycle. Financial/legal calculations require verified policy configuration rather than copied constants.
5. OKR cycles, directional/milestone key results, weighted rollups, approvals, check-in history and alignment. Current simple objective progress needs migration compatibility.
6. Appraisal gap review: retain the existing access/privacy, score calculations, calibration, deadlines, publication, acknowledgement, revision controls and payroll tests; add development-plan links where absent.
7. Learning prerequisites, lessons, server-graded quizzes, attendance, certification lifecycle, compliance reminders and skill gaps, extending the existing catalogue/assignments.
8. Event consumers and notifications, bounded cron jobs, broader pagination, retention, operational telemetry and API documentation.

Do not introduce a second authentication system, unauthenticated file bucket, sample employee records or routes that expose another company's data.

## Verification

- `node worker/recruitmentService.test.mjs`: transition matrix, approval roles, company isolation, revision conflicts, headcount guards and atomic audit/outbox rollback.
- `node worker/recruitmentOffers.test.mjs`: secure responses, idempotent email retries, expiry/revocation, transactional hiring, capacity and joining activation.
- `node worker/talent.test.mjs`: existing module validation, references, ownership, revisions, asset lifecycle, checklists, goals and learning.
- `npm run build`: frontend and local Worker gateway bundle.
