const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const stmt=(db,sql,args=[])=>db.prepare(sql).bind(...args);
export const INTERNAL_MAIL_SCHEMA=[
  `CREATE TABLE IF NOT EXISTS internal_mail_messages(company_id TEXT NOT NULL,id TEXT NOT NULL,sender_id TEXT NOT NULL,request_id TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(company_id,id),UNIQUE(company_id,sender_id,request_id))`,
  `CREATE TABLE IF NOT EXISTS internal_mail_copies(company_id TEXT NOT NULL,message_id TEXT NOT NULL,user_id TEXT NOT NULL,kind TEXT NOT NULL,folder TEXT NOT NULL,seen INTEGER NOT NULL DEFAULT 0,starred INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(company_id,message_id,user_id,kind))`,
  `CREATE INDEX IF NOT EXISTS internal_mail_inbox ON internal_mail_copies(company_id,user_id,folder)`,
  `CREATE TABLE IF NOT EXISTS internal_mail_attachments(company_id TEXT NOT NULL,message_id TEXT NOT NULL,attachment_index INTEGER NOT NULL,chunk_index INTEGER NOT NULL,content TEXT NOT NULL,PRIMARY KEY(company_id,message_id,attachment_index,chunk_index))`
];
const initialized=new WeakMap();
async function ready(db){if(!initialized.has(db))initialized.set(db,db.batch(INTERNAL_MAIL_SCHEMA.map(sql=>stmt(db,sql))).catch(error=>{initialized.delete(db);throw error;}));await initialized.get(db);}
const folders=[{path:'INBOX',name:'Inbox'},{path:'Sent',name:'Sent',specialUse:'\\Sent'},{path:'Drafts',name:'Drafts',specialUse:'\\Drafts'},{path:'Archive',name:'Archive',specialUse:'\\Archive'},{path:'Trash',name:'Trash',specialUse:'\\Trash'}];
async function directory(db,company){return (await stmt(db,`SELECT u.user_id,u.username,u.email,e.department,json_extract(e.profile,'$.profile_pic_url') AS profile_pic_url,COALESCE(NULLIF(trim(COALESCE(e.first_name,'')||' '||COALESCE(e.last_name,'')),''),u.username) AS name FROM users u LEFT JOIN employees e ON e.company_id=u.company_id AND e.user_id=u.user_id WHERE u.company_id=? AND u.status='active' AND (e.status IS NULL OR e.status!='Inactive') ORDER BY name`,[company]).all()).results;}
const address=user=>({name:user.name||user.username,address:user.username,userid:user.user_id});
export async function internalMailHandle({db,actor,path,method,body={},url,requestId}) {
  await ready(db);
  const company=actor.company_id,user=actor.user_id||actor.userid,route=path.replace(/^\/api\/(?:v1\/)?mail\/?/,'');
  const people=await directory(db,company),sender=people.find(p=>p.user_id===user);
  if(!sender)fail('Your company mailbox is unavailable.',403);
  if(route==='account'&&method==='GET')return {mode:'internal',account:{name:sender.name,email:sender.username},canConfigure:false,canSave:false};
  if(route==='directory'&&method==='GET')return people.filter(p=>p.user_id!==user).map(p=>({id:p.user_id,name:p.name,address:p.username,email:p.email||'',department:p.department||'',profile_pic_url:p.profile_pic_url||''}));
  if(route==='folders'&&method==='GET'){
    const counts=(await stmt(db,'SELECT folder,count(DISTINCT CASE WHEN seen=0 THEN message_id END) AS unread FROM internal_mail_copies WHERE company_id=? AND user_id=? GROUP BY folder',[company,user]).all()).results;
    return folders.map(folder=>({...folder,unread:counts.find(row=>row.folder===folder.path)?.unread||0}));
  }
  const params=Object.fromEntries(url.searchParams),folder=method==='GET'?params.folder:body.folder;
  const validFolder=()=>{if(!folders.some(f=>f.path===folder))fail('Invalid folder.');return folder;};
  async function copy(){validFolder();const id=method==='GET'?params.uid:body.uid;const row=await stmt(db,`SELECT m.payload,m.created_at,m.sender_id,c.* FROM internal_mail_copies c JOIN internal_mail_messages m ON m.company_id=c.company_id AND m.id=c.message_id WHERE c.company_id=? AND c.user_id=? AND c.folder=? AND c.message_id=? LIMIT 1`,[company,user,folder,id]).first();if(!row)fail('Message not found.',404);return row;}
  if(route==='messages'&&method==='GET'){
    validFolder();const page=Math.max(1,Math.min(100000,Number.parseInt(params.page)||1)),q=String(params.q||'').slice(0,200),pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
    const where=`c.company_id=? AND c.user_id=? AND c.folder=? AND (json_extract(m.payload,'$.subject') LIKE ? ESCAPE '\\' OR json_extract(m.payload,'$.text') LIKE ? ESCAPE '\\' OR json_extract(m.payload,'$.from') LIKE ? ESCAPE '\\')`;
    const args=[company,user,folder,pattern,pattern,pattern];
    const rows=(await stmt(db,`SELECT m.id,m.payload,m.created_at,min(c.seen) AS seen,max(c.starred) AS starred FROM internal_mail_copies c JOIN internal_mail_messages m ON m.company_id=c.company_id AND m.id=c.message_id WHERE ${where} GROUP BY m.id ORDER BY m.created_at DESC,m.id DESC LIMIT 30 OFFSET ?`,[...args,(page-1)*30]).all()).results;
    const count=await stmt(db,`SELECT count(DISTINCT m.id) AS total FROM internal_mail_copies c JOIN internal_mail_messages m ON m.company_id=c.company_id AND m.id=c.message_id WHERE ${where}`,args).first();
    return {uidValidity:'internal',total:count.total,messages:rows.map(row=>{const value=JSON.parse(row.payload);return{uid:row.id,subject:value.subject||'(No subject)',preview:value.text.slice(0,140).replace(/\s+/g,' '),hasAttachments:Boolean(value.attachments?.length),from:value.from,to:value.to,date:row.created_at,seen:Boolean(row.seen),starred:Boolean(row.starred)};})};
  }
  if(route==='message'&&method==='GET'){const row=await copy(),message=JSON.parse(row.payload);delete message.bcc;delete message.requestHash;return {...message,date:row.created_at,messageId:row.message_id,replyTo:message.from,attachments:message.attachments||[]};}
  if(route==='attachment'&&method==='GET'){
    const row=await copy(),message=JSON.parse(row.payload),index=Number(params.index),attachment=message.attachments?.[index];
    if(!Number.isInteger(index)||!attachment)fail('Attachment not found.',404);
    const chunks=(await stmt(db,'SELECT content FROM internal_mail_attachments WHERE company_id=? AND message_id=? AND attachment_index=? ORDER BY chunk_index',[company,row.message_id,index]).all()).results;
    return {download:true,filename:attachment.filename,content:chunks.map(c=>c.content).join('')};
  }
  if(route==='action'&&method==='POST'){
    const row=await copy();let sql,args;
    if(['read','star'].includes(body.action)){if(typeof body.value!=='boolean')fail('Invalid flag.');sql=`UPDATE internal_mail_copies SET ${body.action==='read'?'seen':'starred'}=? WHERE company_id=? AND user_id=? AND message_id=? AND folder=?`;args=[Number(body.value),company,user,row.message_id,folder];}
    else if(['archive','trash'].includes(body.action)){sql='UPDATE internal_mail_copies SET folder=? WHERE company_id=? AND user_id=? AND message_id=? AND folder=?';args=[body.action==='trash'?'Trash':'Archive',company,user,row.message_id,folder];}
    else fail('Unsupported mail action.');
    await stmt(db,sql,args).run();return{updated:true};
  }
  if(['send','draft'].includes(route)&&method==='POST'){
    const draft=route==='draft';
    if(typeof requestId!=='string'||! /^[\w-]{16,80}$/.test(requestId))fail('A valid message identifier is required.');
    const requestHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({body,draft}))))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const previous=await stmt(db,'SELECT id,payload FROM internal_mail_messages WHERE company_id=? AND sender_id=? AND request_id=?',[company,user,requestId]).first();
    if(previous){if(JSON.parse(previous.payload).requestHash!==requestHash)fail('This message identifier was already used. Start a new message.',409);return{accepted:!draft,draft,messageId:previous.id};}
    const subject=typeof body.subject==='string'?body.subject.trim():'';
    const text=typeof body.text==='string'?body.text:'';
    if(subject.length>998||text.length>200000||(!draft&&!subject))fail('Enter a subject and keep the message within its size limit.');
    function recipients(value){if(typeof value!=='string'||value.length>4000)fail('Invalid recipients.');const entries=value.split(/[;,]/).map(s=>s.trim().toLowerCase()).filter(Boolean);return [...new Map(entries.map(entry=>{const person=people.find(p=>[p.user_id,p.username,p.email].filter(Boolean).some(v=>v.toLowerCase()===entry));if(!person)fail('Choose recipients from your company. External sending is disabled.');if(person.user_id===user)fail('You cannot send a message to yourself. Choose another colleague.');return[person.user_id,person];})).values()];}
    const to=recipients(body.to||''),cc=recipients(body.cc||''),bcc=recipients(body.bcc||'');
    const recipientsAll=[...new Map([...to,...cc,...bcc].map(p=>[p.user_id,p])).values()];
    if((!draft&&!to.length)||recipientsAll.length>50)fail('Choose between 1 and 50 company recipients.');
    if(!Array.isArray(body.attachments||[])||(body.attachments||[]).length>10)fail('Attach up to 10 files.');
    const id=crypto.randomUUID(),now=new Date().toISOString(),attachmentWrites=[];let total=0;
    const attachments=(body.attachments||[]).map((item,index)=>{
      if(typeof item.content!=='string'||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.content))fail('Invalid attachment.');
      const size=item.content.length/4*3-(item.content.endsWith('==')?2:item.content.endsWith('=')?1:0);total+=size;
      if(total>2*1024*1024)fail('Attachments must total 2 MB or less.');
      const filename=String(item.filename||'attachment').replace(/[\r\n/\\]/g,'_').slice(0,150);
      for(let offset=0;offset<item.content.length;offset+=96000)attachmentWrites.push(stmt(db,'INSERT INTO internal_mail_attachments VALUES(?,?,?,?,?)',[company,id,index,offset/96000,item.content.slice(offset,offset+96000)]));
      return {index,filename,size,contentType:'application/octet-stream'};
    });
    const payload={subject,text,from:[address(sender)],to:to.map(address),cc:cc.map(address),attachments,requestHash};
    const writes=[stmt(db,'INSERT INTO internal_mail_messages VALUES(?,?,?,?,?,?)',[company,id,user,requestId,JSON.stringify(payload),now]),stmt(db,'INSERT INTO internal_mail_copies(company_id,message_id,user_id,kind,folder,seen) VALUES(?,?,?,?,?,1)',[company,id,user,draft?'draft':'sent',draft?'Drafts':'Sent']),...attachmentWrites];
    if(!draft)for(const person of recipientsAll)writes.push(stmt(db,'INSERT INTO internal_mail_copies(company_id,message_id,user_id,kind,folder,seen) VALUES(?,?,?,?,?,0)',[company,id,person.user_id,'received','INBOX']));
    try{await db.batch(writes);}catch(error){const existing=await stmt(db,'SELECT id,payload FROM internal_mail_messages WHERE company_id=? AND sender_id=? AND request_id=?',[company,user,requestId]).first();if(existing){if(JSON.parse(existing.payload).requestHash!==requestHash)fail('This message identifier was already used. Start a new message.',409);return{accepted:!draft,draft,messageId:existing.id};}throw error;}
    return {accepted:!draft,draft,messageId:id};
  }
  fail('Mail endpoint not found.',404);
}
