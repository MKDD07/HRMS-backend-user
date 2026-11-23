import dotenv from 'dotenv';

dotenv.config({ quiet: true });
dotenv.config({ path: '.env.groq', quiet: true });

// Read-only authentication check. Never print credentials or payment records.
const mode = process.env.BILLING_MODE || 'live';
const key = process.env.RAZORPAY_KEY_ID || '';
const secret = process.env.RAZORPAY_KEY_SECRET || '';
const report = {
  mode,
  matchingKeyPrefix: ['live', 'test'].includes(mode) && key.startsWith(`rzp_${mode}_`),
  secretPresent: Boolean(secret),
  webhookSecretPresent: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  authenticationVerified: false,
};
if (report.matchingKeyPrefix && secret) {
  try {
    const response = await fetch('https://api.razorpay.com/v1/orders?count=1', {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
      signal: AbortSignal.timeout(15000),
    });
    report.httpStatus = response.status;
    report.authenticationVerified = response.ok;
    await response.body?.cancel();
  } catch {
    report.error = 'Razorpay could not be reached.';
  }
}
console.log(JSON.stringify(report, null, 2));
if (!report.authenticationVerified) process.exitCode = 1;
