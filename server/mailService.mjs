import fs from 'node:fs/promises';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const clean = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function validateAccount(input, previous = {}) {
  const email = clean(input.email, 254);
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)) fail('Enter a valid mailbox email address.');
  const result = { email, name: clean(input.name, 100) };
  for (const kind of ['smtp', 'imap']) {
    const source = input[kind] || {};
    const host = clean(source.host, 253);
    if (!/^[a-zA-Z0-9.-]+$/.test(host)) fail(`Enter a valid ${kind.toUpperCase()} hostname.`);
    const port = Number(source.port);
    if (!(kind === 'smtp' ? [465, 587] : [993, 143]).includes(port)) fail(`Unsupported ${kind.toUpperCase()} port.`);
    const user = clean(source.user, 254);
    const pass = source.pass || previous[kind]?.pass;
    if (!user || typeof pass !== 'string' || !pass || pass.length > 1024) fail(`Enter ${kind.toUpperCase()} credentials.`);
    result[kind] = { host, port, user, pass };
  }
  return result;
}
export function publicAccount(account) {
  return account ? { email: account.email, name: account.name, ...Object.fromEntries(['smtp','imap'].map(key => [key,{host:account[key].host,port:account[key].port,user:account[key].user,hasPassword:true}])) } : null;
}
export function createAccountStore(env = process.env) {
  const root = path.resolve(env.MAIL_DATA_DIR || 'data/mail');
  function key() {
    if (!/^[a-f\d]{64}$/i.test(env.MAIL_ENCRYPTION_KEY || '')) fail('Set MAIL_ENCRYPTION_KEY to a 64-character hex key on the Node server.', 503);
    return Buffer.from(env.MAIL_ENCRYPTION_KEY, 'hex');
  }
  const filename = company => path.join(root, createHash('sha256').update(String(company)).digest('hex') + '.json');
  return {
    writable: Boolean(/^[a-f\d]{64}$/i.test(env.MAIL_ENCRYPTION_KEY || '')),
    async get(company) {
      try {
        const payload = JSON.parse(await fs.readFile(filename(company), 'utf8'));
        const decipher = createDecipheriv('aes-256-gcm',key(),Buffer.from(payload.iv,'hex'));
        decipher.setAAD(Buffer.from(String(company)));
        decipher.setAuthTag(Buffer.from(payload.tag,'hex'));
        return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data,'base64')),decipher.final()]).toString());
      } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async save(company, value) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',key(),iv);
      cipher.setAAD(Buffer.from(String(company)));
      const data = Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
      await fs.mkdir(root,{recursive:true,mode:0o700});
      const destination = filename(company), temporary = destination + '.' + randomBytes(6).toString('hex');
      await fs.writeFile(temporary,JSON.stringify({iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),data:data.toString('base64')}),{mode:0o600});
      await fs.rename(temporary,destination);
    }
  };
}
export function validateMessage(body, account) {
  function addresses(value, required = false) {
    if (typeof value !== 'string' || value.length > 4000 || /[\r\n]/.test(value)) fail('Invalid recipient list.');
    const list = value.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    if ((required && !list.length) || list.length > 50 || list.some(item => !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(item))) fail('Use valid email addresses separated by commas (up to 50).');
    return list;
  }
  const to = addresses(body.to || '', true), cc = addresses(body.cc || ''), bcc = addresses(body.bcc || '');
  if (to.length + cc.length + bcc.length > 50) fail('Limit messages to 50 recipients.');
  const subject = clean(body.subject, 998);
  if (!subject || /[\r\n]/.test(subject)) fail('Enter a valid subject.');
  if (typeof body.text !== 'string' || body.text.length > 200000) fail('Message body is too large.');
  if (!Array.isArray(body.attachments || []) || (body.attachments || []).length > 10) fail('Attach up to 10 files.');
  let size = 0;
  const attachments = (body.attachments || []).map(file => {
    if (typeof file.content !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.content)) fail('Invalid attachment.');
    const content = Buffer.from(file.content,'base64'); size += content.length;
    if (size > 10 * 1024 * 1024) fail('Attachments must total 10 MB or less.');
    return {filename:clean(file.filename,150).replace(/[\r\n/\\]/g,'_') || 'attachment',content,contentType:'application/octet-stream'};
  });
  const header = value => typeof value === 'string' && value.length < 1000 && !/[\r\n]/.test(value) ? value : undefined;
  return {from:{name:account.name,address:account.email},to,cc,bcc,subject,text:body.text,attachments,inReplyTo:header(body.inReplyTo),references:header(body.references),disableFileAccess:true,disableUrlAccess:true};
}
export function createMailService(account, { Client = ImapFlow, transport = nodemailer.createTransport } = {}) {
  const smtp = () => transport({host:account.smtp.host,port:account.smtp.port,secure:account.smtp.port===465,requireTLS:true,auth:{user:account.smtp.user,pass:account.smtp.pass},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,disableFileAccess:true,disableUrlAccess:true,logger:false});
  async function imap(work) {
    const client = new Client({host:account.imap.host,port:account.imap.port,secure:account.imap.port===993,...(account.imap.port===143?{doSTARTTLS:true}:{}),auth:{user:account.imap.user,pass:account.imap.pass},logger:false,connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,disableAutoIdle:true});
    client.on('error',()=>{});
    try { await client.connect(); return await work(client); }
    finally { try { await client.logout(); } catch { client.close(); } }
  }
  async function locked(client, folder, validity, work) {
    if (typeof folder !== 'string' || !folder || folder.length > 500 || /[\r\n\0]/.test(folder)) fail('Invalid folder.');
    const lock = await client.getMailboxLock(folder);
    try {
      if (validity && String(client.mailbox.uidValidity) !== String(validity)) fail('Mailbox changed. Refresh and open the message again.',409);
      return await work();
    } finally { lock.release(); }
  }
  async function special(client, flag, fallback) {
    const folders = await client.list();
    const found = folders.find(f=>f.specialUse===flag);
    if (found) return found.path;
    const existing = folders.find(f=>f.path.toLowerCase()===fallback.toLowerCase());
    if (existing) return existing.path;
    await client.mailboxCreate(fallback);
    return fallback;
  }
  const validUid = value => { const uid=Number(value);if(!Number.isSafeInteger(uid)||uid<1)fail('Invalid message identifier.');return uid; };
  const address = values => (values || []).map(a=>({name:a.name || '',address:a.address || ''}));
  async function parsed(client, folder, uid, validity) {
    if (!/^\d+$/.test(String(validity || ''))) fail('Refresh the mailbox before opening this message.',409);
    return locked(client,folder,validity,async()=>{
      const metadata=await client.fetchOne(validUid(uid),{size:true},{uid:true});
      if(!metadata)fail('Message not found.',404);
      if(metadata.size>15*1024*1024)fail('This message exceeds the 15 MB reading limit. Open it in your mail provider.',413);
      const item=await client.fetchOne(validUid(uid),{source:true,size:true},{uid:true});
      if(!item)fail('Message not found.',404);
      if(item.size>15*1024*1024 || item.source.length>15*1024*1024)fail('This message exceeds the 15 MB reading limit. Open it in your mail provider.',413);
      return simpleParser(item.source,{skipImageLinks:true,skipTextToHtml:true});
    });
  }
  return {
    async verify() { const sender=smtp();try {await sender.verify();await imap(c=>c.list());}finally{sender.close();}return {connected:true}; },
    folders:()=>imap(async c=>(await c.list()).filter(f=>!f.flags.has('\\Noselect')).map(f=>({path:f.path,name:f.name,specialUse:f.specialUse}))),
    list:({folder='INBOX',q='',page=1})=>imap(c=>locked(c,folder,null,async()=>{
      const ids=await c.search(q?{text:clean(q,200)}:{all:true},{uid:true});
      const ordered=ids.sort((a,b)=>b-a),start=(Math.max(1,Math.min(Number(page)||1,100000))-1)*30;
      const selected=ordered.slice(start,start+30), messages=[];
      if(selected.length)for await(const item of c.fetch(selected,{envelope:true,flags:true,size:true},{uid:true}))messages.push({uid:item.uid,subject:item.envelope.subject||'(No subject)',from:address(item.envelope.from),to:address(item.envelope.to),date:item.envelope.date,seen:item.flags.has('\\Seen'),starred:item.flags.has('\\Flagged'),size:item.size});
      return {messages:messages.sort((a,b)=>b.uid-a.uid),total:ids.length,uidValidity:String(c.mailbox.uidValidity)};
    })),
    read:({folder,uid,validity})=>imap(async c=>{const mail=await parsed(c,folder,uid,validity);return {subject:mail.subject||'(No subject)',from:address(mail.from?.value),to:address(mail.to?.value),cc:address(mail.cc?.value),replyTo:address(mail.replyTo?.value),date:mail.date,messageId:mail.messageId,text:mail.text||'',attachments:mail.attachments.map((a,index)=>({index,filename:a.filename||'attachment',size:a.size,contentType:a.contentType}))};}),
    attachment:({folder,uid,validity,index})=>imap(async c=>{const mail=await parsed(c,folder,uid,validity);const item=mail.attachments[Number(index)];if(!item)fail('Attachment not found.',404);return item;}),
    action:({folder,uid,validity,action,value})=>imap(c=>locked(c,folder,validity,async()=>{
      if (!/^\d+$/.test(String(validity || ''))) fail('Refresh the mailbox before changing this message.',409);
      const id=validUid(uid);
      if((action==='read'||action==='star') && typeof value!=='boolean')fail('Invalid flag value.');
      if(action==='read'||action==='star')return value?c.messageFlagsAdd(id,[action==='read'?'\\Seen':'\\Flagged'],{uid:true}):c.messageFlagsRemove(id,[action==='read'?'\\Seen':'\\Flagged'],{uid:true});
      if(action==='trash'||action==='archive'){const destination=await special(c,action==='trash'?'\\Trash':'\\Archive',action==='trash'?'Trash':'Archive');if(destination===folder)fail('Message is already in this folder.');return c.messageMove(id,destination,{uid:true});}
      fail('Unsupported mail action.');
    })),
    async compose(body, draft=false) {
      const message=validateMessage(body,account);
      if(draft){const raw=await new MailComposer(message).compile().build();await imap(async c=>c.append(await special(c,'\\Drafts','Drafts'),raw,['\\Draft','\\Seen']));return {draft:true};}
      const sender=smtp();let result;
      try {result=await sender.sendMail(message);}finally{sender.close();}
      if(!result.accepted?.length)fail('The mail server did not accept any recipients.',502);
      let warning=result.rejected?.length?'Some recipients were rejected by the mail server.':'';
      try {
        // Bcc is deliberately omitted from the Sent copy.
        const raw=await new MailComposer({...message,bcc:undefined,messageId:result.messageId}).compile().build();
        await imap(async c=>c.append(await special(c,'\\Sent','Sent'),raw,['\\Seen']));
      }catch{warning+=' Message accepted, but the Sent copy could not be saved. Do not resend.';}
      return {accepted:true,messageId:result.messageId,warning:warning.trim()};
    }
  };
}
