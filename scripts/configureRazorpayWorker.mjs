import dotenv from 'dotenv';

dotenv.config({ quiet: true });
dotenv.config({ path: '.env.groq', quiet: true });
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error('Cloudflare credentials are missing.');
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/hrms-api/secrets`;
async function request(options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(`Worker secret configuration failed (${response.status}).`);
  return body.result;
}
const existing = new Set((await request()).map(secret => secret.name));
const names = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'];
const missing = names.filter(name => !existing.has(name));
if (names.some(name => !process.env[name])) throw new Error('Local billing credentials are incomplete.');
if (!process.env.RAZORPAY_KEY_ID.startsWith('rzp_live_')) throw new Error('A live key is required.');
if (process.argv.includes('--apply')) {
  for (const name of missing) await request({ method: 'PUT', body: JSON.stringify({ name, text: process.env[name], type: 'secret_text' }) });
}
console.log(JSON.stringify({ worker: 'hrms-api', missing, added: process.argv.includes('--apply') ? missing : [], existingSecretsPreserved: true }));
