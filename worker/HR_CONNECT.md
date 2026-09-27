# HR Connect

The former Help Desk navigation opens HR Connect: announcements, employee messages, email drafts, grievance reviews, and the existing workflow notification feed. All records use the authenticated company database; no sample tickets or browser-only records are used.

Apply `migrations/hrms/0005_hr_connect.sql` to the company database and deploy the updated Worker (or restart the local company gateway) before using the new storage routes. This change does not apply remote migrations or deploy automatically.

```
npx wrangler d1 migrations apply hrms-db --remote --config wrangler.company.toml
npx wrangler deploy --config wrangler.company.toml
```

`GET /api/v1/hr-connect?offset=0` returns 100 records per page. Administrators see their company's records. Employees see only published communications addressed to their user ID and their own grievances. Recipient IDs and private review history are excluded from employee responses. Audiences are captured when the communication is created; new hires are not automatically added to older communications.

`POST /api/v1/hr-connect` creates announcement/message/email drafts or grievances. Administrators may publish announcements and messages. Employees may submit only their own grievances. Email records can only be drafts; the UI exports a UTF-8 `.eml` file. Recipients must be added in the mail application. There is no email transport, mailbox sync, push delivery, or read-receipt tracking.

`POST /api/v1/hr-connect/:id` lets administrators publish an existing communication draft or update a grievance status with a mandatory private review note. Both require the last-read revision and reject concurrent changes. Reviews retain the actor, timestamp, status and note. Resolved grievances can be reopened with a new review note.

Published communications are available from the employee-scoped API for employee clients to consume. They are not injected into the workflow notification feed. The notifications tab retains the existing 15-second workflow polling and read controls.

Verification: `node worker/worker.test.mjs`, `npm run lint`, `npm run build`.
