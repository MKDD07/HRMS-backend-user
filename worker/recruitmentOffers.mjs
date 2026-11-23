const stmt = (db,sql,params=[]) => db.prepare(sql).bind(...params);
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const enc = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes),byte => byte.toString(16).padStart(2,'0')).join('');
const digest = async value => hex(await crypto.subtle.digest('SHA-256',enc.encode(value)));
const day = now => new Date(new Date(now).getTime()+330*60000).toISOString().slice(0,10);
const clean = (value,label,max=200) => { if (typeof value !== 'string' || value.trim().length > max) fail(`${label} must be text of at most ${max} characters.`); return value.trim(); };
const required = (value,label,max) => clean(value,label,max) || fail(`${label} is required.`);
const escapeHtml = value => String(value).replace(/[&<>"']/g,ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const parse = row => JSON.parse(row.payload);
const publicRecord = row => { const result = {...parse(row),id:row.id,revision:row.revision,created_at:row.created_at,updated_at:row.updated_at}; delete result.last_change_id; return result; };
async function record(db,company,collection,id) {
  const row = await stmt(db,'SELECT * FROM talent_records WHERE company_id=? AND collection=? AND id=?',[company,collection,id]).first();
  if (!row) fail('Recruitment record not found.',404);
  return row;
}
function guardFor(company,collection,id,changeId) {
  return {sql:"EXISTS(SELECT 1 FROM talent_records WHERE company_id=? AND collection=? AND id=? AND json_extract(payload,'$.last_change_id')=?)",params:[company,collection,id,changeId]};
}
function audit(db,actor,collection,id,before,at,changeId,action,guard=guardFor(actor.company_id,collection,id,changeId)) {
  const old = {...before}; delete old.last_change_id;
  return [
    stmt(db,`INSERT INTO talent_audit(company_id,id,collection,record_id,actor_id,action,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,json_remove(payload,'$.last_change_id'),? FROM talent_records WHERE company_id=? AND collection=? AND id=? AND ${guard.sql}`,[actor.company_id,crypto.randomUUID(),collection,id,actor.user_id,action,before?JSON.stringify(old):null,at,actor.company_id,collection,id,...guard.params]),
    stmt(db,`INSERT INTO talent_domain_events(company_id,id,event_type,record_id,payload,created_at) SELECT ?,?,?,?,json_object('collection',?,'id',?,'status',json_extract(payload,'$.status')),? FROM talent_records WHERE company_id=? AND collection=? AND id=? AND ${guard.sql}`,[actor.company_id,crypto.randomUUID(),`${collection}.${action.toLowerCase().replaceAll(' ','_')}`,id,collection,id,at,actor.company_id,collection,id,...guard.params])
  ];
}
async function linkToken(secret,company,id) {
  if (typeof secret !== 'string' || secret.length < 32) fail('Offer response signing is not configured. Set RECRUITMENT_TOKEN_SECRET (at least 32 characters).',503);
  const key = await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,enc.encode(`offer/v1/${company}/${id}`)));
}
function publicAppUrl(value) {
  let url; try { url = new URL(value); } catch { fail('Set HRMS_PUBLIC_APP_URL to the application origin.',503); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) fail('HRMS_PUBLIC_APP_URL must be an HTTPS application origin (localhost HTTP is allowed for development).',503);
  return url.origin;
}
export function offerEmail(snapshot,link) {
  return {from:snapshot.from,to:[snapshot.email],subject:`Your offer from ${snapshot.company_name}`,html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#27292c"><p>${escapeHtml(snapshot.company_name)}</p><h1>Your next chapter</h1><p>Dear ${escapeHtml(snapshot.candidate_name)},</p><p>We are pleased to offer you the role of <strong>${escapeHtml(snapshot.designation)}</strong> in ${escapeHtml(snapshot.department)}.</p><p>Annual CTC: INR ${Number(snapshot.annual_ctc).toLocaleString('en-IN')}<br>Proposed joining date: ${escapeHtml(snapshot.joining_date)}<br>Respond by: ${escapeHtml(snapshot.valid_until)} (IST)</p><div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(snapshot.offer_text)}</div><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#27292c;color:white;border-radius:8px;text-decoration:none">Review and respond</a></p><p>This personal link gives access to your offer. Keep it private.</p></div>`};
}

export async function sendOffer({db,actor,env,id,body,now=new Date().toISOString(),fetcher=fetch}) {
  if (actor.role !== 'company_admin') fail('Recruitment administrator access required.',403);
  let row = await record(db,actor.company_id,'offers',id), offer = parse(row);
  if (['Sent','Accepted','Declined','Expired'].includes(offer.status)) return publicRecord(row);
  if (!['Approved','Delivery pending'].includes(offer.status)) fail('Approve the offer before sending.',409);
  if (!env.RESEND_API_KEY || !env.DOCUMENT_EMAIL_FROM) fail('Email delivery is not configured. Set RESEND_API_KEY and DOCUMENT_EMAIL_FROM.',503);
  const origin = publicAppUrl(env.HRMS_PUBLIC_APP_URL);
  await linkToken(env.RECRUITMENT_TOKEN_SECRET,actor.company_id,'configuration-check');
  let delivery = await stmt(db,'SELECT * FROM recruitment_offer_deliveries WHERE company_id=? AND offer_id=?',[actor.company_id,id]).first();
  if (!delivery) {
    if (body.revision !== row.revision) fail('The offer changed. Refresh before sending.',409);
    if (offer.valid_until < day(now)) fail('This offer has expired. Create a new approved draft.',409);
    if (!offer.offer_text) fail('Add and approve the offer terms before sending.',409);
    const candidateRow = await record(db,actor.company_id,'candidates',offer.candidate_id), candidate = parse(candidateRow);
    const jobRow = await record(db,actor.company_id,'jobs',candidate.job_id), job = parse(jobRow);
    if (['Hired','Rejected','Withdrawn'].includes(candidate.status) || job.status !== 'Open') fail('The application and opening must be active.',409);
    const company = await stmt(db,"SELECT name FROM companies WHERE company_id=? AND status='active'",[actor.company_id]).first();
    if (!company) fail('Company is unavailable.',409);
    const deliveryId = crypto.randomUUID(), changeId = crypto.randomUUID();
    const token = await linkToken(env.RECRUITMENT_TOKEN_SECRET,actor.company_id,deliveryId);
    const snapshot = {company_name:company.name,candidate_name:candidate.title,email:candidate.email,designation:job.title,department:job.department,annual_ctc:offer.annual_ctc,joining_date:offer.joining_date,valid_until:offer.valid_until,offer_text:offer.offer_text,from:env.DOCUMENT_EMAIL_FROM,origin};
    const next = {...offer,status:'Delivery pending',last_change_id:changeId};
    const guard = guardFor(actor.company_id,'offers',id,changeId);
    await db.batch([
      stmt(db,"UPDATE talent_records SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND collection='offers' AND id=? AND revision=? AND json_extract(payload,'$.status')='Approved' AND EXISTS(SELECT 1 FROM talent_records WHERE company_id=? AND collection='candidates' AND id=? AND revision=?) AND EXISTS(SELECT 1 FROM talent_records WHERE company_id=? AND collection='jobs' AND id=? AND revision=?)",[JSON.stringify(next),now,actor.company_id,id,row.revision,actor.company_id,candidateRow.id,candidateRow.revision,actor.company_id,jobRow.id,jobRow.revision]),
      stmt(db,`INSERT INTO recruitment_offer_deliveries(id,company_id,offer_id,token_hash,snapshot,created_at) SELECT ?,?,?,?,?,? WHERE ${guard.sql}`,[deliveryId,actor.company_id,id,await digest(token),JSON.stringify(snapshot),now,...guard.params]),
      ...audit(db,actor,'offers',id,offer,now,changeId,'Delivery pending')
    ]);
    delivery = await stmt(db,'SELECT * FROM recruitment_offer_deliveries WHERE company_id=? AND offer_id=?',[actor.company_id,id]).first();
    if (!delivery || delivery.id !== deliveryId) fail('The offer or application changed. Refresh before sending.',409);
  }
  if (new Date(now)-new Date(delivery.created_at) > 23*3600000) fail('Delivery needs provider reconciliation; the safe retry window has ended. Check the provider message before retrying or replacing this offer.',409);
  const snapshot = JSON.parse(delivery.snapshot);
  if (snapshot.valid_until < day(now)) fail('Offer validity has ended. Reconcile the pending delivery with the email provider.',409);
  const token = await linkToken(env.RECRUITMENT_TOKEN_SECRET,actor.company_id,delivery.id);
  if (await digest(token) !== delivery.token_hash) fail('The signing secret changed. Restore the original secret to retry this delivery.',503);
  let response;
  try { response = await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`hr-offer/${actor.company_id}/${delivery.id}`},body:JSON.stringify(offerEmail(snapshot,`${snapshot.origin}/offer#${delivery.id}.${token}`)),signal:AbortSignal.timeout(15000)}); }
  catch { fail('Delivery is pending. The email provider response was interrupted; retry delivery using the same offer.',502); }
  if (!response.ok) fail('Delivery is pending. The email provider did not accept this request; check its configuration and retry delivery.',502);
  const result = await response.json().catch(() => ({}));
  if (typeof result.id !== 'string' || !result.id) fail('Delivery is pending. No provider reference was returned; retry delivery.',502);
  row = await record(db,actor.company_id,'offers',id); offer = parse(row);
  if (offer.status !== 'Delivery pending') return publicRecord(row);
  const changeId = crypto.randomUUID(), guard = guardFor(actor.company_id,'offers',id,changeId);
  const next = {...offer,status:'Sent',delivery:{id:delivery.id,provider_id:result.id,recipient:snapshot.email,at:now,status:'Accepted by email provider'},last_change_id:changeId};
  const candidateRow = await record(db,actor.company_id,'candidates',offer.candidate_id);
  await db.batch([
    stmt(db,"UPDATE talent_records SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND collection='offers' AND id=? AND revision=? AND json_extract(payload,'$.status')='Delivery pending'",[JSON.stringify(next),now,actor.company_id,id,row.revision]),
    stmt(db,`UPDATE recruitment_offer_deliveries SET status='Sent',provider_id=?,sent_at=? WHERE company_id=? AND offer_id=? AND ${guard.sql}`,[result.id,now,actor.company_id,id,...guard.params]),
    stmt(db,`UPDATE talent_records SET payload=json_set(payload,'$.status','Offered','$.last_change_id',?),revision=revision+1,updated_at=? WHERE company_id=? AND collection='candidates' AND id=? AND json_extract(payload,'$.status') NOT IN ('Hired','Rejected','Withdrawn') AND ${guard.sql}`,[changeId,now,actor.company_id,offer.candidate_id,...guard.params]),
    ...audit(db,actor,'offers',id,offer,now,changeId,'Sent'),
    ...audit(db,actor,'candidates',offer.candidate_id,parse(candidateRow),now,changeId,'Offered')
  ]);
  return publicRecord(await record(db,actor.company_id,'offers',id));
}

