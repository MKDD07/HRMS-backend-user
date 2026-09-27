import { emptyConfiguration, validateConfiguration, resolveRoute, activeApprovers, decide, REQUEST_TYPES } from '../shared/workflowModel.mjs';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const stmt = (db, sql, params = []) => db.prepare(sql).bind(...params);
const all = async (db, sql, params = []) => (await stmt(db, sql, params).all()).results;
const json = value => JSON.stringify(value);
const admin = actor => { if (actor.role !== 'company_admin') fail('Company administrator access required.', 403); };
const date = value => { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail('Use a valid date.'); return value; };
export async function workflowPeople(db, company) {
  const people = await all(db, `SELECT u.user_id AS id,u.status AS account_status,u.username,e.employee_id,e.employee_code,e.first_name,e.last_name,e.department,e.designation,e.status,e.profile
    FROM users u
    LEFT JOIN employees e ON e.company_id=u.company_id AND e.user_id=u.user_id
    WHERE u.company_id=? AND u.status='active'
    ORDER BY COALESCE(e.first_name, u.username), e.employee_id`, [company]);
  return people.map(person => {
    let parsed = {};
    try { parsed = typeof person.profile === 'string' ? JSON.parse(person.profile || '{}') : (person.profile || {}); } catch {}
    const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.username || person.employee_code || person.id;
    return {
      ...person,
      id: person.id,
      userid: person.id,
      name,
      first_name: person.first_name || person.username,
      department: person.department || 'General',
      designation: person.designation || (person.role === 'company_admin' ? 'Company Admin' : 'Team Member'),
      location: parsed.location || '',
      profile_pic_url: parsed.profile_pic_url || ''
    };
  });
}
export async function workflowConfig(db, company) {
  const row = await stmt(db, 'SELECT * FROM workflow_configuration WHERE company_id=?', [company]).first();
  return { configuration: row ? JSON.parse(row.payload) : emptyConfiguration(), revision: row?.revision || 0, savedAt: row?.updated_at || null };
}
function audit(db, company, actor, request, action, details, time) {
  return stmt(db, 'INSERT INTO workflow_audit(audit_id,company_id,request_id,actor_id,action,details,created_at) VALUES(?,?,?,?,?,?,?)', [crypto.randomUUID(), company, request, actor, action, json(details), time]);
}
function notification(db, company, request, recipient, title, time) {
  return stmt(db, 'INSERT INTO workflow_notifications(notification_id,company_id,recipient_id,request_id,title,created_at) VALUES(?,?,?,?,?,?)', [crypto.randomUUID(), company, recipient, request, title, time]);
}
export async function createWorkflow(db, actor, input, sourceStatements = []) {
  if (!REQUEST_TYPES.includes(input.kind)) fail('Unsupported request type.');
  const requester = input.requester || actor.user_id;
  if (actor.role !== 'company_admin' && requester !== actor.user_id) fail('You can submit only your own requests.', 403);
  const people = await workflowPeople(db, actor.company_id);
  const person = people.find(person => person.id === requester);
  if (!person || person.status === 'Inactive' || person.account_status !== 'active') fail('Active employee not found.', 404);
  const payload = input.payload || {};
  if (typeof payload.reason !== 'string' || !payload.reason.trim() || payload.reason.length > 2000) fail('Provide a reason (up to 2000 characters).');
  if (input.kind === 'leave') { date(payload.start_date); date(payload.end_date); if (payload.end_date < payload.start_date) fail('End date precedes start date.'); }
  if (input.kind === 'attendance') {
    date(payload.date);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.check_in) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.check_out) || payload.check_out <= payload.check_in) fail('Enter valid check-in and check-out times on the same day.');
    if (!/^(Z|[+-](0\d|1[0-4]):[0-5]\d)$/.test(payload.timezone || '')) fail('Provide a timezone offset.');
  }
  const time = new Date().toISOString();
  const config = await workflowConfig(db, actor.company_id);
  const days = input.kind === 'leave' ? (Date.parse(payload.end_date) - Date.parse(payload.start_date)) / 86400000 + 1 : 0;
  const route = resolveRoute(config.configuration, people, { requester, kind: input.kind, days }, time);
  route.configRevision = config.revision;
  const id = crypto.randomUUID(), status = route.blocked ? 'Blocked' : 'Pending';
  const statements = [...sourceStatements, stmt(db, 'INSERT INTO workflow_requests(request_id,company_id,requester_id,kind,source_id,status,payload,route,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [id,actor.company_id,requester,input.kind,input.sourceId || null,status,json({ ...payload, requesterName: person.name, employee_id: person.employee_id, days }),json(route),time,time]), audit(db,actor.company_id,actor.user_id,id,'submitted',{ status, configRevision: config.revision },time)];
  const recipients = route.blocked ? [] : [...activeApprovers(route), ...route.participants.filter(p => p.role !== 'approver')].map(p => p.userId);
  recipients.push(requester);
  if (route.blocked) {
    const admins = await all(db, "SELECT user_id FROM users WHERE company_id=? AND role='company_admin' AND status='active'", [actor.company_id]);
    recipients.push(...admins.map(user => user.user_id));
  }
  for (const user of new Set(recipients)) statements.push(notification(db,actor.company_id,id,user,route.blocked ? 'Request needs routing' : 'New request submitted',time));
  await db.batch(statements);
  return { request_id: id, status, routing_issue: route.blocked || null };
}
// Every side effect uses the same revision guard. D1 batch commits them atomically.
async function updateRequest(db, actor, record, route, status, action, details, additional = []) {
  const time = new Date().toISOString();
  const guard = 'EXISTS(SELECT 1 FROM workflow_requests WHERE company_id=? AND request_id=? AND revision=?)';
  const params = [record.company_id,record.request_id,record.revision];
  const statements = additional.map(({sql,values}) => stmt(db,sql.replace('/*guard*/',guard),[...values,...params]));
  statements.push(stmt(db, `INSERT INTO workflow_audit(audit_id,company_id,request_id,actor_id,action,details,created_at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`, [crypto.randomUUID(),record.company_id,record.request_id,actor?.user_id || null,action,json(details),time,...params]));
  const recipients = new Set([record.requester_id,...route.participants.filter(p => p.role !== 'approver' || status !== 'Pending').map(p => p.userId),...(status === 'Pending' ? activeApprovers(route).map(p => p.userId) : [])]);
  for (const user of recipients) statements.push(stmt(db, `INSERT INTO workflow_notifications(notification_id,company_id,recipient_id,request_id,title,created_at) SELECT ?,?,?,?,?,? WHERE ${guard}`, [crypto.randomUUID(),record.company_id,user,record.request_id,action === 'reminder' ? 'Approval reminder' : action === 'escalated' ? 'Approval escalated' : 'Request updated',time,...params]));
  statements.push(stmt(db, 'UPDATE workflow_requests SET route=?,status=?,revision=revision+1,updated_at=? WHERE company_id=? AND request_id=? AND revision=?', [json(route),status,time,...params]));
  const results = await db.batch(statements);
  const last = results[results.length-1];
  if ((last?.meta?.changes ?? last?.changes ?? 0) !== 1) fail('This request changed. Refresh and try again.',409);
  return { request_id: record.request_id, status };
}
export async function reviewWorkflow(db, actor, requestId, decision, remarks = '') {
  const record = await stmt(db,'SELECT * FROM workflow_requests WHERE company_id=? AND request_id=?',[actor.company_id,requestId]).first();
  if (!record) fail('Request not found.',404);
  if (record.status !== 'Pending') fail('This request is not awaiting approval.',409);
  if (record.requester_id === actor.user_id) fail('You cannot approve your own request.',403);
  let next;
  try { next = decide(JSON.parse(record.route),actor.user_id,decision,new Date().toISOString()); } catch (error) { fail(error.message,403); }
  if (next.status === 'Pending') {
    const before = activeApprovers(JSON.parse(record.route)).map(p => p.userId).sort().join(',');
    const after = activeApprovers(next.route).map(p => p.userId).sort().join(',');
    if (before !== after) { next.route.resolvedAt = new Date().toISOString(); next.route.reminderSentAt = null; next.route.escalatedAt = null; }
  }
  const additional = [];
  if (next.status !== 'Pending' && record.kind === 'leave' && record.source_id) additional.push({ sql: 'UPDATE leave_requests SET status=?,reviewed_by=? WHERE company_id=? AND leave_id=? AND /*guard*/', values:[next.status,actor.user_id,actor.company_id,record.source_id] });
  if (next.status === 'Approved' && record.kind === 'attendance') {
    const payload = JSON.parse(record.payload);
    const checkIn = new Date(`${payload.date}T${payload.check_in}:00${payload.timezone}`).toISOString();
    const checkOut = new Date(`${payload.date}T${payload.check_out}:00${payload.timezone}`).toISOString();
    additional.push({ sql:'INSERT INTO attendance(attendance_id,company_id,employee_id,date,check_in_time,check_out_time) SELECT ?,?,?,?,?,? WHERE /*guard*/ ON CONFLICT(company_id,employee_id,date) DO UPDATE SET check_in_time=excluded.check_in_time,check_out_time=excluded.check_out_time',values:[crypto.randomUUID(),actor.company_id,payload.employee_id,payload.date,checkIn,checkOut] });
  }
  return updateRequest(db,actor,record,next.route,next.status,'decision',{decision,remarks:String(remarks).slice(0,2000)},additional);
}
function publicRequest(record, actor) {
  const route = JSON.parse(record.route), payload = JSON.parse(record.payload);
  const role = route.participants.find(person => person.userId === actor.user_id)?.role;
  const privileged = actor.role === 'company_admin' || record.requester_id === actor.user_id || role === 'approver' || role === 'reviewer';
  return { ...record, payload: privileged ? payload : { requesterName: payload.requesterName, ...(record.kind === 'leave' ? { start_date: payload.start_date, end_date: payload.end_date } : {}) }, route: privileged ? route : { participants: [], policy: { name: route.policy?.name }, blocked: Boolean(route.blocked) }, canApprove: record.status === 'Pending' && record.requester_id !== actor.user_id && activeApprovers(route).some(person => person.userId === actor.user_id), role: role || (record.requester_id === actor.user_id ? 'requester' : 'administrator') };
}
export async function workflowHandle({ db, actor, path, method, url, body }) {
  if (!path.startsWith('/api/v1/workflows/')) return undefined;
  const section = path.slice('/api/v1/workflows/'.length);
  if (section === 'configuration') {
    admin(actor);
    if (method === 'GET') return workflowConfig(db,actor.company_id);
    if (method === 'POST') {
      const config = body.configuration, people = await workflowPeople(db,actor.company_id);
      const issue = validateConfiguration(config,people); if (issue) fail(issue);
      const current = await workflowConfig(db,actor.company_id);
      if (body.revision !== current.revision) fail('The configuration changed. Reload before saving.',409);
      const now = new Date().toISOString(), nextRevision = current.revision + 1;
      const changes = { revision: nextRevision, before: current.configuration, after: config };
      if (!current.revision) await db.batch([stmt(db,'INSERT INTO workflow_configuration(company_id,payload,revision,updated_at) VALUES(?,?,?,?)',[actor.company_id,json(config),nextRevision,now]),audit(db,actor.company_id,actor.user_id,null,'configuration-published',changes,now)]);
      else {
        const results = await db.batch([
          stmt(db,'INSERT INTO workflow_audit(audit_id,company_id,actor_id,action,details,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM workflow_configuration WHERE company_id=? AND revision=?)',[crypto.randomUUID(),actor.company_id,actor.user_id,'configuration-published',json(changes),now,actor.company_id,current.revision]),
          stmt(db,'UPDATE workflow_configuration SET payload=?,revision=?,updated_at=? WHERE company_id=? AND revision=?',[json(config),nextRevision,now,actor.company_id,current.revision])
        ]);
        if ((results[1]?.meta?.changes ?? results[1]?.changes ?? 0) !== 1) fail('The configuration changed. Reload before saving.',409);
      }
      return { revision: nextRevision, savedAt: now };
    }
  }
  if (section === 'directory' && method === 'GET') { return workflowPeople(db,actor.company_id); }
  if (section === 'preview' && method === 'POST') {
    admin(actor); const people = await workflowPeople(db,actor.company_id), config = body.configuration || (await workflowConfig(db,actor.company_id)).configuration;
    const issue = validateConfiguration(config,people); if (issue) fail(issue);
    return resolveRoute(config,people,{requester:body.requester,kind:body.kind,days:Number(body.days)||1});
  }
  if (section === 'requests' && method === 'POST') {
    if (!['attendance','expense','other'].includes(body.kind)) fail('Submit leave through the leave application endpoint.');
    return createWorkflow(db,actor,{kind:body.kind,requester:body.requester,payload:body.payload});
  }
  if (section === 'requests' && method === 'GET') {
    const offset = Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0));
    const view = url.searchParams.get('view') || 'mine';
    if (!['mine','approvals','following','all'].includes(view)) fail('Invalid inbox view.');
    let where = '', params = [actor.company_id];
    if (view === 'all') admin(actor);
    else if (view === 'mine') { where = 'AND requester_id=?'; params.push(actor.user_id); }
    else { where = `AND EXISTS(SELECT 1 FROM json_each(workflow_requests.route,'$.participants') p WHERE json_extract(p.value,'$.userId')=? AND ${view === 'approvals' ? "json_extract(p.value,'$.role')='approver'" : "json_extract(p.value,'$.role') IN ('cc','reviewer')"})`; params.push(actor.user_id); }
    const requests = await all(db,`SELECT * FROM workflow_requests WHERE company_id=? ${where} ORDER BY created_at DESC,request_id LIMIT 100 OFFSET ?`,[...params,offset]);
    return requests.map(record => publicRequest(record,actor));
  }
  const review = section.match(/^requests\/([^/]+)\/decision$/);
  if (review && method === 'POST') return reviewWorkflow(db,actor,review[1],body.decision,body.remarks);
  const reassign = section.match(/^requests\/([^/]+)\/reassign$/);
  if (reassign && method === 'POST') {
    admin(actor);
    if (typeof body.reason !== 'string' || !body.reason.trim()) fail('A reassignment reason is required.');
    const record = await stmt(db,'SELECT * FROM workflow_requests WHERE company_id=? AND request_id=?',[actor.company_id,reassign[1]]).first();
    if (!record || !['Pending','Blocked'].includes(record.status)) fail('Open request not found.',404);
    if (body.userId === record.requester_id) fail('An employee cannot approve their own request.');
    const people = await workflowPeople(db,actor.company_id), person = people.find(p => p.id === body.userId && p.account_status === 'active' && p.status !== 'Inactive');
    if (!person) fail('Choose an active employee in this company.');
    const route = JSON.parse(record.route);
    const pending = activeApprovers(route);
    const outgoing = pending.find(p => p.userId === body.fromUserId);
    if (record.status === 'Pending' && !outgoing) fail('Choose the current approver to replace.');
    if (route.participants.some(p => p.userId === body.userId && p.role === 'approver' && p !== outgoing)) fail('This person is already assigned.');
    route.participants = route.participants.filter(p => p.userId !== body.userId || p.role === 'approver');
    if (outgoing) outgoing.userId = person.id, outgoing.name = person.name;
    else route.participants.push({userId:person.id,name:person.name,role:'approver',step:1,decision:'Pending'});
    delete route.blocked;
    route.policy ||= { mode:'any',name:'Administrator assignment',reminderHours:24,escalationHours:48 };
    route.reminderSentAt = null; route.escalatedAt = null; route.resolvedAt = new Date().toISOString();
    return updateRequest(db,actor,record,route,'Pending','reassigned',{from:body.fromUserId || null,to:body.userId,reason:body.reason.slice(0,2000)});
  }
  if (section === 'notifications' && method === 'GET') {
    const list = await all(db,'SELECT n.*,r.status,r.kind,r.requester_id,r.payload,r.route FROM workflow_notifications n JOIN workflow_requests r ON r.company_id=n.company_id AND r.request_id=n.request_id WHERE n.company_id=? AND n.recipient_id=? ORDER BY n.created_at DESC LIMIT 100',[actor.company_id,actor.user_id]);
    return list.map(item => ({id:item.notification_id,requestId:item.request_id,title:item.title,message:`${JSON.parse(item.payload).requesterName} · ${item.kind} · ${item.status}`,timestamp:item.created_at,timeAgo:new Date(item.created_at).toLocaleDateString(),unread:Boolean(item.unread),category:'Approvals',approved:item.status === 'Approved',canApprove:item.status === 'Pending' && item.requester_id !== actor.user_id && activeApprovers(JSON.parse(item.route)).some(p => p.userId === actor.user_id)}));
  }
  if (section === 'notifications/read' && method === 'POST') {
    await stmt(db,`UPDATE workflow_notifications SET unread=0 WHERE company_id=? AND recipient_id=? ${body.id ? 'AND notification_id=?' : ''}`,[actor.company_id,actor.user_id,...(body.id ? [body.id] : [])]).run(); return {saved:true};
  }
  if (section === 'audit' && method === 'GET') {
    admin(actor); const offset = Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0));
    return all(db,'SELECT * FROM workflow_audit WHERE company_id=? ORDER BY created_at DESC,audit_id LIMIT 100 OFFSET ?',[actor.company_id,offset]);
  }
  fail('Workflow route not found.',404);
}
export async function processWorkflowTimers(db, now = new Date().toISOString()) {
  const requests = await all(db,"SELECT * FROM workflow_requests WHERE status='Pending' ORDER BY updated_at,request_id");
  for (const record of requests) {
    const route = JSON.parse(record.route), age = (Date.parse(now)-Date.parse(route.resolvedAt))/3600000;
    let action;
    if (age >= route.policy.escalationHours && !route.escalatedAt && route.policy.escalationUser) {
      const people = await workflowPeople(db,record.company_id), recipient = people.find(p => p.id === route.policy.escalationUser && p.account_status === 'active' && p.status !== 'Inactive');
      if (!recipient || recipient.id === record.requester_id) continue;
      const current = activeApprovers(route);
      if (!current.length || route.participants.some(p => p.userId === recipient.id && p.role === 'approver')) continue;
      const nextStep = Math.min(...current.map(p => p.step));
      for (const p of current) p.decision = 'Escalated';
      route.participants = route.participants.filter(p => p.userId !== recipient.id);
      route.participants.push({userId:recipient.id,name:recipient.name,role:'approver',step:nextStep,decision:'Pending'});
      route.escalatedAt = now; action = 'escalated';
    } else if (age >= route.policy.reminderHours && !route.reminderSentAt) { route.reminderSentAt = now; action = 'reminder'; }
    if (action) { try { await updateRequest(db,null,record,route,'Pending',action,{scheduledAt:now}); } catch (error) { if (error.status !== 409) throw error; } }
  }
}
