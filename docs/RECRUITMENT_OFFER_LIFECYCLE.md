# Recruitment offer delivery and hiring

This extends the existing company API and session permissions. It does not introduce a second identity system. No production migration, email, account creation or deployment was performed during implementation; delivery tests use a fake email provider.

## Setup

Apply existing migration `0014_talent_recruitment_audit.sql` and new migration `0015_recruitment_offer_delivery.sql` before deploying the Worker. Configure these server-only values in the Worker and, for local development, the Express gateway:

- `RESEND_API_KEY`: existing Resend API key.
- `DOCUMENT_EMAIL_FROM`: a verified sender.
- `RECRUITMENT_TOKEN_SECRET`: at least 32 random characters, retained across pending-delivery retries. Never use a `VITE_` prefix.
- `HRMS_PUBLIC_APP_URL`: the application origin, such as `https://nexthr.com`. Local development permits `http://localhost:3000`. Paths, credentials, query strings and fragments are rejected.

The frontend host must serve the SPA for `/offer`, and its origin must be included in the Worker's `ALLOWED_ORIGINS`. Deploy the frontend and Worker together so the emailed response page and API are both available.

## HR workflow

1. Complete an interview with an HR Hire/Strong hire assessment. Create an offer draft, fill compensation, joining date, validity and offer terms, and submit for approval.
2. An original company administrator approves the draft. Submitted terms are locked.
3. In Offers, open the approved offer, review its terms and click **Send approved offer**. A delivery snapshot freezes recipient, sender, company, role, compensation, dates, terms and frontend origin. The provider is called only after this snapshot and its audit are committed.
4. The email contains a personal `/offer#delivery-id.token` link. The fragment is not transmitted as a page URL/query to the server. The page sends the token in `X-Offer-Token`; it does not use or overwrite the HR login session. The database stores only the token hash; the token is recreated for retries using a server-side HMAC secret. Audit rows and delivery snapshots contain no response token.
5. Candidate acceptance requires a typed name and explicit agreement. Declining requires a reason and rejects the application. Withdrawal invalidates a sent link. Company suspension also disables links. Acceptance is recorded server-side, with timestamp and request metadata; this is a typed acknowledgement, not a third-party electronic-signature integration.
6. An original administrator opens an accepted offer and creates the hiring handoff with the employee's first/last names and an onboarding coordinator from this company.
7. A single guarded D1 batch marks the application Hired, generates the employee code, creates a disabled user and Inactive employee, creates the onboarding checklist, records hire references, updates opening capacity and closes filled openings. Linked requisitions become Fulfilled when their approved headcount is reached. Audit/outbox writes are in the same transaction. Failed constraints or audit writes roll back the whole handoff. Retrying a completed handoff returns the same account and plan.
8. Open the recruitment-created onboarding plan on or after its joining date and choose **Mark joined & activate account**, with a temporary password of 12–128 characters. Activation changes employee/login status and onboarding state atomically. The employee must change the temporary password at first sign-in. HR must share it privately; it is not emailed, returned, stored in audit data or included in events.

Annual CTC stays in the approved offer. Hiring does not infer payroll components, automatically create a salary structure, or grant dashboard access. Joining activation does not claim that onboarding tasks are completed.

## Delivery recovery and expiry

Provider acceptance is recorded as **Sent / Accepted by email provider**, not confirmed inbox delivery. Bounces and provider webhooks are not integrated in this slice.

An interrupted request or failed final audit leaves **Delivery pending**. Retry delivery reuses the frozen payload, response token and provider idempotency key. The candidate link becomes usable only after the provider acceptance and final audit transaction commits. HR cannot change the application while a delivery is pending.

Automatic retry is refused after 23 hours or after the offer validity ends. Resend retains its idempotency keys for 24 hours; blindly retrying later could send a duplicate. Check provider activity and reconcile the recorded delivery before replacing or recovering such a pending offer. There is no automatic reconciliation UI yet. Do not delete a pending record or change the signing secret to force a new email.

Sources: [Resend idempotency retention](https://resend.com/changelog/idempotency-keys) and [D1 transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/).

The public response API enforces the validity date immediately through the end of that day in IST. Bounded hourly work also marks up to 100 expired Sent/Approved offers as Expired, with audit and outbox rows. Accepted offers remain accepted after their former response deadline. Outbox rows are persisted; delivery of general workflow events and notifications remains pending.

## API

| Method | Route | Access |
|---|---|---|
| POST | `/api/v1/talent/offers/:id/send` | Recruitment dashboard scope; `{revision}` |
| GET | `/api/v1/public/recruitment/offers/:deliveryId` | `X-Offer-Token`; whitelisted offer fields only |
| POST | `/api/v1/public/recruitment/offers/:deliveryId` | Same token; `{decision:'accept',typed_name,confirmed:true}` or `{decision:'decline',reason}` |
| POST | `/api/v1/talent/offers/:id/hire` | Original company administrator; `{revision,first_name,last_name,owner_id}` |
| POST | `/api/v1/talent/onboarding/:id/activate` | Original company administrator; `{revision,temporary_password}` |

Manual record saves cannot set Delivery pending, Sent, Accepted, Declined or Hired. The dedicated services own these transitions. Direct reads/writes and actions remain company-scoped; public links contain no company/employee identity API access.

## Verification

`npm run test:recruitment` exercises approval/state rules and the offer lifecycle against SQLite with a serialized D1 batch adapter and a fake provider. Coverage includes interrupted delivery, identical retry payloads, token redaction, HTML escaping, invalid/expired/withdrawn links, response audit rollback, employee/audit rollback, headcount, requisition fulfillment, disabled accounts, activation boundaries, company isolation and idempotent retries.

Existing talent, lifecycle-document and appraisal tests and the production build also pass. Advanced panelist scoring, configurable approval chains, automated interview invitations, public careers intake, resume uploads, external signature providers and automated reconciliation remain separate work.
