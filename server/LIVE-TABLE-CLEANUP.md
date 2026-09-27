# Live table cleanup review

Inspected 2026-09-26T18:18:10.843Z.

43 application tables inspected; 14 are empty. Initial inspection only; see completed cleanup below.

The deployed hrms-api Worker source request returned HTTP 403 (No access to the specified resource). D1 access alone cannot establish whether a table is unused. Empty tables are not deletion candidates without checking Worker routes, scheduled jobs and mobile/chat clients.

| Table | Rows | Decision |
| --- | ---: | --- |
| users | 7 | Keep pending usage audit; contains data |
| personal_details | 3 | Keep pending usage audit; contains data |
| professional_details | 3 | Keep pending usage audit; contains data |
| family_details | 3 | Keep pending usage audit; contains data |
| bank_details | 3 | Keep pending usage audit; contains data |
| attendance | 9 | Keep pending usage audit; contains data |
| leaves | 10 | Keep pending usage audit; contains data |
| salaries | 5 | Keep pending usage audit; contains data |
| reimbursements | 3 | Keep pending usage audit; contains data |
| holidays | 3 | Keep pending usage audit; contains data |
| company_documents | 5 | Keep pending usage audit; contains data |
| company_assets | 8 | Keep pending usage audit; contains data |
| job_postings | 0 | Usage unresolved; do not delete based on emptiness |
| candidates | 0 | Usage unresolved; do not delete based on emptiness |
| onboarding_tasks | 5 | Keep pending usage audit; contains data |
| offboarding_clearances | 0 | Usage unresolved; do not delete based on emptiness |
| goals_okrs | 4 | Keep pending usage audit; contains data |
| learning_courses | 0 | Usage unresolved; do not delete based on emptiness |
| hr_tickets | 4 | Keep pending usage audit; contains data |
| hr_analytics_metrics | 0 | Usage unresolved; do not delete based on emptiness |
| profile_change_requests | 0 | Usage unresolved; do not delete based on emptiness |
| office_locations | 4 | Keep pending usage audit; contains data |
| office_timings | 21 | Keep pending usage audit; contains data |
| messages | 124 | Keep pending usage audit; contains data |
| message_attachments | 3 | Keep pending usage audit; contains data |
| message_reads | 64 | Keep pending usage audit; contains data |
| announcements | 1 | Keep pending usage audit; contains data |
| user_presence | 0 | Usage unresolved; do not delete based on emptiness |
| company_settings | 1 | Keep pending usage audit; contains data |
| daily_work_reports | 1 | Keep pending usage audit; contains data |
| employee_hierarchy | 0 | Usage unresolved; do not delete based on emptiness |
| chat_day_blobs | 8 | Keep pending usage audit; contains data |
| user_chat_keys | 3 | Keep pending usage audit; contains data |
| channel_wrapped_keys | 0 | Usage unresolved; do not delete based on emptiness |
| chat_backup_audit | 0 | Usage unresolved; do not delete based on emptiness |
| regularizations | 0 | Usage unresolved; do not delete based on emptiness |
| resignations | 0 | Usage unresolved; do not delete based on emptiness |
| user_device_tokens | 1 | Keep pending usage audit; contains data |
| conversation_members | 1 | Keep pending usage audit; contains data |
| user_notifications | 8 | Keep pending usage audit; contains data |
| conversations | 1 | Keep pending usage audit; contains data |
| company_calendar | 0 | Keep: newly created company calendar storage |
| company_calendar_assignments | 0 | Keep: newly created company calendar storage |

The legacy holidays table has 3 records. Its replacement has no production company rows. Do not drop holidays until records have confirmed company ownership and the Worker has switched to the new storage.

Next access needed: Account > Workers Scripts > Read on this account, or the deployed Worker source supplied as a local project file. Back up any confirmed obsolete tables before dropping them.

## Completed cleanup after Worker source review

The supplied bundled Worker source was inspected on 2026-09-26. Removed two empty live tables after checking dependencies and backing up their definitions:

- `employee_hierarchy`: no references in the Worker or application SQL. Current hierarchy persistence uses localStorage and the Express JSON-file endpoint.
- `user_presence`: the name appears only as a WebSocket event type; presence is held in Durable Object sessions, with no SQL reads, writes or table creation.

Verified both tables are absent; 41 application tables remain. Retained other empty tables because Worker routes use them, and retained the new calendar tables because the Node calendar backend uses them. Legacy holidays remain required by Worker routes.

Backup: `data/cloudflare-audit/unused-tables-backup.json`. Restore SQL: `data/cloudflare-audit/restore-unused-tables.sql`. Verification: `data/cloudflare-audit/cleanup-result.json`. No Worker deployment was necessary for these two removals.
