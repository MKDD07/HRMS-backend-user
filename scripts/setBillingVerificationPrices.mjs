import dotenv from 'dotenv';
import { createD1RestDatabase } from '../server/d1RestDatabase.mjs';
import { existingCloudflareConfig } from '../server/payrollDatabase.mjs';

dotenv.config({ quiet: true });
dotenv.config({ path: '.env.groq', quiet: true });
const db = createD1RestDatabase({ account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN, databaseId: existingCloudflareConfig().databaseId });
const original = { starter: 199900, team: 399900, business: 599900 };
const restore = process.argv.includes('--restore');
if (!process.argv.includes('--apply')) throw new Error('Use --apply to set INR 1 prices, or --restore --apply to restore the catalogue.');
const before = (await db.prepare("SELECT id,amount,currency FROM billing_plans WHERE id IN ('starter','team','business')").all()).results;
if (before.length !== 3 || before.some(plan => plan.currency !== 'INR' || ![100,original[plan.id]].includes(plan.amount))) throw new Error('Unexpected catalogue prices; no changes applied.');
await db.batch(Object.entries(original).map(([id, amount]) => db.prepare('UPDATE billing_plans SET amount=? WHERE id=? AND currency=? AND amount=?').bind(restore ? amount : 100,id,'INR',restore ? 100 : amount)));
const plans = (await db.prepare('SELECT id,name,amount,currency FROM billing_plans ORDER BY sort_order').all()).results;
if (plans.some(plan => original[plan.id] && plan.amount !== (restore ? original[plan.id] : 100))) throw new Error('Price verification failed.');
console.log(JSON.stringify({ scope: 'shared production catalogue', plans, restored: restore }, null, 2));
