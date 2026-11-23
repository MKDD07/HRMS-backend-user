import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createAccountStore,createMailService,publicAccount,validateAccount,validateMessage } from './mailService.mjs';
import { createMailRouter } from './mailRoutes.mjs';

const account={email:'hr@example.com',name:'Company HR',smtp:{host:'smtp.example.com',port:587,user:'hr@example.com',pass:'smtp-secret'},imap:{host:'imap.example.com',port:993,user:'hr@example.com',pass:'imap-secret'}};
assert.equal(validateAccount(account).smtp.port,587);
assert.equal(validateAccount({...account,smtp:{...account.smtp,pass:''}},account).smtp.pass,'smtp-secret');
assert.throws(()=>validateAccount({...account,smtp:{...account.smtp,port:25}}),/Unsupported/);
assert.throws(()=>validateMessage({to:'victim@example.com\r\nBcc: other@example.com',subject:'Hi',text:'Test'},account),/Invalid/);
assert.throws(()=>validateMessage({to:'person@example.com',subject:'Hi\r\nBcc: test',text:'Test'},account),/valid subject/);
assert.throws(()=>validateMessage({to:'person@example.com',subject:'Hi',text:'Test',attachments:[{content:'file:///secret'}]},account),/Invalid attachment/);
assert.equal(JSON.stringify(publicAccount(account)).includes('smtp-secret'),false);
assert.equal(validateMessage({to:'person@example.com',subject:'Hi',text:'Test'},account).disableFileAccess,true);

const directory=await mkdtemp(path.join(os.tmpdir(),'hrms-mail-test-'));
try {
  const store=createAccountStore({MAIL_DATA_DIR:directory,MAIL_ENCRYPTION_KEY:'ab'.repeat(32)});
  await store.save('company-a',account);
  assert.deepEqual(await store.get('company-a'),account);
  assert.equal(await store.get('company-b'),null);
  const content=await readFile(path.join(directory,(await readdir(directory))[0]),'utf8');
  assert.equal(content.includes('smtp-secret'),false);
  await assert.rejects(()=>createAccountStore({MAIL_DATA_DIR:directory,MAIL_ENCRYPTION_KEY:'cd'.repeat(32)}).get('company-a'));
}finally{await rm(directory,{recursive:true,force:true});}

const calls=[];
class FakeImap {
  constructor(){this.mailbox={uidValidity:17};}
  on(){} async connect(){} async logout(){} close(){}
  async getMailboxLock(){return{release(){calls.push('release');}};}
  async list(){return[{path:'INBOX',name:'Inbox',flags:new Set()},{path:'Sent',name:'Sent',specialUse:'\\Sent',flags:new Set()}];}
  async search(){return[1,2];}
  async *fetch(){yield {uid:2,envelope:{subject:'Second',from:[{address:'other@example.com'}]},flags:new Set(['\\Seen']),size:80};}
  async fetchOne(uid,options){return{uid,size:100,source:options.source?Buffer.from('From: sender@example.com\r\nTo: hr@example.com\r\nSubject: Test\r\nContent-Type: text/plain\r\n\r\nHello'):undefined};}
  async append(folder,raw){calls.push({folder,raw:raw.toString()});}
  async mailboxCreate(folder){calls.push({created:folder});}
  async messageFlagsAdd(uid,flags){calls.push({uid,flags});return true;}
}
let sent=0;
const client=createMailService(account,{Client:FakeImap,transport:()=>({verify:async()=>true,close(){},sendMail:async message=>{sent++;assert.equal(message.from.address,account.email);return {accepted:message.to,messageId:'<sent@example.com>',rejected:[]};}})});
assert.equal((await client.list({})).uidValidity,'17');
assert.equal((await client.read({folder:'INBOX',uid:2,validity:'17'})).text.trim(),'Hello');
await assert.rejects(()=>client.read({folder:'INBOX',uid:2,validity:'18'}),/Mailbox changed/);
await assert.rejects(()=>client.action({folder:'INBOX',uid:2,action:'read',value:true}),/Refresh/);
await client.action({folder:'INBOX',uid:2,validity:'17',action:'read',value:true});
assert.equal((await client.compose({to:'person@example.com',subject:'Hi',text:'Body',bcc:'private@example.com'})).accepted,true);
assert.ok(calls.find(c=>c.folder==='Sent'&&!/Bcc:/i.test(c.raw)));
assert.equal((await client.compose({to:'person@example.com',subject:'Draft',text:'Body'},true)).draft,true);
assert.equal(sent,1,'Saving drafts must never send SMTP mail');
class OversizedImap extends FakeImap {
  async fetchOne(uid,options){assert.equal(options.source,undefined,'Oversized mail must be rejected before fetching the body');return {size:16*1024*1024};}
}
await assert.rejects(()=>createMailService(account,{Client:OversizedImap}).read({folder:'INBOX',uid:2,validity:'17'}),/15 MB/);
class SentFailureImap extends FakeImap {async append(){throw Error('Append failed');}}
let acceptedWithFailedCopy=0;
const sentFailure=createMailService(account,{Client:SentFailureImap,transport:()=>({close(){},sendMail:async()=>{acceptedWithFailedCopy++;return{accepted:['person@example.com'],messageId:'<accepted@example.com>'};}})});
const accepted=await sentFailure.compose({to:'person@example.com',subject:'Hi',text:'Body'});
assert.equal(accepted.accepted,true);
assert.match(accepted.warning,/Do not resend/);
assert.equal(acceptedWithFailedCopy,1);

