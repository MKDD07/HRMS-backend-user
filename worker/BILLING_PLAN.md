# Company plans and billing

Settings uses shared cards, a purple billing action, plan accents and a database-backed active-plan badge. Production subscriptions determine company capacity. Sandbox subscriptions remain isolated.

## Live configuration

BILLING_MODE defaults to live. Set RAZORPAY_KEY_ID to a live key and configure RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET as server secrets. Matching mode/key prefixes and both secrets are required; checkout fails closed otherwise. Never use VITE_ variables for secrets. Existing deployments must be updated separately.

The public HTTPS /api/v1/billing/webhook endpoint must be configured in Razorpay for payment.captured and order.paid. Enable automatic capture. Verify actual webhook delivery before accepting customer payments. Local callback path: /api/company-auth/billing/webhook. Webhook bytes and signatures must remain intact.

## Payments and terms

Prices and limits come from billing_plans. Capture verification checks provider order, amount, currency, refund state and signatures before an atomic, idempotent activation. Signed webhooks and authenticated reconciliation recover browser-close purchases. Company ownership and Super Admin authorization are enforced.

Manual terms use calendar months with month-end clamping. Same-plan manual renewal opens only in the final seven days before expiry (or after expiry); changing plans begins a new term without proration. Automatic debit is available only after a separately authorized Razorpay subscription mandate. Enterprise requires a custom agreement. Pending purchases must be reconciled before switching plans or rotating payment keys.

## Complimentary grants

An operator may call grantComplimentaryPlan only with explicit owner authorization. It cannot replace an existing live subscription or pending purchase. It creates a one-month live subscription and a complimentary_subscription_granted audit record atomically. No provider order or payment is created. The order snapshot records activation_source=complimentary, amount_charged=0, the authorizer and reason. The legacy order amount column retains the catalogue value; it is not money collected. Public history reports zero for grants. Any future accounting export must use the snapshot source and amount_charged rather than treating activated orders as paid invoices.

scripts/grantComplimentaryTeam.mjs --apply is the approved, company-specific AsterNova activation command. Repeat execution cannot extend the grant. The owner approved one complimentary Team month on 15 November 2026.

## Validation and release limits

Run node --test worker/billing.test.mjs, node --test worker/worker.test.mjs, node src/pages/settings/PlanSummaryCard.test.mjs, and npm run build. Payment tests use mocked Razorpay responses and SQLite. They cover live and sandbox activation, key matching, company isolation, prices, signatures, mismatches, refund checks, duplicate callbacks, renewal, webhook recovery, capacity and complimentary grants.

A successful build does not verify real checkout, webhook delivery, deployment or tax compliance. Live mandate authentication and a captured recurring payment remain to be verified by the owner. Tax invoices, refund/dispute automation and accounting reconciliation are outside this implementation.

## Deployment verification — 15 November 2026

The configured live Razorpay credentials passed a read-only Orders API authentication check (HTTP 200). The three missing billing secrets were added to production Worker `hrms-api` with explicit owner approval; existing secrets were preserved.

Version `7c4c4203-2a90-4234-9054-b72588f2ed96` was deployed with BILLING_MODE=live, existing dashboard variables preserved, and sampled logs/traces enabled. The deployed webhook accepted a signed non-payment event and rejected an unsigned event with HTTP 403. These checks do not create orders or payments.

The Razorpay dashboard must still register `https://hrms-api.mkmkataria07.workers.dev/api/v1/billing/webhook` in Live mode using the same webhook secret and the payment.captured/order.paid events. Actual captured-payment activation and Razorpay-origin webhook delivery remain unverified. No payment was made during deployment. This deployment covers the API Worker, not the frontend.

Repeat read-only checks with `node scripts/checkRazorpay.mjs` and `node scripts/checkBillingDeployment.mjs`. Neither script prints secret values or payment records. The broader application still has existing type-check and recruitment integration-test failures; passing billing checks does not certify the whole application for release.

## Owner-requested INR 1 verification pricing

On 15 November 2026 the owner requested real INR 1 payments for each fixed-price plan. Starter, Team and Business now cost 100 paise in the shared production catalogue; Enterprise remains custom. These prices apply to all companies until restored. Capacity limits are unchanged, so a company above Starter's limits cannot purchase Starter.

Restore normal prices after verification with `node scripts/setBillingVerificationPrices.mjs --restore --apply`. Existing orders always retain their original amount and plan snapshot. Unpaid stale-price checkouts can be retired only after checking for provider payments; a late captured payment remains reconcilable and is not discarded. The checkout update is deployed as version `eb4a2e66-4345-4c89-ba3f-848ba248fbcf`. No payment is automatically submitted by these scripts.

## Payment details and receipts

`GET /api/v1/billing/purchases/:purchase_id` requires the company Super Admin and checks company ownership and billing mode. It returns original purchase pricing/capacity, company name, payment/order references, dates and term, plus an allowlisted live Razorpay payment view (method, bank/wallet, bank reference, payer contact and refund state). Secrets, raw provider payloads and card credentials are never returned. Provider failures retain the saved activation record and explicitly flag unavailable live/refund data.

Billing history provides Details and Download receipt actions beside status. The shared modal displays the complete available record; a PDF payment acknowledgement can be downloaded for verified paid purchases. Complimentary grants and unpaid purchases do not produce paid receipts. PDFs are acknowledgements rather than tax invoices. New activations snapshot the purchased term; older records use the linked current subscription term when available and otherwise show Not recorded rather than infer historical dates.

