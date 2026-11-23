import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { internalMailHandle } from '../worker/internalMail.mjs';
const local=new DatabaseSync(':memory:');
local.exec(`CREATE TABLE users(company_id TEXT,user_id TEXT,username TEXT,email TEXT,status TEXT); CREATE TABLE employees(company_id TEXT,user_id TEXT,first_name TEXT,last_name TEXT,status TEXT,department TEXT DEFAULT '',profile TEXT DEFAULT '{}');
INSERT INTO users VALUES('a','admin','admin-a','admin@example.com','active'),('a','alice','alice','alice@example.com','active'),('a','bob','bob','bob@example.com','active'),('a','disabled','disabled','disabled@example.com','disabled'),('b','outsider','outside','outside@example.com','active');`);
function prepare(sql,args=[]){return{sql,args,bind(...values){return prepare(sql,values);},async first(){return local.prepare(sql).get(...args)||null;},async all(){return{results:local.prepare(sql).all(...args)};},async run(){return local.prepare(sql).run(...args);}};}
const db={prepare,async batch(statements){local.exec('BEGIN');try{const results=statements.map(s=>local.prepare(s.sql).run(...s.args));local.exec('COMMIT');return results;}catch(e){local.exec('ROLLBACK');throw e;}}};
const actor={company_id:'a',user_id:'admin',role:'company_admin'};
const call=(route,{who=actor,body={},query={},id='request-1234567890',method='GET'}={})=>internalMailHandle({db,actor:who,path:'/api/v1/mail/'+route,method,body,requestId:id,url:new URL('https://example.test/api/v1/mail/'+route+'?'+new URLSearchParams(query))});
const alice={company_id:'a',user_id:'alice',role:'employee'},bob={company_id:'a',user_id:'bob',role:'employee'},outsider={company_id:'b',user_id:'outsider',role:'company_admin'};
assert.equal((await call('account')).mode,'internal');
assert.equal((await call('account')).account.email,'admin-a');
assert.equal((await call('account',{who:alice})).account.email,'alice');
assert.equal((await call('directory')).length,2);
assert.ok((await call('directory')).every(person=>person.id!=='admin'));
assert.equal((await call('messages',{who:alice,query:{folder:'INBOX'}})).total,0);
const body={to:'alice',cc:'',bcc:'bob',subject:'Internal only',text:'Private company message',from:'spoofed@example.com',attachments:[{filename:'report.txt',content:Buffer.from('company report').toString('base64')}]};
const sent=await call('send',{method:'POST',body});
assert.equal(sent.accepted,true);
const inbox=await call('messages',{who:alice,query:{folder:'INBOX'}});
assert.equal(inbox.total,1);assert.equal(inbox.messages[0].seen,false);
assert.equal((await call('messages',{query:{folder:'Sent'}})).total,1);
assert.equal((await call('messages',{who:outsider,query:{folder:'INBOX'}})).total,0);
const query={folder:'INBOX',uid:sent.messageId};
const message=await call('message',{who:alice,query});
assert.equal(message.from[0].address,'admin-a');assert.equal(message.bcc,undefined);assert.equal(message.to[0].address,'alice');
const attachment=await call('attachment',{who:alice,query:{...query,index:0}});
assert.equal(Buffer.from(attachment.content,'base64').toString(),'company report');
await assert.rejects(()=>call('message',{who:outsider,query}),/not found/);
await assert.rejects(()=>call('attachment',{who:outsider,query:{...query,index:0}}),/not found/);
await call('action',{who:alice,method:'POST',body:{...query,action:'read',value:true}});
assert.equal((await call('messages',{who:alice,query:{folder:'INBOX'}})).messages[0].seen,true);
await call('action',{who:alice,method:'POST',body:{...query,action:'trash'}});
assert.equal((await call('messages',{who:alice,query:{folder:'INBOX'}})).total,0);
assert.equal((await call('messages',{who:alice,query:{folder:'Trash'}})).total,1);
assert.equal((await call('messages',{who:bob,query:{folder:'INBOX'}})).total,1,'One user moving mail must not affect another user');
assert.equal((await call('send',{method:'POST',body})).messageId,sent.messageId);
assert.equal((await call('messages',{query:{folder:'Sent'}})).total,1,'Retries must not create duplicate copies');
await assert.rejects(()=>call('send',{method:'POST',id:'external-request-123456',body:{...body,to:'outside@example.com'}}),/External sending is disabled/);
await assert.rejects(()=>call('send',{method:'POST',id:'disabled-request-123456',body:{...body,to:'disabled'}}),/Choose recipients/);
await call('draft',{method:'POST',id:'draft-request-123456',body:{to:'',subject:'',text:'Unfinished'}});
assert.equal((await call('messages',{query:{folder:'Drafts'}})).total,1);
assert.equal((await call('messages',{who:bob,query:{folder:'INBOX'}})).total,1,'Drafts must not deliver messages');
assert.equal((await call('messages',{query:{folder:'Sent',q:'Private company'}})).total,1);
assert.equal((await call('messages',{query:{folder:'Sent',q:'%'}})).total,0,'Search wildcard characters are literal');

for(const alias of ['admin','ADMIN-A','admin@example.com']){await assert.rejects(()=>call('send',{method:'POST',id:'self-to-'+alias.replace(/[^a-z]/gi,'')+'-1234567890',body:{...body,to:alias}}),/cannot send a message to yourself/);}
for(const field of ['cc','bcc']){await assert.rejects(()=>call('send',{method:'POST',id:'self-'+field+'-123456789012',body:{...body,[field]:'admin-a'}}),/cannot send a message to yourself/);}

local.close();

console.log('Internal mail passed: automatic inboxes, tenant/user isolation, internal-only recipients, Bcc privacy, attachments, independent folders, read state, drafts, search, and durable idempotency, and self-send prevention.');
