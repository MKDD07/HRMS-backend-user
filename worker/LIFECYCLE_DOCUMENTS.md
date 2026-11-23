# Employee lifecycle documents

Onboarding and Offboarding show employee cards with photos, role, department, joining/exit date, probation date, checklist progress, and pending/sent paper counts. Search or filter active/all plans. Opening a card shows a right-side employee document panel. Plans and checklists are edited from that panel. Counts use real plans and provider-accepted sends; no example employees are created.

The Template library includes the six supplied appointment, confidentiality, joining, document-request, scope-of-work, and policy letters, plus probation and exit letters. Their tables and clauses remain editable. The document's **Start from** selector offers premade letters, a blank custom document, and published company templates. Premade letters expose labeled inputs above the editor; field values update all occurrences in the letter, without requiring template syntax. Custom documents have a free-form editor and optional HTML source. **Save as template** publishes a named copy into the company library. Named employee/date/reference fields are cleared in that copy; directly typed text is retained and should be reviewed for reuse.

Create an onboarding or exit plan to generate the corresponding document drafts. Generation runs when the document workspace loads or is refreshed, and in the Worker's existing hourly scheduled handler. Production automation requires deploying the updated Worker with the existing `wrangler.toml` cron trigger. Local development generates drafts when the page is opened; it does not run the Cloudflare scheduler.

Probation uses the plan's explicit end-date override first, then the employee profile's end date, then joining date plus an explicitly recorded `probation_months`. Month-end dates clamp to the last day of the resulting month. No duration is assumed. The review draft is created within 14 calendar days of the end date, including overdue reviews. Generation uses UTC calendar dates. Confirmation and extension letters are created manually after HR decides the outcome. An updated end date creates a new review draft; existing documents remain unchanged.

The reusable template editor and employee draft editor use Tiptap. Header, body, and footer support fonts, sizes, text/highlight color, alignment, formatted paragraphs, headings, lists, links, uploaded images, tables (including row/column and merge/split tools), code blocks, page breaks, undo, and redo. HTML import strips unsupported elements; remote images are not imported. Published templates apply to future generated drafts; they never replace saved employee edits. Complete every required letter field before finalization. Finalized documents are immutable; New version creates an editable copy. Draft printouts and Word exports are marked DRAFT. Closing the editor or switching templates prompts before discarding changes; browser reload/close warns when changes are unsaved.

**Letter settings** stores a company-wide name, address, authorized signatory, designation, logo, and signature in the existing `talent_records` table. The settings are shared across onboarding and offboarding and use optimistic revisions. PNG/JPEG uploads are normalized to small embedded PNGs; logo and signature widths are limited to 140px on both client and server. New drafts and opened editable drafts apply current letterhead settings. Finalized papers retain their saved branding snapshot. Logo and signature are included in preview, printing, and Word headers/footers. Email images are embedded as CID attachments. Settings and document content are excluded from general Reports and require lifecycle-page permission.

Print opens a separate document preview and calls the browser's print dialog, where the user selects the printer or Save as PDF. Allow pop-ups for the application. Word export uses the `docx` library. Email sends the finalized document as formatted email content, not as a PDF attachment. Employee submission requests are editable letters; secure employee upload links and electronic signatures are not part of this implementation.

## Email setup

Configure server-only `RESEND_API_KEY` and `DOCUMENT_EMAIL_FROM` (a verified Resend sender). Local development reads these from the server environment; production uses Worker secrets/configuration. Never prefix these values with `VITE_`. Restart the local server after changing its environment.

The Send email button uses the employee's currently recorded email, company-scoped server lookups, and the saved finalized document. It does not use `mailto:`. Provider acceptance records the recipient, timestamp, and provider message ID. It does not claim inbox delivery; delivery/bounce webhooks are not implemented. Retries use a stable provider idempotency key, and successfully recorded sends cannot be resent. Resend's idempotency retention is finite: if the provider accepts a message but the database write fails, resolve the delivery in Resend before retrying after that retention window.

Records use the existing company-scoped `talent_records` table with optimistic revisions. No new migration is required when migration 0009 is already installed. Delegated dashboard users need the corresponding Onboarding or Offboarding page permission.

## Checks

`npm run test:lifecycle` covers probation boundary dates, repeat automation, company isolation, escaping, placeholder validation, final document immutability, and mocked email delivery/retries. `node worker/talent.test.mjs` and `node worker/worker.test.mjs` cover the existing APIs.

Library references: [Tiptap React](https://tiptap.dev/docs/editor/getting-started/install/react), [docx Packer](https://docx.js.org/api/classes/Packer.html), [Resend idempotency](https://resend.com/blog/engineering-idempotency-keys).