Run `node src/lib/billingReceipt.test.mjs` for PDF text/content verification alongside the billing tests. The existing INR 1 Business payment was checked against Razorpay: captured via UPI, bank reference available, and term recorded. These checks do not certify the modal's visual layout.

The receipt PDF uses `/api/company-auth/branding/default/logo` (with the equivalent configured API endpoint as fallback), as explicitly requested by the owner. Its concise layout includes the company, receipt reference/date, plan, paid amount, payment ID/method and validity. Detailed bank references, payer contact and full transaction metadata remain in the app's Details window. Refund information appears on the receipt only when a refund has been recorded. The rendered PDF was visually inspected with the saved default logo.

## Automatic renewal

The orange secure-billing banner is removed. The active-plan summary contains a shared switch that opens a consent dialog. Enabling it creates an immutable, server-priced monthly Razorpay Plan and a Subscription for 12 renewal charges, starting at the current paid expiry. The user must approve the mandate through Razorpay Checkout; the app never enables it with a local boolean. Existing INR 1 catalogue pricing also applies to a mandate created now, and remains fixed for its authorized cycles even if the public catalogue is later restored.

Unapproved checkout links expire within seven days or five minutes before the first renewal, whichever is earlier. Abandoned setup cannot be approved months later against an old first-charge date.

Migrations 0018 and 0019 add mandate/event tables and database guards against overlapping manual/recurring checkout. The four company-admin POST routes are recurring/create, recurring/verify, recurring/sync and recurring/cancel. Create requires explicit acceptance of the displayed server price. Verify uses HMAC-SHA256(payment_id + '|' + saved_subscription_id), then fetches the canonical subscription. Authentication alone never extends access.

Subscription webhooks fetch canonical provider state and paid invoices. Each matching, captured, unrefunded invoice creates one billing order, one audit record and a term update atomically. Invoice/payment IDs, subscription, price, currency, interval, quantity and billing dates are checked. Duplicate or older invoices cannot shorten or replace a newer paid term. Receipt downloads use the resulting ordinary billing history. Failed renewals do not extend access. The existing hourly cron reconciles ten mandates at a time, ordered by oldest sync, as webhook recovery.

Cancellation immediately stops the Razorpay subscription while retaining the current paid database term. It remains available even if the invoice API is temporarily unavailable. A charge already in flight may complete and be reconciled. Manual purchases and plan changes require cancelling the existing mandate first. The UI displays provider-confirmed setup, enabled, payment-attention and cancelled states; it offers manual Renew plan only during the final seven days before expiry.

An abandoned early same-plan checkout can be retired during setup only after Razorpay confirms that it has no successful/in-flight payment. Its original references remain intact. If a late capture arrives, the handler stops any newer mandate before applying that manual payment, preventing overlapping renewal schedules. Replays of already activated orders never cancel a subsequent mandate. Hourly recovery uses ctx.waitUntil independently of the other scheduled jobs. The billing suite includes 21 tests plus separate plan-action and receipt checks.

Plan actions identify upgrades and downgrades using catalogue tier order, independently of temporary price changes. A lower plan that cannot accommodate current employee/dashboard usage keeps its Downgrade label with a visible explanation and remains blocked server-side. Eligible changes may retire a verified-unpaid abandoned early renewal before starting a new checkout. Selecting a different plan never changes active capacity before captured payment. The shared security label uses the official SVG from `https://razorpay.com/assets/razorpay-logo.svg`, bundled as `src/assets/razorpay.svg`. The billing suite now includes 22 tests.

Enable Subscription events on the existing Live webhook, especially subscription.authenticated, subscription.activated, subscription.charged, subscription.pending, subscription.halted, subscription.cancelled and subscription.completed (all subscription events are supported). The owner must personally approve any live mandate; no mandate or recurring charge was created by the implementation checks. Tests use isolated SQLite and a mocked provider; the live Subscriptions list endpoint passed a read-only authentication check.


## Workspace plan policy (0020)

- Starter: people, departments, attendance, shifts, leave, calendar, documents, HR Connect and settings.
- Team adds hierarchy, payroll, salary structures, expenses, recruitment, onboarding/offboarding, assets and reports.
- Business/Enterprise include all existing dashboard modules; custom Enterprise purchases remain quote-only.
- Lowering an active paid tier is free, immediate, and retains the original expiry and paid receipts. Raising a tier requires captured payment. No unused-term refund or credit is issued by this flow.
- The review requires agreement to the displayed plan terms, followed by a second confirmation. Backend validates consent; plan prices and capacity remain server-owned.
- Company Super Admin can enable the top-right Test mode. It stores a separate company-wide plan override in billing_workspace_policy, applies real feature/seat restrictions, and never charges or overwrites company_subscriptions. Disabling restores the latest live paid plan. Existing provider renewal mandates remain unchanged.
- Seats are ordered by employee_code then employee_id, excluding Super Admin. Excess records remain saved and visible but unavailable; excess dashboard grants do not receive delegated access. Enforcement runs on authentication and company APIs as well as disabled directory/table rows and navigation.
- Free changes and test switches are audited in billing_plan_changes. Revision and mutation-token guards reject concurrent changes.
- Apply schema with node scripts/migrateBillingPolicy.mjs --apply before deploying this Worker.
