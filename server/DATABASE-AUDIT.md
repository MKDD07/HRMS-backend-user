# Company account migration audit

Initially inspected read-only on 2026-09-26. The local calendar migration below was subsequently implemented and applied.

## Applied local calendar changes

- `company_calendar`: one row per company, JSON arrays for holidays, important dates,
  leave types and policy groups. Revision checks prevent lost concurrent array updates.
- `company_calendar_assignments`: separate employee assignment rows keyed by company and userid.
- Migrated 7 leave types, 1 holiday, 1 policy group and 4 assignments from
  `data/payroll.sqlite` into company `local-development`. This identifier is strictly
  for the loopback development login, not an inferred production company owner.
- Backed up the database, verified copied values in a transaction, then removed the
  four replaced `calendar_*` tables. Payroll tables remain in use and were retained.
- Backed up `data/company-calendar.sqlite` and removed its two empty unused tables.
- Backups are beside the original databases with `calendar-backup` / `unused-backup`
  and timestamp suffixes. Stop the server before restoring a backup.
- Calendar routes preserve the existing frontend response shape, derive company from
  verified authentication, and reject identities without a company. Important-date
  CRUD is available through the API; no new calendar UI was added.

Run `node server/calendar.test.mjs` for migration, isolation and concurrent-edit checks.
For another confirmed single-company local database:
`node server/migrateCalendar.mjs <sqlite-file> <company-id> --remove-legacy`.
Never run this against data belonging to multiple companies. The CLI backs up first,
rolls back on invalid records and refuses to reassign a completed migration.

The company foreign key to the future master company table, employee/user foreign
keys, company provisioning, and employee/document storage migrations remain pending
inspection of the live Worker schema. Do not claim whole-application tenant isolation:
the legacy payroll and other Worker routes have not been migrated in this change.

## Worker access

The frontend sends login and employee creation requests to
`https://hrms-api.mkmkataria07.workers.dev/api/v1` (`src/lib/api.js`).
The deployed Worker's implementation is not present in this checkout.
`wrangler.toml` points at `server.ts`, but that file starts an Express/Vite HTTP server;
it is not the source of the deployed Worker. Do not deploy it as a replacement.
Cloudflare account ID and API token are not configured in the local environment.
Consequently the production table list, foreign keys, counts and consumers remain unverified.

## Original local table inventory (before migration)

The current calendar and payroll routers use `createPayrollDatabase`, which defaults
to `data/payroll.sqlite` without Cloudflare credentials. Counts below are a snapshot.
None of these eight tables currently has foreign keys or a company column.

| Table in data/payroll.sqlite | Rows | Decision and necessary migration |
| --- | ---: | --- |
| payslip_templates | 0 | Keep: payroll router uses it. Scope IDs and design/slot uniqueness by company. |
| payslip_groups | 0 | Keep: payroll groups. Add company ownership and company-matched template references. |
| payslip_assignments | 0 | Keep: employee payroll configuration. Add company and user references. |
| payslip_records | 0 | Keep: generated payslip records. Add company/user references; scope queries and storage keys. |
| calendar_leave_types | 7 | Keep: leave configuration. Add company ownership. |
| calendar_holidays | 1 | Keep: holiday configuration. Add company ownership. |
| calendar_policy_groups | 1 | Keep: policy groups. Add company ownership and validate same-company policy references. |
| calendar_assignments | 4 | Keep: employee policies. Add company/user references and validate same-company group references. |

`data/company-calendar.sqlite` contains empty `calendar_leave_types` and
`calendar_holidays` tables. No reference to that filename was found in current source.
These are local cleanup candidates, not evidence that similarly named production
tables are unused. Retain until the worker and any other consumers are inspected.

`schema-documents.sql` defines `company_policies` and `employee_documents`, but
neither exists in the two inspected local databases. The Express document endpoints
currently use application-managed records, so production existence/usage must be
verified before changing either table. If used, policies need company ownership and
employee documents need company and employee references.

## Ordered implementation after Worker access is available

1. Read the live schema, indexes, foreign keys, triggers and row counts. Trace every
   table in Worker routes, scheduled tasks and other consumers. Back up before migrations.
2. Reuse or migrate existing company and login tables after inspecting them. The owner
   provisions only a company and its first company-admin username/password; company
   admins subsequently create their employees. Store password hashes only.
3. Establish `companies.company_id`, `users.user_id` and `users.company_id`. Keep
   the login username separate from the immutable internal user ID. Choose global
   username uniqueness if login uses only username/password, without a company code.
4. Link employee profiles to company and user. Use a composite foreign key to
   `(company_id, user_id)` so profiles cannot reference another company's login.
5. Map existing records to verified owners before making company references mandatory.
   Do not assume all legacy records belong to one company. Migrate business tables
   one at a time with the corresponding queries, indexes and constraints.
6. Derive company identity from verified sessions. Enforce admin permissions for
   employee creation and company scope across read/write queries, notifications,
   documents and storage. Adding columns alone does not establish isolation.
7. Test provisioning, login, employee creation, invalid foreign keys and cross-company
   access denial. Connect the directory form only after the backend is ready.
8. Drop only tables verified unused across all consumers, after preserving their data.

Production changes are blocked on the actual Worker source and authorized D1 access.
