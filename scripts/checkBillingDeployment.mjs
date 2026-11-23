import dotenv from 'dotenv';
import { signature } from '../worker/billing.mjs';

dotenv.config({ quiet: true });
dotenv.config({ path: '.env.groq', quiet: true });
const base = 'https://hrms-api.mkmkataria07.workers.dev/api/v1';
const raw = JSON.stringify({ event: 'billing.connection_check' });
const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!secret) throw new Error('Webhook secret is missing.');
const signed = await fetch(`${base}/billing/webhook`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': await signature(secret, raw) },
  body: raw, signal: AbortSignal.timeout(15000),
});
const payload = await signed.json();
const unsigned = await fetch(`${base}/billing/webhook`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw, signal: AbortSignal.timeout(15000),
});
await unsigned.body?.cancel();
const settings = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/hrms-api/settings`, {
  headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(15000),
});
const metadata = await settings.json();
const mode = metadata.result?.bindings?.find(binding => binding.name === 'BILLING_MODE')?.text;
const report = { liveMode: mode === 'live', signedWebhookAccepted: signed.ok && payload.data?.ignored === true, unsignedWebhookRejected: unsigned.status === 403 };
console.log(JSON.stringify(report, null, 2));
if (!Object.values(report).every(Boolean)) process.exitCode = 1;
