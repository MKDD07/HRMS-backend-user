# Company HRMS backend

## Branded login

The Node app now exposes `/api/company-auth` for login, password change, logout,
session verification, branding and directory reads against the new D1 database.
Restart `npm run dev` after updating. The login no longer offers demo authentication.
Initial-password sessions remain in component memory and cannot enter the console.

Company handover link: `/?company=<company_id>`. The public branding response contains
only company name, welcome text and whether a logo exists. Brand images are intentionally
public through this endpoint; employee documents remain authenticated.

Migration `0003_company_branding.sql` adds `companies.logo_key` and `welcome_text`.
Owner API: `POST /api/v1/platform/companies/<id>/branding` with JSON `welcome_text`;
`POST /api/v1/platform/companies/<id>/branding/logo` with raw PNG/JPEG/WebP bytes
(maximum 2 MB) and matching Content-Type. Both require the owner provisioning secret.
R2 keys are generated under `companies/<id>/branding/`; only the object key is stored
in D1. No logo was uploaded because no company logo file was supplied.

For a deployed Worker set `VITE_COMPANY_API_URL` to its HTTPS `/api/v1` URL and
allow the frontend origin in Worker configuration. The current local gateway does
not expose owner provisioning or branding writes to browsers.

The fresh D1 database `hrms-db` (`4fe0e2c8-e4f0-4433-8351-6dbf73359cd7`)
has the schema in `migrations/hrms/0001_core.sql` applied. It contains 11 application
tables and no company accounts or migrated legacy records. The existing production
database remains unchanged.

`index.mjs` replaces the supplied Worker's unverified token parsing, shared-company
queries and automatic legacy schema creation. It is a new backend entry point;
the original Worker has not been overwritten or deployed. It does not include chat,
recruitment or the legacy report endpoints. Unsupported routes return 404.

## Deployment

Use `wrangler.company.toml`, not the legacy `wrangler.toml` (which points to the Node
Express server). The separate Worker name is `hrms-company-api`.

The current API token can edit D1 and R2, but Cloudflare returned 403 for Worker
access. Add Account / Workers Scripts / Edit before deployment. Configure an
independent high-entropy `OWNER_PROVISIONING_TOKEN` Worker secret; never use the
Cloudflare API token as an application credential. Add the actual frontend origin
to `ALLOWED_ORIGINS` before connecting the hosted application.

With Wrangler authenticated:

```sh
npx wrangler deploy --config wrangler.company.toml
npx wrangler secret put OWNER_PROVISIONING_TOKEN --config wrangler.company.toml
```

The owner provisioning route fails closed until its secret is configured. Creating
the first company still needs a company name, admin username and initial password.
Do not put credentials in this document or chat.

## Account flow

- `POST /api/v1/platform/companies`: owner bearer secret; JSON `company_name`,
  `username`, `password`, optional `email`. Creates company, admin and calendar together.
- `POST /api/v1/login`: `username` (or `email`) and `password`; returns random bearer
  session token and company identity. Only the token hash is stored in D1.
- `POST /api/v1/change-password`: authenticated `current_password`, `new_password`.
  Mandatory for initial credentials; revokes all user sessions. Sign in again.
- `POST /api/v1/create-user`: company-admin session; `password`,
  `first_name`, optional `email`, `last_name`, `department`,
  `designation`, `profile` JSON object. Company and employee role are set by backend.
  Employee code and login username are generated together (`AST-001`, `AST-002`).
  Caller-supplied usernames/codes are ignored. UUID user IDs remain unchanged.
  Prefixes use the first three ASCII letters of the company name, with numeric
  suffixes for collisions; names without ASCII letters use EMP. Prefixes stay fixed
  on rename. A transactional company counter prevents duplicates and is not decremented
  on deletion; failed account creation rolls back its increment. Numbers expand past 999.
  Migration `0002_employee_codes.sql` adds the prefix and counter; existing companies
  need a unique prefix assigned before creating employees.
- `GET /api/v1/auth/verify`: verified session identity, compatible with the local
  authentication verifier response. Rejects accounts awaiting password change.
- `GET /api/v1/get-all-users`: admin directory, `limit` (max 200), `offset`.
- `GET /api/v1/get-user?userid=...`: own profile or a same-company profile for admins.
- `POST /api/v1/logout`: revokes the current session.

Business routes are implemented in `index.mjs`: company-calendar configuration and
collection CRUD, check-in/check-out attendance (UTC day), leave application/review,
payroll records (integer paise, INR), document upload/list/download. Files are private
Worker downloads under `companies/<company_id>/...` R2 keys. Individual company
prefixes are created by the first upload; no fake company folders are generated.

## Verification and remaining integration

`node worker/worker.test.mjs` covers provisioning rollback, password/session handling,
role checks, forged tokens, cross-company queries and foreign keys, calendar validation,
attendance, leave, payroll, private R2 downloads, CORS and login throttling.

The frontend is still connected to the legacy API and has demo/offline fallbacks.
Before switching it, remove authentication/data fallbacks, implement initial password
change, add username/password to employee onboarding, map business payloads to the
new API, and use authenticated document downloads. Do not point the legacy Express
payroll database adapter at this database: its old payroll tables are not tenant-scoped.
The new Worker does not claim compatibility with every legacy frontend feature.

D1 creation evidence is in ignored `data/cloudflare-audit/hrms-db-created.json`.
