import dotenv from 'dotenv';
import { createD1RestDatabase } from '../server/d1RestDatabase.mjs';
import { existingCloudflareConfig } from '../server/payrollDatabase.mjs';
dotenv.config({ quiet: true });
dotenv.config({ path: '.env.groq', quiet: true });
const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;
const { databaseId } = existingCloudflareConfig();
if (!account || !token || !databaseId) throw new Error('Company database credentials are not configured.');
const db = createD1RestDatabase({ account, token, databaseId });
for (const sql of ["SELECT company_id,name FROM companies", "SELECT company_id,mode,plan_id,starts_at,ends_at FROM company_subscriptions", "SELECT id,name,employee_limit,dashboard_limit FROM billing_plans WHERE enabled=1 ORDER BY sort_order"]) {
  const result = await db.prepare(sql).all();
  console.log(JSON.stringify(result.results));
}
