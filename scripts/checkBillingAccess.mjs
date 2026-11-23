import dotenv from 'dotenv';
import { createD1RestDatabase } from '../server/d1RestDatabase.mjs';
import { existingCloudflareConfig } from '../server/payrollDatabase.mjs';
import { billingUsage } from '../worker/billing.mjs';
dotenv.config({quiet:true});dotenv.config({path:'.env.groq',quiet:true});
const db=createD1RestDatabase({account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,databaseId:existingCloudflareConfig().databaseId});
const company='958d5903-c86b-45e3-8c95-4162a1b9d4dd';
console.log(JSON.stringify(await billingUsage(db,company)));
try { const results=await db.batch([db.prepare('SELECT 1 AS value'),db.prepare('SELECT 2 AS value')]);console.log(JSON.stringify({batchSupported:true,resultCount:results.length})); } catch { console.log(JSON.stringify({batchSupported:false})); }

const subscription=await db.prepare("SELECT plan_id,mode,employee_limit,dashboard_limit,ends_at FROM company_subscriptions WHERE company_id=? AND mode='live'").bind(company).first();
console.log(JSON.stringify({subscription}));