const accounts=new Map([['a',account],['b',{...account,email:'other@example.com'}]]);
let operations=0;
const app=express();
app.use('/api/mail',createMailRouter({
  authorize:async req=>req.headers.authorization==='Bearer a'?{company_id:'a',admin:true}:req.headers.authorization==='Bearer b'?{company_id:'b',dashboard_access:true,dashboard_pages:['mail']}:req.headers.authorization==='Bearer denied'?{company_id:'a',dashboard_access:true,dashboard_pages:[]}:null,
  store:{writable:true,get:async id=>accounts.get(id)||null,save:async(id,value)=>accounts.set(id,value)},
  service:value=>({folders:async()=>[{name:value.email}],verify:async()=>({connected:true}),compose:async()=>{operations++;return{accepted:true};}})
}));
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
try {
  const root=`http://127.0.0.1:${server.address().port}/api/mail`;
  const call=(route,token,body,headers={})=>fetch(root+route,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await call('/account','invalid')).status,401);
  assert.equal((await call('/account','denied')).status,403);
  assert.equal((await call('/account','b',account)).status,403);
  assert.equal((await (await call('/folders','b')).json()).data[0].name,'other@example.com');
  const config=await (await call('/account','a')).json();
  assert.equal(JSON.stringify(config).includes('smtp-secret'),false);
  const body={to:'person@example.com',subject:'Test',text:'Body'};
  const headers={'Idempotency-Key':'unique-request-12345678'};
  assert.equal((await call('/send','a',body,headers)).status,200);
  assert.equal((await call('/send','a',body,headers)).status,200);
  assert.equal(operations,1);
  assert.equal((await call('/send','a',{...body,text:'Changed'},headers)).status,409);
  const concurrent=await Promise.all([call('/send','a',body,{'Idempotency-Key':'concurrent-request-12345'}),call('/send','a',body,{'Idempotency-Key':'concurrent-request-12345'})]);
  assert.ok(concurrent.every(response=>response.status===200));
  assert.equal(operations,2,'Concurrent retries must share one SMTP send');
}finally{await new Promise(resolve=>server.close(resolve));}
console.log('Mail checks passed: encrypted company isolation, secret redaction, authorization, TLS ports, MIME reading, mailbox validity, SMTP acceptance, Sent copy, and duplicate-send protection.');
