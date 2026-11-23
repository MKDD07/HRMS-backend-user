import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { createD1RestDatabase } from '../server/d1RestDatabase.mjs';
import { existingCloudflareConfig } from '../server/payrollDatabase.mjs';
dotenv.config({quiet:true});dotenv.config({path:'.env.groq',quiet:true});
const db=createD1RestDatabase({account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,databaseId:existingCloudflareConfig().databaseId});
const name='0018_billing_recurring.sql';
const history=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'").first();
const existing=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('billing_recurring','billing_recurring_events')").all()).results;
if(existing.length && existing.length!==2)throw new Error('Partial migration exists; inspect before continuing.');
const statements=[];
if(!existing.length){
  const sql=readFileSync(new URL('../migrations/hrms/'+name,import.meta.url),'utf8');
  for(const query of sql.split(';').map(s=>s.trim()).filter(Boolean))statements.push(db.prepare(query));
}
if(history)statements.push(db.prepare('INSERT INTO d1_migrations(name) SELECT ? WHERE NOT EXISTS(SELECT 1 FROM d1_migrations WHERE name=?)').bind(name,name));
const guards=(await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('billing_manual_renewal_guard','billing_recurring_purchase_guard')").all()).results;
if(guards.length && guards.length!==2)throw new Error('Partial renewal guards exist; inspect before continuing.');
if(!guards.length){
  const sql=readFileSync(new URL('../migrations/hrms/0019_billing_renewal_guards.sql',import.meta.url),'utf8');
  // Trigger bodies contain semicolons; split only at the end of each complete trigger.
  for(const query of sql.split(/END;/).map(s=>s.trim()).filter(Boolean))statements.push(db.prepare(query+'END;'));
}
if(history)statements.push(db.prepare('INSERT INTO d1_migrations(name) SELECT ? WHERE NOT EXISTS(SELECT 1 FROM d1_migrations WHERE name=?)').bind('0019_billing_renewal_guards.sql','0019_billing_renewal_guards.sql'));
if(!process.argv.includes('--apply'))throw new Error('Use --apply to add recurring billing tables to the configured database.');
if(statements.length)await db.batch(statements);
console.log(JSON.stringify({migrations:[name,'0019_billing_renewal_guards.sql'],applied:true,existingDataPreserved:true}));