async function responseRecord(db,id,token) {
  if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-f0-9]{64}$/.test(token || '')) fail('Offer link is unavailable.',404);
  const delivery = await stmt(db,"SELECT d.* FROM recruitment_offer_deliveries d JOIN companies c ON c.company_id=d.company_id WHERE d.id=? AND d.token_hash=? AND d.status='Sent' AND c.status='active'",[id,await digest(token)]).first();
  if (!delivery) fail('Offer link is unavailable.',404);
  const row = await record(db,delivery.company_id,'offers',delivery.offer_id);
  return {delivery,row,offer:parse(row),snapshot:JSON.parse(delivery.snapshot)};
}
function responseView(offer,snapshot,now) {
  return {company_name:snapshot.company_name,candidate_name:snapshot.candidate_name,designation:snapshot.designation,department:snapshot.department,annual_ctc:snapshot.annual_ctc,joining_date:snapshot.joining_date,valid_until:snapshot.valid_until,offer_text:snapshot.offer_text,status:offer.status === 'Sent' && snapshot.valid_until < day(now) ? 'Expired' : offer.status,response_at:offer.response?.at || null};
}
export async function publicOfferResponse({db,id,token,method,body={},request,now=new Date().toISOString()}) {
  const {delivery,row,offer,snapshot} = await responseRecord(db,id,token);
  if (!['Sent','Accepted','Declined','Expired'].includes(offer.status)) fail('Offer link is unavailable.',404);
  const candidateRow = await record(db,delivery.company_id,'candidates',offer.candidate_id), candidate = parse(candidateRow);
  if (['Rejected','Withdrawn'].includes(candidate.status) && offer.status !== 'Declined') fail('Offer link is unavailable.',404);
  if (method === 'GET') return responseView(offer,snapshot,now);
  if (method !== 'POST') fail('Route not found.',404);
  if (!['accept','decline'].includes(body.decision)) fail('Choose accept or decline.');
  const status = body.decision === 'accept' ? 'Accepted' : 'Declined';
  if (offer.status === status) return responseView(offer,snapshot,now);
  if (offer.status !== 'Sent' || snapshot.valid_until < day(now)) fail('This offer has already been answered or has expired.',409);
  const response = {decision:body.decision,at:now,typed_name:body.decision === 'accept' ? required(body.typed_name,'Your full name',120) : '',reason:body.decision === 'decline' ? required(body.reason,'Decline reason',1000) : '',ip:(request?.headers.get('CF-Connecting-IP') || '').slice(0,64),user_agent:(request?.headers.get('User-Agent') || '').slice(0,300)};
  if (body.decision === 'accept' && body.confirmed !== true) fail('Confirm that you have read and accept the offer terms.');
  const changeId = crypto.randomUUID(), next = {...offer,status,response,last_change_id:changeId};
  const actor = {company_id:delivery.company_id,user_id:'candidate-response'}, guard = guardFor(actor.company_id,'offers',row.id,changeId);
  const writes = [stmt(db,"UPDATE talent_records SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND collection='offers' AND id=? AND revision=? AND json_extract(payload,'$.status')='Sent' AND EXISTS(SELECT 1 FROM talent_records WHERE company_id=? AND collection='candidates' AND id=? AND revision=? AND json_extract(payload,'$.status') NOT IN ('Hired','Rejected','Withdrawn'))",[JSON.stringify(next),now,actor.company_id,row.id,row.revision,actor.company_id,candidateRow.id,candidateRow.revision]),...audit(db,actor,'offers',row.id,offer,now,changeId,status)];
  if (status === 'Declined') writes.push(stmt(db,`UPDATE talent_records SET payload=json_set(payload,'$.status','Rejected','$.rejection_reason','Offer declined','$.last_change_id',?),revision=revision+1,updated_at=? WHERE company_id=? AND collection='candidates' AND id=? AND ${guard.sql}`,[changeId,now,actor.company_id,candidateRow.id,...guard.params]),...audit(db,actor,'candidates',candidateRow.id,candidate,now,changeId,'Rejected'));
  await db.batch(writes);
  const saved = parse(await record(db,actor.company_id,'offers',row.id));
  if (saved.last_change_id !== changeId) fail('This offer changed. Refresh to see the latest response.',409);
  return responseView(saved,snapshot,now);
}

