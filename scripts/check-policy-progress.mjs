import dotenv from 'dotenv';dotenv.config({quiet:true});
import {createD1RestDatabase} from '../server/d1RestDatabase.mjs';
const db=createD1RestDatabase({account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,databaseId:'4fe0e2c8-e4f0-4433-8351-6dbf73359cd7'});
const r=await db.prepare("SELECT json_extract(payload,'$.id') AS job,json_extract(payload,'$.runState') AS state,json_extract(payload,'$.items') AS items FROM talent_records WHERE collection='company_policy_job'").bind().all();
for(const j of r.results)console.log(JSON.stringify({job:j.job,state:j.state,items:JSON.parse(j.items).map(i=>({id:i.id,sections:i.sections.length,savedId:i.savedId}))}));
console.log(JSON.stringify((await db.prepare("SELECT json_extract(metadata,'$.generation_job') AS job,json_extract(metadata,'$.generation_item') AS item,document_id FROM documents WHERE json_extract(metadata,'$.generation_job') IS NOT NULL").bind().all()).results));
