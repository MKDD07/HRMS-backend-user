import express from 'express';
import { createHash } from 'node:crypto';
import { dashboardAuthorization } from './dashboardAuthorization.mjs';
import { createAccountStore, createMailService, validateAccount, validateMessage, publicAccount, fail } from './mailService.mjs';

export function createMailRouter({ authorize=dashboardAuthorization, store=createAccountStore(), service=createMailService } = {}) {
  const router=express.Router(), sends=new Map(), rates=new Map(), active=new Map();
  router.use(express.json({limit:'16mb'}));
  router.use(async(req,res,next)=>{
    res.set('Cache-Control','no-store');
    try {
      const actor=await authorize(req);
      if(!actor?.company_id)return res.status(401).json({success:false,message:'Sign in to access Mail.'});
      if(actor.plan_pages && !actor.plan_pages.includes('mail'))fail('Mail is not available in your plan.',403);
      if(!actor.admin && actor.role!=='company_admin' && !(actor.dashboard_access && actor.dashboard_pages?.includes('mail')))fail('Mail access is not assigned to this account.',403);
      req.mailActor=actor;next();
    }catch(error){next(error);}
  });
  const run=fn=>async(req,res,next)=>{
    const key=req.mailActor.company_id;
    if((active.get(key)||0)>=4)return res.status(429).json({success:false,message:'Mailbox is busy. Try again shortly.'});
    active.set(key,(active.get(key)||0)+1);
    try {await fn(req,res);}catch(error){next(error);}finally{active.set(key,active.get(key)-1);}
  };
  const ok=(res,data)=>res.json({success:true,data});
  async function account(req){return await store.get(req.mailActor.company_id)||fail('Connect a company mailbox first.',409);}
  router.get('/account',run(async(req,res)=>{
    const value=await store.get(req.mailActor.company_id), canConfigure=Boolean(req.mailActor.admin||req.mailActor.role==='company_admin');
    ok(res,{account:canConfigure?publicAccount(value):value?{email:value.email,name:value.name}:null,canConfigure,canSave:store.writable});
  }));
  router.post('/account',run(async(req,res)=>{
    if(!req.mailActor.admin && req.mailActor.role!=='company_admin')fail('Only company administrators can configure Mail.',403);
    const value=validateAccount(req.body,await store.get(req.mailActor.company_id)||{});
    await service(value).verify();
    await store.save(req.mailActor.company_id,value);
    ok(res,{account:publicAccount(value),connected:true});
  }));
  router.post('/verify',run(async(req,res)=>ok(res,await service(await account(req)).verify())));
  router.get('/folders',run(async(req,res)=>ok(res,await service(await account(req)).folders())));
  router.get('/messages',run(async(req,res)=>ok(res,await service(await account(req)).list(req.query))));
  router.get('/message',run(async(req,res)=>ok(res,await service(await account(req)).read(req.query))));
  router.post('/action',run(async(req,res)=>ok(res,{updated:await service(await account(req)).action(req.body)})));
  router.get('/attachment',run(async(req,res)=>{
    const item=await service(await account(req)).attachment(req.query);
    const name=(item.filename||'attachment').replace(/[\r\n"\\/]/g,'_');
    res.set('Content-Type','application/octet-stream');res.set('X-Content-Type-Options','nosniff');res.attachment(name).send(item.content);
  }));
  router.post('/draft',run(async(req,res)=>ok(res,await service(await account(req)).compose(req.body,true))));
  router.post('/send',run(async(req,res)=>{
    const company=req.mailActor.company_id, id=req.headers['idempotency-key'];
    if(typeof id!=='string'||! /^[\w-]{16,80}$/.test(id))fail('A valid send identifier is required.');
    const connection=await account(req);
    validateMessage(req.body,connection);
    const key=company+':'+id, hash=createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
    const now=Date.now();
    for(const [k,v] of sends)if(v.expires<now)sends.delete(k);
    const existing=sends.get(key);
    if(existing){if(existing.hash!==hash)fail('This send identifier belongs to another message.',409);return ok(res,await existing.promise);}
    const recent=(rates.get(company)||[]).filter(t=>t>now-60000);
    if(recent.length>=20)fail('Send limit reached. Wait a minute before sending again.',429);
    rates.set(company,[...recent,now]);
    const promise=service(connection).compose(req.body);
    // Keep failed attempts too: an SMTP timeout can leave acceptance uncertain.
    sends.set(key,{hash,promise,expires:now+24*3600000});
    ok(res,await promise);
  }));
  router.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    const status=error.status||502;
    const message=error.type==='entity.too.large'?'Attachments must total 10 MB or less.':error.status?error.message:'Mail server operation failed. Check connection settings. If sending timed out, check Sent or your mail provider before sending again.';
    res.status(status).json({success:false,message});
  });
  return router;
}