export async function hireOffer({db,actor,id,body,hashPassword,now=new Date().toISOString()}) {
  if ((actor.original_role || actor.role) !== 'company_admin') fail('Only a company administrator can create the employee account.',403);
  const offerRow = await record(db,actor.company_id,'offers',id), offer = parse(offerRow);
  if (offer.hired_user_id) return {offer:publicRecord(offerRow),userid:offer.hired_user_id,employee_id:offer.hired_employee_id,onboarding_id:offer.onboarding_id};
  if (offer.status !== 'Accepted') fail('The candidate must accept the sent offer before hiring.',409);
  if (body.revision !== offerRow.revision) fail('The offer changed. Refresh before hiring.',409);
  const candidateRow = await record(db,actor.company_id,'candidates',offer.candidate_id), candidate = parse(candidateRow);
  const jobRow = await record(db,actor.company_id,'jobs',candidate.job_id), job = parse(jobRow);
  if (['Hired','Rejected','Withdrawn'].includes(candidate.status) || job.status !== 'Open') fail('The application and opening must still be active.',409);
  const delivery = await stmt(db,"SELECT snapshot FROM recruitment_offer_deliveries WHERE company_id=? AND offer_id=? AND status='Sent'",[actor.company_id,id]).first();
  if (!delivery || JSON.parse(delivery.snapshot).email !== candidate.email) fail('Candidate contact details changed after sending. Resolve the offer before hiring.',409);
  const ownerId = required(body.owner_id,'Onboarding coordinator');
  if (!await stmt(db,"SELECT e.user_id FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND e.user_id=? AND e.status<>'Inactive' AND u.status='active'",[actor.company_id,ownerId]).first()) fail('Choose an active coordinator from this company.');
  const first = required(body.first_name,'First name'), last = clean(body.last_name || '','Last name');
  const reqRow = job.requisition_id ? await record(db,actor.company_id,'requisitions',job.requisition_id) : null;
  if (reqRow && parse(reqRow).status !== 'Approved') fail('The linked requisition is no longer approved.',409);
  const userId = crypto.randomUUID(), employeeId = crypto.randomUUID(), onboardingId = `hire:${id}`, changeId = crypto.randomUUID();
  const passwordHash = await hashPassword(hex(crypto.getRandomValues(new Uint8Array(32))));
  const profile = {date_of_joining:offer.joining_date,joining_date:offer.joining_date,recruitment_offer_id:id,recruitment_candidate_id:candidateRow.id,onboarding_status:'Pre-joining'};
  const due = new Date(`${offer.joining_date}T12:00:00Z`); due.setUTCDate(due.getUTCDate()+7);
  const plan = {title:`Welcome ${first}`,employee_id:userId,owner_id:ownerId,start_date:offer.joining_date,due_date:due.toISOString().slice(0,10),status:'Not started',source_offer_id:id,checklist:['Collect joining documents','Prepare equipment and access','Complete orientation','Confirm team introduction'].map(title => ({title,done:false})),history:[{at:now,actor:actor.user_id,status:'Not started'}],last_change_id:changeId};
  const next = {...candidate,status:'Hired',employee_id:userId,hired_offer_id:id,hired_at:now,last_change_id:changeId};
  const guard = guardFor(actor.company_id,'candidates',candidateRow.id,changeId);
  const writes = [
    stmt(db,`UPDATE talent_records SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND collection='candidates' AND id=? AND revision=? AND EXISTS(SELECT 1 FROM companies WHERE company_id=talent_records.company_id AND employee_prefix IS NOT NULL AND status='active') AND EXISTS(SELECT 1 FROM talent_records WHERE company_id=? AND collection='offers' AND id=? AND revision=? AND json_extract(payload,'$.status')='Accepted') AND EXISTS(SELECT 1 FROM talent_records j WHERE j.company_id=? AND j.collection='jobs' AND j.id=? AND j.revision=? AND json_extract(j.payload,'$.status')='Open' AND CAST(json_extract(j.payload,'$.positions') AS INTEGER)>(SELECT count(*) FROM talent_records c WHERE c.company_id=j.company_id AND c.collection='candidates' AND json_extract(c.payload,'$.job_id')=j.id AND json_extract(c.payload,'$.status')='Hired'))${reqRow ? " AND EXISTS(SELECT 1 FROM talent_records r WHERE r.company_id=? AND r.collection='requisitions' AND r.id=? AND r.revision=? AND json_extract(r.payload,'$.status')='Approved' AND CAST(json_extract(r.payload,'$.positions') AS INTEGER)>(SELECT count(*) FROM talent_records c JOIN talent_records j ON j.company_id=c.company_id AND j.collection='jobs' AND j.id=json_extract(c.payload,'$.job_id') WHERE c.company_id=r.company_id AND c.collection='candidates' AND json_extract(c.payload,'$.status')='Hired' AND json_extract(j.payload,'$.requisition_id')=r.id))" : ''}`,[JSON.stringify(next),now,actor.company_id,candidateRow.id,candidateRow.revision,actor.company_id,id,offerRow.revision,actor.company_id,jobRow.id,jobRow.revision,...(reqRow?[actor.company_id,reqRow.id,reqRow.revision]:[])]),
    stmt(db,`UPDATE companies SET next_employee_number=next_employee_number+1 WHERE company_id=? AND employee_prefix IS NOT NULL AND ${guard.sql}`,[actor.company_id,...guard.params]),
    stmt(db,`INSERT INTO users(user_id,company_id,username,email,password_hash,role,status) SELECT ?,company_id,employee_prefix || '-' || printf('%03d',next_employee_number-1),?,?,'employee','disabled' FROM companies WHERE company_id=? AND employee_prefix IS NOT NULL AND ${guard.sql}`,[userId,candidate.email,passwordHash,actor.company_id,...guard.params]),
    stmt(db,`INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,last_name,department,designation,status,profile) SELECT ?,company_id,user_id,username,?,?,?,?,'Inactive',? FROM users WHERE company_id=? AND user_id=? AND ${guard.sql}`,[employeeId,first,last,job.department,job.title,JSON.stringify(profile),actor.company_id,userId,...guard.params]),
    stmt(db,`INSERT INTO talent_records(company_id,collection,id,payload,created_at,updated_at) SELECT ?,'onboarding',?,?,?,? WHERE ${guard.sql}`,[actor.company_id,onboardingId,JSON.stringify(plan),now,now,...guard.params]),
    stmt(db,`UPDATE talent_records SET payload=json_set(payload,'$.hired_user_id',?,'$.hired_employee_id',?,'$.onboarding_id',?,'$.last_change_id',?),revision=revision+1,updated_at=? WHERE company_id=? AND collection='offers' AND id=? AND ${guard.sql}`,[userId,employeeId,onboardingId,changeId,now,actor.company_id,id,...guard.params]),
    stmt(db,`UPDATE talent_records SET payload=json_set(payload,'$.hired_count',(SELECT count(*) FROM talent_records c WHERE c.company_id=? AND c.collection='candidates' AND json_extract(c.payload,'$.job_id')=? AND json_extract(c.payload,'$.status')='Hired'),'$.status',CASE WHEN (SELECT count(*) FROM talent_records c WHERE c.company_id=? AND c.collection='candidates' AND json_extract(c.payload,'$.job_id')=? AND json_extract(c.payload,'$.status')='Hired')>=CAST(json_extract(payload,'$.positions') AS INTEGER) THEN 'Closed' ELSE 'Open' END,'$.last_change_id',?),revision=revision+1,updated_at=? WHERE company_id=? AND collection='jobs' AND id=? AND ${guard.sql}`,[actor.company_id,jobRow.id,actor.company_id,jobRow.id,changeId,now,actor.company_id,jobRow.id,...guard.params]),
    ...audit(db,actor,'candidates',candidateRow.id,candidate,now,changeId,'Hired'),...audit(db,actor,'offers',id,offer,now,changeId,'Hired',guard),...audit(db,actor,'jobs',jobRow.id,job,now,changeId,'Hiring updated',guard),...audit(db,actor,'onboarding',onboardingId,null,now,changeId,'Created',guard)
  ];
  if (reqRow) {
    writes.push(stmt(db,`UPDATE talent_records SET payload=json_set(payload,'$.status','Fulfilled','$.last_change_id',?),revision=revision+1,updated_at=? WHERE company_id=? AND collection='requisitions' AND id=? AND CAST(json_extract(payload,'$.positions') AS INTEGER)<=(SELECT count(*) FROM talent_records c JOIN talent_records j ON j.company_id=c.company_id AND j.collection='jobs' AND j.id=json_extract(c.payload,'$.job_id') WHERE c.company_id=? AND c.collection='candidates' AND json_extract(c.payload,'$.status')='Hired' AND json_extract(j.payload,'$.requisition_id')=?) AND ${guard.sql}`,[changeId,now,actor.company_id,reqRow.id,actor.company_id,reqRow.id,...guard.params]),...audit(db,actor,'requisitions',reqRow.id,parse(reqRow),now,changeId,'Fulfilled'));
  }
  await db.batch(writes);
  const saved = await record(db,actor.company_id,'offers',id);
  if (parse(saved).hired_user_id !== userId || !await stmt(db,'SELECT employee_id FROM employees WHERE company_id=? AND user_id=?',[actor.company_id,userId]).first()) fail('Hiring prerequisites changed. Refresh and review capacity before retrying.',409);
  return {offer:publicRecord(saved),userid:userId,employee_id:employeeId,onboarding_id:onboardingId};
}

