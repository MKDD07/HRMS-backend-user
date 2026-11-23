# Company policy review

The policy workspace has Approved library, Human drafts and AI drafts tabs. New company-policy uploads enter drafts. Human uploads explicitly record their origin; Aster uploads record AI origin. Older AI drafts are recognized from their metadata. Existing published policies without review metadata remain available.

Approval uses `POST /api/v1/documents/:id/approve` and requires company-admin privileges (or the existing request-scoped elevation for delegated Document Vault users). It sets `draft=false`, `review_status=approved`, `approved_by` and `approved_at` in document metadata. Editing an approved policy resets its approval and returns it to drafts. Employee personnel verification is a separate workflow.

Unprivileged employee reads exclude unpublished policy drafts, including direct download requests. All lookups and writes use the authenticated company ID. Delete uses the existing archive operation, removing records from the visible vault while retaining the original object and deletion metadata.

Review state uses the existing metadata JSON column; no D1 schema migration is required.

Validation: `node --test shared/documentReview.test.mjs worker/documents.review.test.mjs`.
