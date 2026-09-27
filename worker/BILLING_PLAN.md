# Company pricing and Razorpay test checkout

Settings now includes Super Admin-only Plan & Subscription cards. D1 stores Starter at INR 1,999 (10 employees / 2 additional dashboard users), Team at INR 3,999 (50 / 5), Business at INR 5,999 (200 / 10), and Enterprise as custom. Prices include GST for this test flow. All plans include existing dashboard modules; only capacity differs. Existing module limitations still apply.

## Payment behavior

A selected plan creates a company-owned purchase UUID and server-priced Razorpay order. Checkout signature verification uses the saved order ID, then fetches the authoritative payment and checks captured status, amount, currency and refund state. A D1 transaction activates the subscription and records its audit entry exactly once. Signed payment.captured and order.paid webhooks recover purchases if the browser closes. Check payment provides authenticated reconciliation.

Monthly terms use calendar months with month-end clamping. Same-plan renewal adds a month to the active expiry. A plan change starts a new month immediately without credit or proration; the confirmation dialog discloses this. Payments are manual per term: no automatic debit or recurring mandate. Enterprise requires a custom quote.

Only Razorpay test keys work. Live payment creation is disabled. Test subscriptions never change actual company capacity. Existing companies retain their legacy allowance of three dashboard users. The Super Admin is excluded from counts. Any employee not marked Inactive counts toward employee capacity; all dashboard grants count toward dashboard-user capacity.

Migration 0007_billing.sql is applied to remote D1 and recorded in migration history. It adds plans, orders, subscriptions, webhook events and audit tables, and subscription-aware capacity triggers. Future live subscription expiry blocks additions/reactivation/new grants while retaining existing records. No actual subscriptions were created by migration.

## Configure test checkout

Add these to ignored .env and restart the local server:

```
BILLING_MODE=test
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_secret
RAZORPAY_WEBHOOK_SECRET=your_separate_webhook_secret
```

For Cloudflare, keep BILLING_MODE=test and store credentials using Wrangler secrets. Never use VITE_ variables for secrets. Only the key ID is returned to Checkout.

Deploy the Worker and configure this public HTTPS webhook in Razorpay test mode:

```
https://YOUR-WORKER-HOST/api/v1/billing/webhook
```

Subscribe to payment.captured and order.paid with the same webhook secret. Enable automatic payment capture in Razorpay. Local gateway endpoint: /api/company-auth/billing/webhook. It preserves raw JSON bytes before parsing and forwards the signature/event headers. Razorpay cannot deliver directly to localhost. The public Worker and local gateway should use the same test credentials and D1 database.

For a separately hosted frontend, point VITE_COMPANY_API_URL at the Worker's /api/v1 base and add the frontend origin to ALLOWED_ORIGINS. Existing Express-only modules are not automatically migrated by this billing feature.

## APIs

All except the signed webhook require a company Super Admin session:

- GET /api/v1/billing/overview: catalogue, capacity, usage, test subscription, recent purchases and configuration readiness.
- POST /api/v1/billing/orders: plan_id; creates or resumes a pending purchase.
- POST /api/v1/billing/verify: purchase_id, razorpay_order_id, razorpay_payment_id, razorpay_signature.
- POST /api/v1/billing/reconcile: purchase_id; fetch payment state.
- POST /api/v1/billing/webhook: raw JSON plus Razorpay HMAC signature.

One unfinished order is permitted per company/mode. Resume the same order instead of paying twice. Changing plans while an order is pending, rotating keys mid-purchase, or resolving an order stuck in creating after interruption requires support reconciliation. Never clear a pending record without checking the provider first.

## Verification and limitations

Run node --test worker/billing.test.mjs, node worker/worker.test.mjs, npm run lint, and npm run build.

Tests use isolated SQLite and mocked Razorpay responses. They cover server-owned prices, company isolation, signatures, amount/currency matching, uncaptured/refunded payments, duplicate callbacks, renewal, webhook recovery, plan limits and calendar-month terms. Actual sandbox checkout and webhook delivery require configured credentials and a public deployment; those are not verified yet.

Production keys are rejected. Recurring billing, invoices, refund/dispute automation and production activation are not included in this test release. Existing browser-local geofence rules and Super Admin-only legacy payslip studio restrictions remain.
