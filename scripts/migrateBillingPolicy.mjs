import dotenv from 'dotenv';
import {readFileSync} from 'node:fs';
import {createD1RestDatabase} from '../server/d1RestDatabase.mjs';
import {existingCloudflareConfig} from '../server/payrollDatabase.mjs';
dotenv.config({quiet:true});dotenv.config({path:'.env.groq',quiet:true});
if(!process.argv.includes('--apply'))throw new Error('Use --apply to apply the workspace plan policy migration.');
const db=createD1RestDatabase({account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,databaseId:existingCloudflareConfig().databaseId});
const name='0020_billing_workspace_policy.sql';
const done=await db.prepare('SELECT name FROM d1_migrations WHERE name=?').bind(name).first();
if(done){console.log('Workspace plan policy already applied.');process.exit(0);}
const sql=readFileSync(new URL('../migrations/hrms/'+name,import.meta.url),'utf8');
const statements=sql.split(/;\s*(?:\r?\n|$)/).map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s));
statements.push(db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind(name));
await db.batch(statements);console.log('Workspace plan policy applied. Paid subscriptions and employee records preserved.');
