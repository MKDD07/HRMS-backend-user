# Calendar cloud setup

Applied and verified in Cloudflare on 2026-09-26:

- Created `company_calendar` and `company_calendar_assignments` in the configured D1 database.
- Verified both table definitions and the assignment-to-calendar foreign key.
- Created the previously absent `hrms-documents-vault` R2 bucket.
- Uploaded and read back the zero-byte `companies/.keep` folder marker.
- Existing production tables and objects were not changed; no local development data was uploaded.
- Evidence is saved in ignored `data/cloudflare-audit/`.

Target configured in `wrangler.toml`:
- D1: `hrms-d1-production` (`05b74cd6-9516-4b8c-ac3a-d0d99d09029f`).
- R2: `hrms-documents-vault`.

`migrations/0001_company_calendar.sql` creates `company_calendar` and
`company_calendar_assignments` using the same schema as the local backend.
Before applying it, inspect any existing tables of those names and their schema.
`IF NOT EXISTS` does not update an incompatible existing table.
Do not upload the local-development company's records into production.

Keep calendar arrays in D1. Files associated with a company should use R2 keys:

```
companies/<company_id>/calendar/<file_id>/<filename>
companies/<company_id>/documents/<document_id>/<filename>
companies/<company_id>/employees/<user_id>/documents/<document_id>/<filename>
```

Use actual backend-generated company and user IDs, never literal placeholder names.
R2 uses object key prefixes rather than real directories. If an empty folder must
be visible before files are uploaded, create a zero-byte `.keep` object under the
company's prefix. A top-level `companies/.keep` can establish the root without
inventing a production company. Do not store a second copy of the calendar arrays
in R2 or change bucket visibility.

Access is configured through `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` in ignored `.env` with D1 edit and R2 object-write access.
Never commit tokens or paste them into chat. The Cloudflare REST object upload API
can use a bearer API token; S3 access keys are not required for that API.

References:
- https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
- https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/upload/

Creating cloud tables alone does not deploy the Express calendar routes to a Worker.
Worker integration, company master-table foreign keys and production tenant mapping
still require the actual Worker source and production ownership mapping. The live
schema was inspected and saved locally; the existing users table has no company_id.
Do not infer that the existing Worker now enforces company separation.
