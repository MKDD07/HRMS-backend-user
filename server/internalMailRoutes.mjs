import express from 'express';
import { dashboardAuthorization } from './dashboardAuthorization.mjs';
import { createD1RestDatabase } from './d1RestDatabase.mjs';
import { existingCloudflareConfig } from './payrollDatabase.mjs';
import { internalMailHandle } from '../worker/internalMail.mjs';
export function createMailRouter({authorize=dashboardAuthorization,database,env=process.env}={}){
  const router=express.Router();let db=database;
  router.use(express.json({limit:'4mb'}));
  router.use(async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{
      const actor=await authorize(req);
      if(!actor?.company_id)return res.status(401).json({success:false,message:'Sign in to access Mail.'});
      if(actor.plan_pages&&!actor.plan_pages.includes('mail'))throw Object.assign(Error('Mail is not available in your plan.'),{status:403});
      if(!actor.admin&&actor.role!=='company_admin'&&actor.role!=='employee'&&!(actor.dashboard_access&&actor.dashboard_pages?.includes('mail')))throw Object.assign(Error('Mail access is not assigned.'),{status:403});
      if(!db){const databaseId=existingCloudflareConfig(env).databaseId;if(!env.CLOUDFLARE_ACCOUNT_ID||!env.CLOUDFLARE_API_TOKEN||!databaseId)throw Object.assign(Error('Configure the company database to use internal mail.'),{status:503});db=createD1RestDatabase({account:env.CLOUDFLARE_ACCOUNT_ID,token:env.CLOUDFLARE_API_TOKEN,databaseId});}
      const data=await internalMailHandle({db,actor,path:'/api/mail'+req.path,method:req.method,body:req.body,url:new URL(req.originalUrl,'http://localhost'),requestId:req.headers['idempotency-key']});
      if(data.download){res.set('X-Content-Type-Options','nosniff');return res.attachment(data.filename).send(Buffer.from(data.content,'base64'));}
      res.json({success:true,data});
    }catch(error){res.status(error.status||500).json({success:false,message:error.status?error.message:'Internal mail is unavailable. Try again.'});}
  });
  return router;
}
