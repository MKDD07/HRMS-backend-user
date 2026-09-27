import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './index.mjs';
import { emptyConfiguration, defaultResponsibilities } from '../shared/workflowModel.mjs';
import { processWorkflowTimers } from './workflows.mjs';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec(readFileSync(new URL('../migrations/hrms/0001_core.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0002_employee_codes.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0003_company_branding.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0004_approval_workflows.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0005_hr_connect.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0006_dashboard_access.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0007_billing.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0008_holiday_cache.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0009_talent_operations.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/hrms/0010_asset_issues.sql', import.meta.url), 'utf8'));
function prepare(sql, params = []) {
  return {
    bind(...values) { return prepare(sql, values); },
    async first() { return sqlite.prepare(sql).get(...params) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...params) }; },
    async run() { return sqlite.prepare(sql).run(...params); }
  };
}
const objects = new Map();
let batchQueue = Promise.resolve();
const env = {
  DB: { prepare, batch(statements) {
    const operation = batchQueue.then(async () => {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    });
    batchQueue = operation.catch(() => {});
    return operation;
  } },
  OWNER_PROVISIONING_TOKEN: 'owner-secret-for-test-only',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  HRMS_DOCUMENTS: { async put(key, bytes) { objects.set(key, bytes); }, async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; }, async delete(key) { objects.delete(key); } }
};
async function call(path, { token, body, method = body ? 'POST' : 'GET', status = 200, origin } = {}) {
  const response = await worker.fetch(new Request('https://hrms.test/api/v1' + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
  const payload = await response.json(); assert.equal(response.status, status, JSON.stringify(payload)); return payload.data;
}
const password = 'Initial-password-2026';
const changed = 'New!26';
async function login(username, password) { return call('/login', { body: { username, password } }); }
async function activate(username) {
  const initial = await login(username, password);
  await call('/get-all-users', { token: initial.token, status: 403 });
  await call('/change-password', { token: initial.token, body: { current_password: password, new_password: 'Ab!12' }, status: 400 });
  await call('/change-password', { token: initial.token, body: { current_password: password, new_password: changed } });
  await call('/auth/verify', { token: initial.token, status: 401 });
  return login(username, changed);
}
try {
  await call('/platform/companies', { body: { company_name: 'A', username: 'admin-a', password }, status: 403 });
  const a = await call('/platform/companies', { token: env.OWNER_PROVISIONING_TOKEN, body: { company_name: 'A', username: 'admin-a', password } });
  const b = await call('/platform/companies', { token: env.OWNER_PROVISIONING_TOKEN, body: { company_name: 'B', username: 'admin-b', password } });
  await call('/platform/companies', { token: env.OWNER_PROVISIONING_TOKEN, body: { company_name: 'Duplicate', username: 'admin-a', password }, status: 409 });
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM companies').get().n, 2, 'Provisioning rollback must not leave an orphan company');
  const adminA = await activate('admin-a'), adminB = await activate('admin-b');
  const billingOverview = await call('/billing/overview', { token: adminA.token });
  assert.equal(billingOverview.plans.length, 4, 'Authenticated billing route must be registered');
  assert.equal(billingOverview.checkoutEnabled, false);
  await call('/billing/orders', { token: adminA.token, body: { plan_id: 'starter' }, status: 503 });
  await call('/dashboard-configuration/settings', { token: adminA.token });
  await call(`/platform/companies/${a.company_id}/branding`, { token: adminA.token, body: { welcome_text: 'Wrong owner' }, status: 403 });
  await call(`/platform/companies/${a.company_id}/branding`, { token: env.OWNER_PROVISIONING_TOKEN, body: { welcome_text: 'Welcome to our team.' } });
  assert.equal((await call(`/branding/${a.company_id}`)).welcome_text, 'Welcome to our team.');
  const employee = await call('/create-user', { token: adminA.token, body: { username: 'employee-a', password, first_name: 'Alice', company_id: b.company_id, role: 'company_admin', profile: { qualifications: ['Degree'] } } });
  assert.equal(employee.company_id, a.company_id);
  assert.equal(employee.employee_code, 'A-001');
  const employeeA = await activate(employee.username);
  assert.equal(employeeA.role, 'employee');
  await call('/create-user', { token: employeeA.token, body: { username: 'intruder', password, first_name: 'No' }, status: 403 });
  await call('/get-user?userid=' + employee.user_id, { token: adminB.token, status: 404 });
  assert.equal((await call('/get-all-users', { token: adminB.token })).length, 0);
  assert.equal((await call('/get-all-users', { token: adminA.token })).length, 1);
  const collision = await call('/platform/companies', { token: env.OWNER_PROVISIONING_TOKEN, body: { company_name: 'A', username: 'admin-c', password } });
  assert.equal(collision.employee_prefix, 'A2');
  const concurrent = await Promise.all(Array.from({ length: 3 }, (_, i) => call('/create-user', { token: adminA.token, body: { password, first_name: 'Concurrent ' + i, email: `employee${i}@example.test` } })));
  assert.deepEqual(concurrent.map(e => e.employee_code).sort(), ['A-002', 'A-003', 'A-004']);
  await call('/create-user', { token: adminA.token, body: { password, first_name: 'Duplicate', email: 'employee0@example.test' }, status: 409 });
  const next = await call('/create-user', { token: adminA.token, body: { password, first_name: 'Next' } });
  assert.equal(next.employee_code, 'A-005', 'Failed creation rolls back the counter');
  sqlite.prepare('UPDATE companies SET name=? WHERE company_id=?').run('Renamed Company', a.company_id);
  assert.equal(sqlite.prepare('SELECT employee_prefix FROM companies WHERE company_id=?').get(a.company_id).employee_prefix, 'A');
  assert.equal(JSON.stringify(await call('/get-user', { token: employeeA.token })).includes('password_hash'), false);
  assert.throws(() => sqlite.prepare('INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name) VALUES(?,?,?,?,?)').run('bad', b.company_id, employee.user_id, 'bad', 'Bad'), /constraint/i);
  sqlite.prepare('INSERT INTO company_holiday_cache(company_id,country,year,holidays) VALUES(?,?,?,?)').run(a.company_id, 'IN', 2026, '[]');
  const cached = await call('/company-calendar/holiday-cache', { token: adminA.token, body: { country: 'IN', year: 2026, company_id: b.company_id } });
  assert.equal(cached.source, 'database');
  assert.deepEqual(cached.holidays, []);
  await call('/company-calendar/holiday-cache', { token: employeeA.token, body: { country: 'IN', year: 2026 }, status: 403 });
  const talentJob = await call('/talent/jobs', { token: adminA.token, body: { title: 'Support specialist', department: 'Support', positions: 1, status: 'Open' } });
  assert.equal((await call('/talent/jobs', { token: adminB.token })).length, 0);
  await call('/talent/jobs', { token: employeeA.token, status: 403 });
  await call('/talent/jobs/' + talentJob.id, { token: adminB.token, body: { ...talentJob, title: 'Other tenant' }, status: 404 });
  await call('/company-calendar/holidays', { token: adminA.token, body: { name: 'Holiday', date: '2026-10-01' } });
  assert.equal((await call('/company-calendar/configuration', { token: adminB.token })).holidays.length, 0);
  await call('/company-calendar/holidays', { token: adminA.token, body: { name: 'Invalid', date: '2026-02-30' }, status: 400 });
  await call('/attendance', { token: employeeA.token, body: { action: 'check-in' } });
  await call('/attendance', { token: employeeA.token, body: { action: 'check-in' }, status: 409 });
  await call('/attendance', { token: employeeA.token, body: { action: 'check-out' } });
  assert.equal((await call('/get-attendance', { token: adminB.token })).length, 0);
  const leave = await call('/apply-leave', { token: employeeA.token, body: { leave_type: 'Casual', start_date: '2026-10-01', end_date: '2026-10-02', reason: 'Personal' } });
  await call('/review-leave', { token: adminB.token, body: { leave_id: leave.leave_id, status: 'Approved' }, status: 404 });
  await call('/review-leave', { token: adminA.token, body: { leave_id: leave.leave_id, status: 'Approved' }, status: 409 });
  assert.equal(leave.workflow.status, 'Blocked');

  // Workflow integration: real roles, tenant boundaries, snapshots and persistence.
  const manager1 = await activate(concurrent[0].username);
  const manager2 = await activate(concurrent[1].username);
  const cc = await activate(concurrent[2].username);
  const ids = [employee.user_id,concurrent[0].user_id,concurrent[1].user_id,concurrent[2].user_id];
  const config = emptyConfiguration();
  config.nodes = ids.map((id,index) => ({id,position:{x:index*280,y:0}}));
  config.links = ids.slice(1).map((manager,index) => ({id:'link-'+index,manager,employee:employee.user_id,type:index===0?'direct':'indirect',responsibilities:{...defaultResponsibilities(),leave:{enabled:true,role:index===2?'cc':'approver',step:index+1,backup:'',unavailable:false,from:'',until:''},attendance:{enabled:true,role:index===2?'cc':'approver',step:1,backup:'',unavailable:false,from:'',until:''}}}));
  config.policies[0].mode = 'sequential';
  config.policies[0].escalationUser = next.user_id;
  await call('/workflows/configuration',{token:employeeA.token,body:{configuration:config,revision:0},status:403});
  const published = await call('/workflows/configuration',{token:adminA.token,body:{configuration:config,revision:0}});
  assert.equal(published.revision,1);
  await call('/workflows/configuration',{token:adminA.token,body:{configuration:config,revision:0},status:409});
  assert.equal((await call('/workflows/configuration',{token:adminB.token})).configuration.links.length,0);
  const preview = await call('/workflows/preview',{token:adminA.token,body:{requester:employee.user_id,kind:'leave',days:2}});
  assert.equal(preview.participants.length,3);
  const routed = await call('/apply-leave',{token:employeeA.token,body:{leave_type:'Casual',start_date:'2026-10-03',end_date:'2026-10-04',reason:'Private medical detail'}});
  assert.equal(routed.workflow.status,'Pending');
  const requestId = routed.workflow.request_id;
  const following = await call('/workflows/requests?view=following',{token:cc.token});
  assert.equal(following[0].payload.reason,undefined);
  assert.equal(following[0].canApprove,false);
  await call('/workflows/requests/'+requestId+'/decision',{token:cc.token,body:{decision:'Approved'},status:403});
  await call('/workflows/requests/'+requestId+'/decision',{token:manager2.token,body:{decision:'Approved'},status:403});
  await call('/workflows/requests/'+requestId+'/decision',{token:employeeA.token,body:{decision:'Approved'},status:403});
  await call('/workflows/requests/'+requestId+'/decision',{token:adminB.token,body:{decision:'Approved'},status:404});
  const firstDecision = await call('/workflows/requests/'+requestId+'/decision',{token:manager1.token,body:{decision:'Approved'}});
  assert.equal(firstDecision.status,'Pending');
  const disabled = structuredClone(config); disabled.links.forEach(link => {link.responsibilities.leave.enabled=false;});
  await call('/workflows/configuration',{token:adminA.token,body:{configuration:disabled,revision:1}});
  const finalDecision = await call('/review-leave',{token:manager2.token,body:{leave_id:routed.leave_id,status:'Approved'}});
  assert.equal(finalDecision.status,'Approved','Already-submitted requests retain their route');
  assert.equal(sqlite.prepare('SELECT status FROM leave_requests WHERE leave_id=?').get(routed.leave_id).status,'Approved');
  await call('/workflows/requests/'+requestId+'/decision',{token:manager2.token,body:{decision:'Approved'},status:409});
  const blocked = await call('/apply-leave',{token:employeeA.token,body:{leave_type:'Casual',start_date:'2026-11-01',end_date:'2026-11-02',reason:'Personal'}});
  assert.equal(blocked.workflow.status,'Blocked');
  await call('/workflows/requests/'+blocked.workflow.request_id+'/reassign',{token:adminA.token,body:{userId:employee.user_id,reason:'Self'},status:400});
  await call('/workflows/requests/'+blocked.workflow.request_id+'/reassign',{token:adminA.token,body:{userId:manager1.user_id,reason:'Missing route resolved'}});
  await call('/workflows/requests/'+blocked.workflow.request_id+'/decision',{token:manager1.token,body:{decision:'Approved'}});
  const correction = await call('/workflows/requests',{token:employeeA.token,body:{kind:'attendance',payload:{reason:'Missed punch',date:'2026-09-01',check_in:'09:00',check_out:'18:00',timezone:'+05:30'}}});
  await call('/workflows/requests/'+correction.request_id+'/decision',{token:manager1.token,body:{decision:'Approved'}});
  const attendanceRow=sqlite.prepare("SELECT * FROM attendance WHERE employee_id=? AND date='2026-09-01'").get(employee.employee_id);
  assert.equal(attendanceRow.check_in_time,'2026-09-01T03:30:00.000Z');
  assert.equal((await call('/workflows/notifications',{token:adminB.token})).length,0);

  // Simultaneous decisions commit exactly one set of side effects.
  const racing=await call('/workflows/requests',{token:employeeA.token,body:{kind:'attendance',payload:{reason:'Correct a second day',date:'2026-09-02',check_in:'09:00',check_out:'18:00',timezone:'+05:30'}}});
  const responses=await Promise.all([[manager1.token,'Approved'],[manager2.token,'Rejected']].map(([token,decision])=>worker.fetch(new Request('https://hrms.test/api/v1/workflows/requests/'+racing.request_id+'/decision',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({decision,remarks:'Concurrent test'})}),env)));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM workflow_audit WHERE request_id=? AND action='decision'").get(racing.request_id).count,1);
  const finalRace=sqlite.prepare('SELECT status FROM workflow_requests WHERE request_id=?').get(racing.request_id).status;
  assert.equal(Boolean(sqlite.prepare("SELECT 1 FROM attendance WHERE employee_id=? AND date='2026-09-02'").get(employee.employee_id)),finalRace==='Approved');
  const ccNotifications=await call('/workflows/notifications',{token:cc.token});
  assert.ok(ccNotifications.length>0);assert.ok(ccNotifications.every(n=>!n.canApprove));
  assert.ok(!JSON.stringify(ccNotifications).includes('Private medical detail'));
  await call('/workflows/notifications/read',{token:manager1.token,body:{id:ccNotifications[0].id}});
  assert.equal((await call('/workflows/notifications',{token:cc.token}))[0].unread,true);
  // Timer writes are idempotent and escalation does not bypass remaining steps.
  await call('/workflows/configuration',{token:adminA.token,body:{configuration:config,revision:2}});
  const timed=await call('/apply-leave',{token:employeeA.token,body:{leave_type:'Casual',start_date:'2026-12-01',end_date:'2026-12-02',reason:'Personal'}});
  const base=Date.now();
  await processWorkflowTimers(env.DB,new Date(base+25*3600000).toISOString());
  const reminderCount=sqlite.prepare("SELECT COUNT(*) AS count FROM workflow_audit WHERE request_id=? AND action='reminder'").get(timed.workflow.request_id).count;
  await processWorkflowTimers(env.DB,new Date(base+26*3600000).toISOString());
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM workflow_audit WHERE request_id=? AND action='reminder'").get(timed.workflow.request_id).count,reminderCount);
  await processWorkflowTimers(env.DB,new Date(base+49*3600000).toISOString());
  const escalationRoute=JSON.parse(sqlite.prepare('SELECT route FROM workflow_requests WHERE request_id=?').get(timed.workflow.request_id).route);
  assert.ok(escalationRoute.participants.some(p=>p.userId===next.user_id&&p.decision==='Pending'));
  assert.ok((await call('/workflows/audit',{token:adminA.token})).some(entry=>entry.action==='configuration-published'));
  await call('/workflows/audit',{token:employeeA.token,status:403});
  await call('/add-salary', { token: adminA.token, body: { employee_id: employee.employee_id, period: '2026-09', gross_minor: 100000, deductions_minor: 1000 } });
  assert.equal((await call('/get-salary', { token: adminB.token })).length, 0);
  const uploaded = await worker.fetch(new Request('https://hrms.test/api/v1/documents?title=Contract&employee_id=' + employee.employee_id, { method: 'POST', headers: { Authorization: 'Bearer ' + adminA.token }, body: 'test document' }), env);
  assert.equal(uploaded.status, 200); const doc = (await uploaded.json()).data;
  await call(`/documents/${doc.document_id}/download`, { token: adminB.token, status: 404 });
  const download = await worker.fetch(new Request(`https://hrms.test/api/v1/documents/${doc.document_id}/download`, { headers: { Authorization: 'Bearer ' + employeeA.token } }), env);
  assert.equal(await download.text(), 'test document');
  assert.ok([...objects.keys()][0].startsWith(`companies/${a.company_id}/`));
  // Delegated dashboard accounts: first-login setup, tenant isolation, permissions and DB-enforced limits.
  const dashboardBody = (person, username) => ({ employee_id: person.employee_id, username, password, dashboard_access: true, dashboard_pages: ['documents', 'shifts'] });
  await call('/dashboard-users', { token: employeeA.token, status: 403 });
  await call('/dashboard-users', { token: adminB.token, body: dashboardBody(concurrent[0], 'delegate-one'), status: 404 });
  await call('/dashboard-users', { token: adminA.token, body: dashboardBody(concurrent[0], 'delegate-one') });
  const initialDelegate = await login('delegate-one', password);
  assert.equal(initialDelegate.dashboard_access, true);
  assert.equal(initialDelegate.must_change_password, true);
  await call('/documents?scope=policies', { token: initialDelegate.token, status: 403 });
  await call('/change-password', { token: initialDelegate.token, body: { current_password: password, new_password: changed } });
  const delegate = await login('delegate-one', changed);
  assert.deepEqual(delegate.dashboard_pages, ['documents', 'shifts']);
  await call('/documents?scope=policies', { token: delegate.token });
  await call('/talent/jobs', { token: delegate.token, status: 403 });
  await call('/get-salary', { token: delegate.token, status: 403 });
  await call('/dashboard-users', { token: delegate.token, status: 403 });
  await call('/dashboard-configuration/settings', { token: delegate.token, body: { revision: 0, value: {} }, status: 403 });
  const shiftConfig = await call('/dashboard-configuration/shifts', { token: delegate.token, body: { revision: 0, value: [] } });
  assert.equal(shiftConfig.revision, 1);
  await call('/dashboard-configuration/shifts', { token: delegate.token, body: { revision: 0, value: [] }, status: 409 });
  const candidates = [concurrent[1], concurrent[2], next];
  const attempts = await Promise.all(candidates.map((person, i) => worker.fetch(new Request('https://hrms.test/api/v1/dashboard-users', { method: 'POST', headers: { Authorization: 'Bearer ' + adminA.token, 'Content-Type': 'application/json' }, body: JSON.stringify(dashboardBody(person, 'delegate-extra-' + i)) }), env)));
  assert.deepEqual(attempts.map(r => r.status).sort(), [200,200,409]);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM employees WHERE company_id=? AND dashboard_access=1').get(a.company_id).n, 3);
  await call('/dashboard-users', { token: adminA.token, body: { employee_id: concurrent[0].employee_id, username: 'delegate-one', dashboard_access: false, dashboard_pages: [] } });
  await call('/auth/verify', { token: delegate.token, status: 401 });
  assert.equal((await login('delegate-one', changed)).dashboard_access, false);
  const photo = await call('/upload-avatar', { token: adminA.token, body: { userid: employee.user_id, image: 'data:image/png;base64,aW1hZ2U=' } });
  const photoPath = '/avatar?key=' + encodeURIComponent(photo.key);
  const profileSession = await call('/auth/verify', { token: employeeA.token });
  assert.equal(profileSession.first_name, 'Alice');
  assert.equal(profileSession.name, 'Alice');
  assert.equal(profileSession.profile_pic_url, photo.key);
  const profileLogin = await login(employee.username, changed);
  assert.equal(profileLogin.first_name, 'Alice');
  assert.equal(profileLogin.profile_pic_url, photo.key);

  await call(photoPath, { token: adminB.token, status: 404 });
  await call(photoPath, { status: 401 });
  const photoResponse = await worker.fetch(new Request('https://hrms.test/api/v1' + photoPath, { headers: { Authorization: 'Bearer ' + employeeA.token } }), env);
  assert.equal(photoResponse.status, 200);
  assert.equal(photoResponse.headers.get('Content-Type'), 'image/png');
  assert.equal(await photoResponse.text(), 'image');
  // HR Connect: publication, company isolation, employee visibility, and private review notes.
  const communication = { kind: 'announcement', title: 'Company update', body: 'Read the updated policy.', scope: 'employee', target: employee.user_id, status: 'Draft' };
  const draft = await call('/hr-connect', { token: adminA.token, body: communication });
  assert.equal((await call('/hr-connect', { token: employeeA.token })).length, 0);
  await call('/hr-connect', { token: employeeA.token, body: communication, status: 403 });
  await call('/hr-connect', { token: adminA.token, body: { ...communication, target: adminB.user_id }, status: 400 });
  await call('/hr-connect/' + draft.id, { token: adminB.token, body: { status: 'Published', revision: 1 }, status: 404 });
  await call('/hr-connect/' + draft.id, { token: adminA.token, body: { status: 'Published', revision: 1 } });
  const employeeFeed = await call('/hr-connect', { token: employeeA.token });
  assert.equal(employeeFeed.length, 1);
  assert.equal(employeeFeed[0].recipients, undefined);
  assert.equal(employeeFeed[0].history, undefined);
  assert.equal((await call('/hr-connect', { token: adminB.token })).length, 0);
  await call('/hr-connect', { token: adminA.token, body: { ...communication, kind: 'email', status: 'Published' }, status: 400 });
  const grievance = await call('/hr-connect', { token: employeeA.token, body: { kind: 'grievance', title: 'Private concern', body: 'Please review.', requester_id: adminB.user_id } });
  assert.equal(grievance.requester_id, employee.user_id);
  await call('/hr-connect/' + grievance.id, { token: employeeA.token, body: { status: 'Resolved', note: 'Not allowed', revision: 1 }, status: 403 });
  const reviewed = await call('/hr-connect/' + grievance.id, { token: adminA.token, body: { status: 'In review', note: 'Private HR note', revision: 1 } });
  assert.equal(reviewed.history[0].note, 'Private HR note');
  await call('/hr-connect/' + grievance.id, { token: adminA.token, body: { status: 'Resolved', note: 'Stale review', revision: 1 }, status: 409 });
  assert.equal((await call('/hr-connect', { token: employeeA.token })).find(r => r.id === grievance.id).history, undefined);
  await call('/get-all-users', { token: 'jwt_admin-a_forged', status: 401 });
  await call('/health', { origin: 'https://evil.example', status: 403 });
  for (let i = 0; i < 10; i++) await call('/login', { body: { username: 'missing', password }, status: 401 });
  await call('/login', { body: { username: 'missing', password }, status: 429 });
  sqlite.prepare("UPDATE companies SET status='suspended' WHERE company_id=?").run(a.company_id);
  await call('/auth/verify', { token: adminA.token, status: 401 });
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length, 0);
  console.log('Worker tests passed: provisioning rollback, passwords, sessions, roles, company isolation, calendar, attendance, leave, payroll, R2 documents, workflow routing, CC privacy, concurrency, delegation, escalation, audit and login throttling.');
} finally { sqlite.close(); }
