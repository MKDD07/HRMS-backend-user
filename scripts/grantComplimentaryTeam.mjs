import dotenv from 'dotenv';
import { createD1RestDatabase } from '../server/d1RestDatabase.mjs';
import { existingCloudflareConfig } from '../server/payrollDatabase.mjs';
import { grantComplimentaryPlan } from '../worker/billingGrant.mjs';

dotenv.config({ quiet: true });
dotenv.config({ path: '.env.groq', quiet: true });
if (!process.argv.includes('--apply')) throw new Error('Use --apply only with explicit company-owner authorization.');
const db = createD1RestDatabase({ account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN, databaseId: existingCloudflareConfig().databaseId });
const companyId = '958d5903-c86b-45e3-8c95-4162a1b9d4dd';
const company = await db.prepare('SELECT name FROM companies WHERE company_id=?').bind(companyId).first();
if (company?.name !== 'AsterNova Technologies') throw new Error('Company identity mismatch.');
const result = await grantComplimentaryPlan(db, { companyId, planId: 'team', authorizedBy: 'workspace-owner', reason: 'Company owner explicitly requested complimentary Team activation; no payment made.' });
console.log(JSON.stringify({ company: company.name, ...result }));