export async function activateJoiner({db,actor,id,body,hashPassword,now=new Date().toISOString()}) {
  if ((actor.original_role || actor.role) !== 'company_admin') fail('Only a company administrator can activate a new joiner.',403);
  const row = await record(db,actor.company_id,'onboarding',id), plan = parse(row);
  if (!plan.source_offer_id) fail('This plan is not a recruitment-created joining plan.',409);
  const employee = await stmt(db,"SELECT e.*,u.status AS login_status FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND e.user_id=?",[actor.company_id,plan.employee_id]).first();
  if (!employee) fail('Employee not found.',404);
  const profile = JSON.parse(employee.profile);
  if (profile.recruitment_offer_id !== plan.source_offer_id) fail('The employee does not match this offer-created plan.',409);
  if (profile.onboarding_status === 'Joined') return {userid:employee.user_id,joined:true,record:publicRecord(row)};
  if (body.revision !== row.revision || plan.status === 'Cancelled' || plan.start_date > day(now)) fail('Refresh this plan. Activation is available on or after the joining date for active plans.',409);
  if (typeof body.temporary_password !== 'string' || body.temporary_password.length < 12 || body.temporary_password.length > 128) fail('Use a temporary password of 12 to 128 characters.');
  const passwordHash = await hashPassword(body.temporary_password), changeId = crypto.randomUUID();
  const guard = guardFor(actor.company_id,'onboarding',id,changeId);
  const next = {...plan,status:'In progress',joined_at:now,last_change_id:changeId};
  await db.batch([
    stmt(db,"UPDATE talent_records SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND collection='onboarding' AND id=? AND revision=? AND EXISTS(SELECT 1 FROM employees WHERE company_id=? AND user_id=? AND profile=?)",[JSON.stringify(next),now,actor.company_id,id,row.revision,actor.company_id,employee.user_id,employee.profile]),
    stmt(db,`UPDATE users SET status='active',password_hash=?,must_change_password=1 WHERE company_id=? AND user_id=? AND ${guard.sql}`,[passwordHash,actor.company_id,employee.user_id,...guard.params]),
    stmt(db,`UPDATE employees SET status='Active',profile=? WHERE company_id=? AND user_id=? AND ${guard.sql}`,[JSON.stringify({...profile,onboarding_status:'Joined',joined_at:now}),actor.company_id,employee.user_id,...guard.params]),
    ...audit(db,actor,'onboarding',id,plan,now,changeId,'Joined')
  ]);
  if (parse(await record(db,actor.company_id,'onboarding',id)).last_change_id !== changeId) fail('The plan or employee changed. Refresh before activating.',409);
  return {userid:employee.user_id,joined:true,record:publicRecord(await record(db,actor.company_id,'onboarding',id))};
}

// Bounded scheduled work. Public responses enforce expiry immediately, independently of cron.
export async function expireOffers(db,now=new Date().toISOString()) {
  const rows = (await stmt(db,"SELECT * FROM talent_records WHERE collection='offers' AND json_extract(payload,'$.status') IN ('Sent','Approved') AND json_extract(payload,'$.valid_until')<? ORDER BY updated_at,id LIMIT 100",[day(now)]).all()).results;
  for (const row of rows) {
    const offer = parse(row), changeId = crypto.randomUUID(), actor = {company_id:row.company_id,user_id:'automation'};
    const next = {...offer,status:'Expired',last_change_id:changeId};
    await db.batch([stmt(db,"UPDATE talent_records SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND collection='offers' AND id=? AND revision=?",[JSON.stringify(next),now,row.company_id,row.id,row.revision]),...audit(db,actor,'offers',row.id,offer,now,changeId,'Expired')]);
  }
  return {checked:rows.length};
}
