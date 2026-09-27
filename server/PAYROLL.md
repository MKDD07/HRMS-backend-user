# Salary & Payslip Studio

The Edit Salary & Structure page contains the template designer, payroll groups, per-person assignment, and salary entry. Existing component editing remains in the Salary components tab. The universal employee directory stays on the right.

## Workflow

1. Choose Classic, Modern, or Minimal. Save up to five variants per base design.
2. Add the real company name, address, identifiers, logo, signature, signatory and optional statement/footer text. PNG/JPEG assets may be at most 500 KB and 4096 pixels per side.
3. Preview the generated PDF with the selected person and current salary inputs. Previewing does not issue or upload a payslip.
4. Create a payroll group with a custom type and a default template. Assign a person or use the directory's multi-select for bulk assignment. A person's explicit template overrides their group's template.
5. Add salary for a month. Amounts are explicit, non-negative INR values; deductions cannot exceed earnings. Saving does not transfer money. If auto-generation is enabled, the server renders and uploads the PDF immediately.
6. Payroll & CTC > Person ledger shows generated payslips. Failed uploads can be retried. Download or copy a private link that expires after five minutes.

Template changes create a new version. Each salary revision stores its own employee, salary and template snapshot; previously issued PDFs are immutable. Saving the same salary and template again reuses the existing record. A changed salary/template creates a new revision. Browser auto-download may be subject to the browser's normal download policy.

## Existing Cloudflare configuration

The Node server reads the database ID and R2 bucket from `wrangler.toml`. It uses D1's REST API and R2's S3 API; the Express server cannot directly consume Worker bindings. There is no claim that an object is uploaded until R2 confirms the PUT.

Configure server-only variables from `.env.example`:

- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`: token with access to the configured D1 database.
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: S3 credentials scoped to the configured bucket with object read/write access.
- Optional `CLOUDFLARE_D1_DATABASE_ID`, `R2_BUCKET_NAME` override `wrangler.toml`.
- `PAYROLL_AUTH_VERIFY_URL`: your existing HTTPS authentication service's token-verification endpoint. The server forwards the bearer token. The endpoint must return `{ "success": true, "data": { "userid": "...", "type": "Super Admin" } }` only for a valid session. No browser-supplied role is trusted. Other verified users can only list/download their own payslips.

Do not use VITE-prefixed variables for these values. Keep the R2 bucket private. No public download URL is stored. The server signs fresh five-minute download links after an access check.

`PAYROLL_LOCAL_DEV=true` explicitly permits loopback-only development with a local admin identity, matching localhost Host/Origin, and no production access. This checkout enables that opt-in in ignored `.env`. Restart the server after configuration changes. Without cloud credentials, templates/assignments/salary snapshots persist in `data/payroll.sqlite`; R2-dependent generation reports a retryable failure. Local records are not automatically migrated to D1. Production refuses this local database fallback and requires verified authentication.

The database creates its namespaced tables and index on first authenticated use. Back up local SQLite data before moving to D1. Requires Node 24 or later. The existing `wrangler.toml` points at an Express server; this change is a Node-server integration, not a deployed Cloudflare Worker.

## Implementation and checks

- `server/payrollRoutes.mjs`: authorization, templates, groups, assignments, immutable salary records, PDF generation, private R2 upload/download.
- `server/payrollDatabase.mjs`: SQLite development storage and D1 REST adapter.
- `src/lib/payslipDocument.js`: one renderer for browser preview and server generation; uses standard PDF Latin fonts and INR labels.
- `src/components/payroll/PayslipStudio.jsx`: editor and group/salary workflow.
- `src/components/payroll/PayslipRecords.jsx`: per-person issued history, retry and download links.

Run `npm run test:payroll`, `npm run check:payslip-pdfs`, `npm run lint`, and `npm run build`.

PDF test samples use clearly labelled fictional QA values only and are written to ignored `tmp/pdfs/`. The samples are not seeded into the application database. The PDF check renders all three designs for visual inspection. Backend tests use an isolated in-memory database and fake R2 storage; they do not write to the live cloud services.

Reference: https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/ and https://developers.cloudflare.com/r2/examples/aws/aws4fetch/
