# Internal company mail

Mail now runs inside HRMS. Every active signed-in user has a private inbox automatically, including the Super Admin. No SMTP/IMAP account, domain, provider, password, or MAIL_ENCRYPTION_KEY is needed for internal mail. External delivery is disabled.

## Storage and deployment

Messages, per-user folder/read/star state, and attachment chunks are stored in the company D1 database. The Node development server exposes /api/mail; production uses /api/v1/mail in the company Worker. Authentication uses the existing company sessions. The tables are initialized idempotently on first access; migrations/hrms/0021_internal_mail.sql also records the schema for managed migrations. Deploy the updated company Worker for production. Company and user IDs always come from verified authentication.

## Features

- Automatic private inbox, Sent, Drafts, Archive, and Trash for every active company account.
- Company address book; recipients may be selected by username or entered using an existing company user's email. External addresses and inactive users are rejected.
- Reply, forward, text messages, Cc/Bcc, subject/body/sender search, 30-message pagination, message previews, attachments, stars, and read state.
- Independent folder copies: moving one user's message never changes someone else's inbox. Administrators cannot read other users' mail through the mail endpoints.
- Bcc recipients receive their own copy without exposing their identity to other recipients.
- Up to 50 recipients and 10 attachments, totaling 2 MB. Attachments are stored in small database chunks and downloaded only after checking mailbox ownership.
- Sending is transactional and uses a durable unique company/sender/request ID to prevent duplicate delivery, including concurrent retries.
- Drafts are private and do not deliver mail. Editing a draft creates a copy; it preserves the original and does not automatically copy attachments.
- The UI uses one shared card, folder navigation, a full-width list/reading view, bulk actions, and separate navigation/list/reader skeletons. Message rows remain flat on hover.

## Verification

Run npm run test:mail for internal delivery, automatic inboxes, company/user isolation, recipient validation, Bcc privacy, attachment access, independent folders, draft privacy, search, and idempotency. Run npm run build for the production bundle.

The earlier external SMTP/IMAP implementation remains dormant in server/mailService.mjs and server/mailRoutes.mjs; the application no longer mounts it. It can be reintroduced separately when external delivery is required. Existing encrypted credentials, if any, are not deleted.
