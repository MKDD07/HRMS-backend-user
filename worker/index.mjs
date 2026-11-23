import { avatarStorageKey, isAvatarStorageKey } from '../shared/avatarStorage.mjs';
import { directoryRows } from './directoryKvCache.mjs';
import { payrollComponents } from './payrollComponents.mjs';
import { internalMailHandle } from './internalMail.mjs';
import { applyActorPolicy, createPlanPolicyReader, enforcePlanRequest } from './planPolicy.mjs';
import { recordSigninActivity, signinActivityHandle } from './signinActivity.mjs';
﻿import { attendanceSummary } from './attendance-summary.mjs';
import { teamHandle } from './team.mjs';
import { punchHandle } from './punch.mjs';
import { reminderFields, dueCalendarReminders } from '../shared/calendarReminders.mjs';
export { PolicyGenerationRunner } from './policyGenerationRunner.mjs';
import { documentAssistantHandle, processDocumentAlerts } from './documentAssistant.mjs';
import { departmentDraft, asterTask, vaultDraft } from './groq.mjs';
import { validatePaymentDetails } from '../shared/paymentDetails.mjs';
import { employeeDossier } from './employeeDossier.mjs';
import { geofenceSiteHandle } from './geofence.mjs';
import { geofenceRulesHandle } from './geofenceRules.mjs';
import { validDay, shiftFor } from '../shared/overviewModel.mjs';
import { overviewHandle } from './overview.mjs';
import { istDay } from '../shared/overviewModel.mjs';
import { deleteAssetList } from './deleteAssetList.mjs';
import { assetPhotos } from './assetPhotos.mjs';
import { talentHandle } from './talent.mjs';
import { sendOffer, publicOfferResponse, hireOffer, activateJoiner, expireOffers } from './recruitmentOffers.mjs';
import { operationsHandle, expenseReceipts } from './operations.mjs';
import { analyticsHandle } from './hrAnalytics.mjs';
import { appraisalsHandle, processAppraisalTimers } from './appraisals.mjs';
import { lifecycleAction, processLifecycleTimers } from './lifecycleDocuments.mjs';
import { cachedHolidays } from '../server/holidayCache.mjs';
import { billingHandle, billingWebhook } from './billing.mjs';
import { dashboardAdmin, dashboardConfiguration } from './dashboardAdmin.mjs';
import { captchaConfiguration, verifyCaptcha } from './recaptcha.mjs';
import { parsePages, routePages } from '../shared/dashboardAccess.mjs';
import { hrConnectHandle } from './hrConnect.mjs';
import { documentHandle } from './documents.mjs';
// Fresh company-scoped API. Legacy Worker routes are deliberately not forwarded.
import { workflowHandle, createWorkflow, reviewWorkflow, processWorkflowTimers } from './workflows.mjs';
import { calendarStorage } from '../server/calendarStorage.mjs';

const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const required = (value, label, max = 200) => text(value, max) || fail(`${label} is required.`);
const object = (value, max = 30000) => {
  if (value === undefined) return {};
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('Expected a JSON object.');
  if (JSON.stringify(value).length > max) fail('Profile or metadata is too large.');
  return value;
};
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Invalid date.');
  return value;
};
const admin = actor => { if (actor.role !== 'company_admin') fail('Company administrator access required.', 403); };
const publicUser = user => ({ user_id: user.user_id, userid: user.user_id, company_id: user.company_id, username: user.username, ...(user.first_name != null ? { first_name: user.first_name, last_name: user.last_name || '' } : {}), name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username, profile_pic_url: user.profile_pic_url || '', email: user.email, role: user.role, plan_pages: user.plan_pages, plan_test: Boolean(user.plan_test), dashboard_access: Boolean(user.dashboard_access), dashboard_pages: parsePages(user.dashboard_pages), type: user.role === 'company_admin' ? 'Super Admin' : user.dashboard_access ? 'Dashboard User' : 'Employee', status: user.status, must_change_password: Boolean(user.must_change_password) });

export async function hashPassword(password, salt = randomToken()) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) fail('Password must contain 6 to 128 characters.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  // Workers WebCrypto supports at most 100,000 PBKDF2 iterations.
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return `pbkdf2-sha256$100000$${salt}$${hex(bits)}`;
}
async function passwordMatches(password, stored) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) return false;
  const parts = String(stored).split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256' || parts[1] !== '100000') return false;
  const candidate = await hashPassword(password, parts[2]);
  let diff = candidate.length ^ stored.length;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ (stored.charCodeAt(i) || 0);
  return diff === 0;
}
function credentials(body) {
  const username = required(body.username || body.userid, 'Username', 100).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,99}$/.test(username)) fail('Username must be 3â€“100 letters, numbers, dots, underscores or hyphens.');
  const email = text(body.email, 254).toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Invalid email.');
  return { username, email };
}
async function bodyOf(request, max = 100000) {
  if (Number(request.headers.get('content-length')) > max) fail('Request too large.', 413);
  const raw = await request.text();
  if (encoder.encode(raw).length > max) fail('Request too large.', 413);
  try { return object(JSON.parse(raw), max); } catch (error) { if (error.status) throw error; fail('Invalid JSON.'); }
}
const statement = (db, sql, params = []) => db.prepare(sql).bind(...params);
const rows = async (db, sql, params = []) => (await statement(db, sql, params).all()).results;

async function authenticate(request, db, policyReader) {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) fail('Sign in required.', 401);
  const tokenHash = await digest(token);
  const user = await statement(db, `SELECT u.*, e.employee_id, e.first_name, e.last_name, json_extract(e.profile,'$.profile_pic_url') AS profile_pic_url, e.dashboard_access, e.dashboard_pages FROM sessions s
    JOIN users u ON u.company_id=s.company_id AND u.user_id=s.user_id
    JOIN companies c ON c.company_id=u.company_id
    LEFT JOIN employees e ON e.company_id=u.company_id AND e.user_id=u.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' AND c.status='active'`, [tokenHash, Date.now()]).first();
  if (!user) fail('Session expired or account disabled.', 401);
  return { ...await applyActorPolicy(db,user,policyReader), tokenHash };
}
async function employeeTarget(db, actor, body = {}) {
  let id = text(body.employee_id);
  if (!id && body.userid) {
    const employee = await statement(db, 'SELECT employee_id FROM employees WHERE company_id=? AND user_id=?', [actor.company_id, body.userid]).first();
    id = employee?.employee_id;
  }
  id ||= actor.employee_id;
  if (!id || (actor.role !== 'company_admin' && id !== actor.employee_id)) fail('Employee access denied.', 403);
  if (!await statement(db, 'SELECT 1 FROM employees WHERE company_id=? AND employee_id=?', [actor.company_id, id]).first()) fail('Employee not found.', 404);
  return id;
}

async function handle(request, env, ctx) {
  const db = env.DB;
  if (!db) fail('Database binding is missing.', 503);
  const policyReader = createPlanPolicyReader(db);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  const method = request.method;
  const publicOffer = path.match(/^\/api\/v1\/public\/recruitment\/offers\/([^/]+)$/);
  if (publicOffer && ['GET','POST'].includes(method)) return publicOfferResponse({db,id:publicOffer[1],token:request.headers.get('X-Offer-Token'),method,body:method==='POST'?await bodyOf(request,5000):{},request});
  if (path === '/api/v1/billing/webhook' && method === 'POST') return billingWebhook(request, env, db);
  if (path === '/api/v1/auth/captcha-config' && method === 'GET') return captchaConfiguration(env);
  if (path === '/api/v1/branding/default/logo' && method === 'GET') {
    const logo = await env.HRMS_BRANDING?.get('NextHR Data/logo/logo.webp');
    if (!logo) fail('Logo not found.', 404);
    return new Response(logo.body, { headers: { 'Content-Type': 'image/webp' } });
  }
  const branding = path.match(/^\/api\/v1\/branding\/([^/]+)(\/logo)?$/);
  if (branding && method === 'GET') {
    const company = await statement(db, "SELECT company_id,name,welcome_text,logo_key FROM companies WHERE company_id=? AND status='active'", [branding[1]]).first();
    if (!company) fail('Company not found.', 404);
    if (!branding[2]) return { company_id: company.company_id, name: company.name, welcome_text: company.welcome_text, has_logo: Boolean(company.logo_key) };
    const logoBucket = company.logo_key?.startsWith('companies_logo/') ? env.HRMS_BRANDING : env.HRMS_DOCUMENTS;
    const logo = company.logo_key && await logoBucket?.get(company.logo_key);
    if (!logo) fail('Logo not found.', 404);
    return new Response(logo.body, { headers: { 'Content-Type': logo.httpMetadata?.contentType || 'image/png', 'X-Content-Type-Options': 'nosniff' } });
  }
  const imageMatch = path.match(/^(?:\/api\/v1)?\/(?:storage\/images\/|storage\/|)(profile\/[^\s]+)$/);
  if (imageMatch && (method === 'GET' || method === 'HEAD')) {
    let key = decodeURIComponent(imageMatch[1]);
    const bucket = env.HRMS_DOCUMENTS || env.HRMS_BRANDING || env["hrms-images"] || env.HRMS_IMAGES;
    let obj = await bucket?.get(key);
    if (!obj && key.endsWith('.png')) obj = await bucket?.get(key.replace(/\.png$/, '.webp'));
    if (!obj && key.endsWith('.webp')) obj = await bucket?.get(key.replace(/\.webp$/, '.png'));
    if (!obj) fail('Image not found.', 404);
    const contentType = obj.httpMetadata?.contentType || (key.endsWith('.webp') ? 'image/webp' : key.endsWith('.png') ? 'image/png' : 'image/jpeg');
    return new Response(method === 'HEAD' ? null : obj.body, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
  }
  const brandEdit = path.match(/^\/api\/v1\/platform\/companies\/([^/]+)\/branding(\/logo)?$/);

  if (brandEdit && method === 'POST') {
    const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!env.OWNER_PROVISIONING_TOKEN || !supplied || await digest(supplied) !== await digest(env.OWNER_PROVISIONING_TOKEN)) fail('Owner access required.', 403);
    const company = await statement(db, 'SELECT company_id FROM companies WHERE company_id=?', [brandEdit[1]]).first();
    if (!company) fail('Company not found.', 404);
    if (!brandEdit[2]) {
      const body = await bodyOf(request);
      await statement(db, 'UPDATE companies SET welcome_text=? WHERE company_id=?', [required(body.welcome_text, 'Welcome text', 200), company.company_id]).run();
    } else {
      if (!env.HRMS_DOCUMENTS) fail('Logo storage unavailable.', 503);
      const contentType = request.headers.get('Content-Type');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) fail('Use PNG, JPEG or WebP.');
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > 2 * 1024 * 1024) fail('Logo must be smaller than 2 MB.', 413);
      const signature = new Uint8Array(bytes);
      const valid = contentType === 'image/png' ? signature[0] === 137 && signature[1] === 80 && signature[2] === 78 && signature[3] === 71 : contentType === 'image/jpeg' ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255 : new TextDecoder().decode(signature.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(signature.slice(8, 12)) === 'WEBP';
      if (!valid) fail('File does not match its image type.');
      const key = `companies/${company.company_id}/branding/${crypto.randomUUID()}`;
      await env.HRMS_DOCUMENTS.put(key, bytes, { httpMetadata: { contentType } });
      try { await statement(db, 'UPDATE companies SET logo_key=? WHERE company_id=?', [key, company.company_id]).run(); }
      catch (error) { await env.HRMS_DOCUMENTS.delete(key); throw error; }
    }
    return { saved: true };
  }
  if (path === '/api/v1/health' && method === 'GET') return { service: 'HRMS company API', version: 2 };
  if (path === '/api/v1/platform/companies' && method === 'POST') {
    const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!env.OWNER_PROVISIONING_TOKEN) fail('Owner provisioning secret is not configured.', 503);
    if (!supplied || await digest(supplied) !== await digest(env.OWNER_PROVISIONING_TOKEN)) fail('Owner access required.', 403);
    const body = await bodyOf(request);
    const name = required(body.company_name, 'Company name');
    const { username, email } = credentials(body);
    if (/^[a-z]{1,3}\d*-\d+$/i.test(username)) fail('This username format is reserved for generated employee IDs.');
    const passwordHash = await hashPassword(body.password);
    const company_id = crypto.randomUUID(), user_id = crypto.randomUUID();
    const prefixBase = name.normalize('NFKD').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'EMP';
    let employee_prefix;
    for (let attempt = 0; attempt < 20; attempt++) {
      employee_prefix = prefixBase + (attempt ? String(attempt + 1) : '');
      try { await db.batch([
      statement(db, 'INSERT INTO companies(company_id,name,employee_prefix) VALUES(?,?,?)', [company_id, name, employee_prefix]),
      statement(db, "INSERT INTO users(user_id,company_id,username,email,password_hash,role) VALUES(?,?,?,?,?,'company_admin')", [user_id, company_id, username, email, passwordHash]),
      statement(db, 'INSERT INTO company_calendar(company_id) VALUES(?)', [company_id])
      ]); break;
      } catch (error) {
        if (!/companies.employee_prefix/.test(error.message) || attempt === 19) throw error;
      }
    }
    return { company_id, user_id, username, employee_prefix, must_change_password: true };
  }
  if (path === '/api/v1/login' && method === 'POST') {
    const body = await bodyOf(request);
    const identifier = required(body.username || body.email || body.userid, 'Username or email', 254).toLowerCase();
    const identifierHash = await digest(identifier);
    const now = Date.now();
    const attempt = await statement(db, `INSERT INTO login_attempts(identifier_hash,attempts,window_start) VALUES(?,1,?)
      ON CONFLICT(identifier_hash) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,
      window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END RETURNING attempts`, [identifierHash, now, now - 900000, now - 900000]).first();
    if (attempt.attempts > 10) fail('Too many login attempts. Try again in 15 minutes.', 429);
    await verifyCaptcha(env, body.recaptcha_token);
    const user = await statement(db, `SELECT u.*,e.first_name,e.last_name,json_extract(e.profile,'$.profile_pic_url') AS profile_pic_url,e.dashboard_access,e.dashboard_pages FROM users u JOIN companies c ON c.company_id=u.company_id LEFT JOIN employees e ON e.company_id=u.company_id AND e.user_id=u.user_id WHERE (u.username=? OR u.email=?) AND u.status='active' AND c.status='active'`, [identifier, identifier]).first();
    if (!user || !await passwordMatches(body.password, user.password_hash)) fail('Invalid login credentials.', 401);
    const effectiveUser=await applyActorPolicy(db,user,policyReader);
    const token = randomToken();
    await db.batch([
      statement(db, 'DELETE FROM login_attempts WHERE identifier_hash=?', [identifierHash]),
      statement(db, 'INSERT INTO sessions(token_hash,company_id,user_id,expires_at) VALUES(?,?,?,?)', [await digest(token), user.company_id, user.user_id, now + 3600000])
    ]);
    await recordSigninActivity(db, user, 'login', now).catch(error => console.error(JSON.stringify({ event: 'signin_activity_write_failed', action: 'login', message: error.message })));
    return { ...publicUser(effectiveUser), token };
  }
  const actor = await authenticate(request, db, policyReader);
  if (path === '/api/v1/auth/verify' && method === 'GET') {
    if (actor.must_change_password) fail('Change your initial password before continuing.', 403);
    return publicUser(actor);
  }
  if (path === '/api/v1/logout' && method === 'POST') {
    await statement(db, 'DELETE FROM sessions WHERE token_hash=?', [actor.tokenHash]).run();
    await recordSigninActivity(db, actor, 'logout').catch(error => console.error(JSON.stringify({ event: 'signin_activity_write_failed', action: 'logout', message: error.message })));
    return { logged_out: true };
  }
  if (path === '/api/v1/change-password' && method === 'POST') {
    const body = await bodyOf(request);
    if (!await passwordMatches(body.current_password, actor.password_hash)) fail('Current password is incorrect.', 403);
    if (body.new_password === body.current_password) fail('Choose a different password.');
    const passwordHash = await hashPassword(body.new_password);
    await db.batch([
      statement(db, 'UPDATE users SET password_hash=?,must_change_password=0 WHERE company_id=? AND user_id=?', [passwordHash, actor.company_id, actor.user_id]),
      statement(db, 'DELETE FROM sessions WHERE company_id=? AND user_id=?', [actor.company_id, actor.user_id])
    ]);
    return { sign_in_again: true };
  }
  if (actor.must_change_password) fail('Change your initial password before continuing.', 403);
  if (!path.startsWith('/api/v1/billing/')) await enforcePlanRequest(db,actor,path,method,method==='POST' && request.headers.get('content-type')?.includes('application/json')?await bodyOf(request.clone(),7200000):Object.fromEntries(url.searchParams),policyReader);
  if (path.startsWith('/api/v1/mail/')) {
    const data=await internalMailHandle({db,actor,path,method,url,body:method==='POST'?await bodyOf(request,4000000):{},requestId:request.headers.get('idempotency-key')});
    if(data.download){const bytes=Uint8Array.from(atob(data.content),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(data.filename),'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});}
    return data;
  }
  if (path === '/api/v1/signin-activity' && method === 'GET') return signinActivityHandle({ db, actor });
  if (path === '/api/v1/overview' && method === 'GET') return overviewHandle({db,actor,url});
  // Appraisals authorizes employee/manager/HR actions per record, without dashboard elevation.
  if (path === '/api/v1/appraisals' || path.startsWith('/api/v1/appraisals/')) return appraisalsHandle({ db, actor, path, method, url, body: method === 'POST' ? await bodyOf(request, 300000) : {} });
  if (path.startsWith('/api/v1/billing/')) return billingHandle({ db, env, actor, path, method, body: method === 'POST' ? await bodyOf(request) : {} });
  if (path === '/api/v1/dashboard-users') return dashboardAdmin({ db, actor, path, method, body: method === 'POST' ? await bodyOf(request) : {}, hashPassword });
  if (path.startsWith('/api/v1/dashboard-configuration/')) return dashboardConfiguration({ db, actor, section: path.split('/').pop(), method, body: method === 'POST' ? await bodyOf(request) : {} });
  actor.original_role = actor.role;
  if (path === '/api/v1/team' && method === 'GET') return teamHandle({ db, actor });
  if (['/api/v1/attendance-policy', '/api/v1/user-attendance', '/api/v1/getTodaysAttendance', '/api/v1/attendance/upload-image', '/api/v1/attendance/photo'].includes(path)) return punchHandle({ db, env, actor, path, method, body: method === 'POST' ? await bodyOf(request, 7200000) : Object.fromEntries(url.searchParams) });
  const ownAttendance = path === '/api/v1/get-attendance' && method === 'GET' && url.searchParams.get('userid') === actor.user_id && !url.searchParams.has('employee_id');
  if (actor.role !== 'company_admin' && actor.dashboard_access && !ownAttendance) {
    const allowed = routePages(path, method).some(page => parsePages(actor.dashboard_pages).includes(page));
    if (!allowed) fail('Your dashboard account does not have access to this page.', 403);
    if (path === '/api/v1/get-all-users' && !parsePages(actor.dashboard_pages).includes('employees')) {
      const lifecycleAccess = parsePages(actor.dashboard_pages).some(page => ['onboarding', 'offboarding'].includes(page));
      const people = await rows(db, "SELECT e.user_id AS userid,e.employee_id,e.employee_code,e.first_name,e.last_name,e.department,e.designation,e.status,json_extract(e.profile,'$.profile_pic_url') AS profile_pic_url" + (lifecycleAccess ? ",u.email,json_extract(e.profile,'$.date_of_joining') AS date_of_joining,json_extract(e.profile,'$.joining_date') AS joining_date,json_extract(e.profile,'$.probation_months') AS probation_months,json_extract(e.profile,'$.probation_end_date') AS probation_end_date" : "") + " FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND u.status='active'", [actor.company_id]);
      return people;
    }
    actor.role = 'company_admin'; // Request-scoped elevation only after the explicit route permission check.
  }
  if (path === '/api/v1/salary-components') return payrollComponents({ db, actor, method, body: method === 'POST' ? await bodyOf(request, 100000) : {} });
  if (path === '/api/v1/ai/vault-draft' && method === 'POST') return vaultDraft({ env, actor, db, body: await bodyOf(request, 20000) });
  if (path.startsWith('/api/v1/documents/assistant/')) return documentAssistantHandle({ db, env, actor, path, method, body: method === 'POST' ? await bodyOf(request, 600000) : {} });
  const asterRoute = path.match(/^\/api\/v1\/ai\/(onboarding|offboarding|salary-structure)$/);
  if (asterRoute && method === 'POST') return asterTask({ env, actor, page: asterRoute[1], body: await bodyOf(request, 22000) });
  if (path === '/api/v1/ai/department-draft' && method === 'POST') return departmentDraft({ env, actor, body: await bodyOf(request, 25000) });
  if (path === '/api/v1/geofence-sites') return geofenceSiteHandle({db,actor,method,body:method==='POST'?await bodyOf(request,10000):{}});
  if (path === '/api/v1/geofence-rules') return geofenceRulesHandle({db,actor,method,userid:url.searchParams.get('userid'),body:method==='POST'?await bodyOf(request,20000):{}});
  if (path === '/api/v1/employee-dossier' || path === '/api/v1/update-user') { const body = method === 'POST' ? await bodyOf(request, 200000) : {}; return employeeDossier({db,actor,method,userid:body.userid || url.searchParams.get('userid'),body}); }
  if (path === '/api/v1/hr-analytics' || path.startsWith('/api/v1/hr-analytics/')) return analyticsHandle({ db, actor, path, method, url, body: method === 'POST' ? await bodyOf(request) : {} });
  const receiptRoute = path.match(/^\/api\/v1\/operations\/expenses\/([^/]+)\/receipts(?:\/([^/]+))?$/);
  if (receiptRoute) return expenseReceipts({ db, env, actor, request, expenseId: decodeURIComponent(receiptRoute[1]), receiptId: receiptRoute[2] ? decodeURIComponent(receiptRoute[2]) : '' });
  if (path.startsWith('/api/v1/operations/')) return operationsHandle({ db, actor, path, method, url, body: method === 'POST' ? await bodyOf(request, 200000) : {} });
  const deleteListRoute = path.match(/^\/api\/v1\/talent\/asset_lists\/([^/]+)\/delete$/);
  if (deleteListRoute) return deleteAssetList({ db, env, actor, id: deleteListRoute[1], method, body: method === 'POST' ? await bodyOf(request) : {} });
  const photoRoute = path.match(/^\/api\/v1\/talent\/(assets|asset_issues)\/([^/]+)\/photos$/);
  if (photoRoute) return assetPhotos({ db, env, actor, request, collection: photoRoute[1], id: photoRoute[2], url });
  const lifecycleRoute = path.match(/^\/api\/v1\/talent\/(onboarding|offboarding)_documents\/(generate|([^/]+)\/send)$/);
  if (lifecycleRoute && method === 'POST') return lifecycleAction({ db, actor, env, page: lifecycleRoute[1], id: lifecycleRoute[3] ? decodeURIComponent(lifecycleRoute[3]) : '', action: lifecycleRoute[2] === 'generate' ? 'generate' : 'send', body: await bodyOf(request, 2000000) });
  const offerAction = path.match(/^\/api\/v1\/talent\/offers\/([^/]+)\/(send|hire)$/);
  if (offerAction && method === 'POST') return (offerAction[2] === 'send' ? sendOffer : hireOffer)({db,actor,env,id:decodeURIComponent(offerAction[1]),body:await bodyOf(request,5000),hashPassword});
  const activateRoute = path.match(/^\/api\/v1\/talent\/onboarding\/([^/]+)\/activate$/);
  if (activateRoute && method === 'POST') return activateJoiner({db,actor,id:decodeURIComponent(activateRoute[1]),body:await bodyOf(request,5000),hashPassword});
  if (path.startsWith('/api/v1/talent/')) return talentHandle({ db, actor, path, method, url, body: method === 'POST' ? await bodyOf(request, 2000000) : {} });
  if (path === '/api/v1/hr-connect' || path.startsWith('/api/v1/hr-connect/')) return hrConnectHandle({ db, actor, path, method, url, body: method === 'POST' ? await bodyOf(request, 20000) : {} });
  if (path.startsWith('/api/v1/workflows/')) return workflowHandle({ db, actor, path, method, url, body: method === 'POST' ? await bodyOf(request, 2000000) : {} });
  if (['/api/v1/create-user', '/api/v1/register'].includes(path) && method === 'POST') {
    admin(actor);
    const body = await bodyOf(request), login = credentials({ username: 'generated', email: body.email });
    const user_id = crypto.randomUUID(), employee_id = crypto.randomUUID();
    const first = required(body.first_name, 'First name');
    const passwordHash = await hashPassword(body.password);
    const profile = object(body.profile);
    // D1 batches are transactions: the counter and both inserts commit or roll back together.
    await db.batch([
      statement(db, 'UPDATE companies SET next_employee_number=next_employee_number+1 WHERE company_id=? AND employee_prefix IS NOT NULL', [actor.company_id]),
      statement(db, "INSERT INTO users(user_id,company_id,username,email,password_hash,role) SELECT ?,company_id,employee_prefix || '-' || printf('%03d',next_employee_number-1),?,?, 'employee' FROM companies WHERE company_id=?", [user_id, login.email, passwordHash, actor.company_id]),
      statement(db, 'INSERT INTO employees(employee_id,company_id,user_id,employee_code,first_name,last_name,department,designation,profile) SELECT ?,company_id,user_id,username,?,?,?,?,? FROM users WHERE user_id=?', [employee_id, first, text(body.last_name), text(body.department), text(body.designation), JSON.stringify(profile), user_id])
    ]);
    const created = await statement(db, 'SELECT username FROM users WHERE company_id=? AND user_id=?', [actor.company_id, user_id]).first();
    return { userid: user_id, user_id, employee_id, company_id: actor.company_id, username: created.username, employee_code: created.username, must_change_password: true };
  }
  if (path === '/api/v1/get-all-users' && method === 'GET') {
    admin(actor);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || 100));
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const userRows = await directoryRows({ db, kv: env.HRMS_CACHE, company: actor.company_id, limit, offset, ctx,
      fetchRows: () => rows(db, `SELECT e.employee_id,e.employee_code,e.first_name,e.last_name,e.department,e.designation,e.status,e.profile,u.user_id AS userid,u.email,u.username,u.company_id,'Employee' AS type
      FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? ORDER BY e.first_name,e.employee_id LIMIT ? OFFSET ?`, [actor.company_id, limit, offset]) });
    const access=await policyReader.seats(actor.company_id,await policyReader.policy(actor.company_id));
    return userRows.map(row => {
      let parsed = {};
      try { parsed = typeof row.profile === 'string' ? JSON.parse(row.profile || '{}') : (row.profile || {}); } catch {}
      return { ...row, plan_locked: Boolean(access.get(row.userid)?.plan_locked), profile: parsed, profile_pic_url: parsed.profile_pic_url || row.profile_pic_url };
    });
  }
  if (path === '/api/v1/get-user' && method === 'GET') {
    const reqUserid = url.searchParams.get('userid');
    const target = reqUserid || actor.user_id;
    if (target && target !== actor.user_id && target !== actor.username && target !== actor.employee_code && target !== actor.employee_id) {
      admin(actor);
    }
    let user = await statement(db, 'SELECT * FROM users WHERE company_id=? AND (user_id=? OR username=?)', [actor.company_id, target, target]).first();
    let empLookup = null;
    if (!user) {
      empLookup = await statement(db, 'SELECT * FROM employees WHERE company_id=? AND (user_id=? OR employee_id=? OR employee_code=?)', [actor.company_id, target, target, target]).first();
      if (empLookup?.user_id) {
        user = await statement(db, 'SELECT * FROM users WHERE company_id=? AND user_id=?', [actor.company_id, empLookup.user_id]).first();
      }
      if (!user && empLookup) {
        user = {
          user_id: empLookup.user_id || empLookup.employee_id,
          company_id: actor.company_id,
          username: empLookup.employee_code || empLookup.first_name,
          email: '',
          role: 'employee',
          status: empLookup.status || 'Active'
        };
      }
    }
    if (!user && !reqUserid) {
      user = await statement(db, 'SELECT * FROM users WHERE company_id=? AND (user_id=? OR username=?)', [actor.company_id, actor.user_id, actor.username]).first();
    }
    if (!user) fail('User not found.', 404);
    const employee = await statement(db, 'SELECT * FROM employees WHERE company_id=? AND (user_id=? OR employee_id=? OR employee_code=?)', [actor.company_id, user.user_id, user.user_id, user.username]).first();
    let parsedProfile = {};
    try { parsedProfile = typeof employee?.profile === 'string' ? JSON.parse(employee?.profile || '{}') : (employee?.profile || {}); } catch {}

    const [dbPersonal, dbProf, dbBank, dbFamily] = await Promise.all([
      statement(db, 'SELECT * FROM personal_details WHERE userid=? OR userid=?', [user.user_id, user.username]).first().catch(() => null),
      statement(db, 'SELECT * FROM professional_details WHERE userid=? OR userid=?', [user.user_id, user.username]).first().catch(() => null),
      statement(db, 'SELECT * FROM bank_details WHERE userid=? OR userid=?', [user.user_id, user.username]).first().catch(() => null),
      statement(db, 'SELECT * FROM family_details WHERE userid=? OR userid=?', [user.user_id, user.username]).first().catch(() => null)
    ]);
    
    const finalUserId = user.user_id;
    const finalFirstName = employee?.first_name || user.username || 'Employee';
    const finalLastName = employee?.last_name || '';
    const finalFullName = `${finalFirstName} ${finalLastName}`.trim();
    const finalEmail = user.email || parsedProfile?.email || '';
    const profilePic = parsedProfile.profile_pic_url || employee?.profile_pic_url || user.profile_pic_url || '';
    
    const userObj = {
      id: 1,
      userid: finalUserId,
      user_id: finalUserId,
      employee_id: employee?.employee_id || finalUserId,
      employee_code: employee?.employee_code || user.username,
      first_name: finalFirstName,
      firstname: finalFirstName,
      last_name: finalLastName,
      lastname: finalLastName,
      name: finalFullName,
      email: finalEmail,
      phone_number: parsedProfile?.phone || parsedProfile?.phone_number || '',
      status: employee?.status || user.status || 'Active',
      type: user.role === 'company_admin' ? 'Super Admin' : 'Employee',
      department: employee?.department || dbProf?.department || '',
      designation: employee?.designation || dbProf?.designation || '',
      work_location: parsedProfile?.work_location || 'office',
      worklocation: parsedProfile?.work_location || 'office',
      reports_to_userid: parsedProfile?.reports_to_userid || null,
      date_of_joining: dbProf?.joining_date || parsedProfile?.joining_date || parsedProfile?.date_of_joining || '',
      confirmation_date: parsedProfile?.confirmation_date || null,
      employment_type: dbProf?.employee_type || parsedProfile?.employment_type || 'Full-time',
      profile_pic_url: profilePic,
      avatar_id: 0,
      office_id: 1,
      date_of_birth: parsedProfile?.date_of_birth ?? parsedProfile?.dob ?? dbPersonal?.dob ?? '',
      dob: parsedProfile?.date_of_birth ?? parsedProfile?.dob ?? dbPersonal?.dob ?? ''
    };

    const personalObj = {
      id: dbPersonal?.id || 1,
      userid: finalUserId,
      src: dbPersonal?.src || profilePic,
      gender: dbPersonal?.gender || parsedProfile?.gender || 'Male',
      dob: dbPersonal?.dob || userObj.date_of_birth,
      bio: dbPersonal?.bio || parsedProfile?.bio || '',
      address: dbPersonal?.address || parsedProfile?.address || '',
      address1: dbPersonal?.address || parsedProfile?.address || '',
      address2: dbPersonal?.address2 || parsedProfile?.address2 || '',
      state: dbPersonal?.state || parsedProfile?.state || '',
      city: dbPersonal?.city || parsedProfile?.city || '',
      zipcode: dbPersonal?.zipcode || parsedProfile?.zipcode || '',
      pincode: dbPersonal?.zipcode || parsedProfile?.zipcode || '',
      country: dbPersonal?.country || parsedProfile?.country || 'India',
      address_type: dbPersonal?.address_type || parsedProfile?.address_type || 'Current',
      blood_group: dbPersonal?.blood_group || parsedProfile?.blood_group || ''
    };

    const professionalObj = {
      id: dbProf?.id || 1,
      userid: finalUserId,
      designation: dbProf?.designation || employee?.designation || '',
      department: dbProf?.department || employee?.department || '',
      employee_type: dbProf?.employee_type || userObj.employment_type,
      experience: dbProf?.experience || parsedProfile?.experience || '',
      skills: dbProf?.skills || parsedProfile?.skills || '',
      joining_date: dbProf?.joining_date || userObj.date_of_joining,
      termination_date: dbProf?.termination_date || null,
      termination_reason: dbProf?.termination_reason || null
    };

    const bankObj = {
      id: dbBank?.id || 1,
      userid: finalUserId,
      bank_name: dbBank?.bank_name || parsedProfile?.bank_name || '',
      account_no: dbBank?.account_no || parsedProfile?.account_no || '',
      ifsc_code: dbBank?.ifsc_code || parsedProfile?.ifsc_code || '',
      branch_name: dbBank?.branch_name || parsedProfile?.branch_name || '',
      bank_address: dbBank?.bank_address || parsedProfile?.bank_address || '',
      pan_card: dbBank?.pan_card || parsedProfile?.pan_card || '',
      aadhar_card: dbBank?.aadhar_card || parsedProfile?.aadhar_card || ''
    };

    const familyObj = {
      id: dbFamily?.id || 1,
      userid: finalUserId,
      father_name: dbFamily?.father_name || parsedProfile?.father_name || '',
      mother_name: dbFamily?.mother_name || parsedProfile?.mother_name || '',
      personal_email: dbFamily?.personal_email || parsedProfile?.personal_email || finalEmail,
      alternate_contact: dbFamily?.alternate_contact || parsedProfile?.alternate_contact || '',
      family_address: dbFamily?.family_address || parsedProfile?.family_address || ''
    };

    return new Response(JSON.stringify({
      success: true,
      status_code: 200,
      data: [userObj],
      personal_detail: personalObj,
      personalDetails: [personalObj],
      professional_detail: professionalObj,
      professionalDetails: [professionalObj],
      bank_detail: bankObj,
      bankDetails: [bankObj],
      family_detail: familyObj,
      familyDetails: [familyObj],
      message: "User profile fetched successfully"
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (path === '/api/v1/edit-personal' && (method === 'POST' || method === 'PUT')) {
    const body = await bodyOf(request);
    const target = body.userid || actor.user_id;
    if (target !== actor.user_id && target !== actor.username && target !== actor.employee_code && target !== actor.employee_id) admin(actor);
    const employee = await statement(db, 'SELECT * FROM employees WHERE company_id=? AND (user_id=? OR employee_code=?)', [actor.company_id, target, target]).first();
    let currentProfile = {};
    try { currentProfile = typeof employee?.profile === 'string' ? JSON.parse(employee?.profile || '{}') : (employee?.profile || {}); } catch {}
    const fields = ['gender', 'dob', 'bio', 'address', 'address2', 'state', 'city', 'zipcode', 'country', 'address_type', 'blood_group'];
    for (const f of fields) { if (body[f] !== undefined) currentProfile[f] = body[f]; }
    if (body.date_of_birth !== undefined || body.dob !== undefined) {
      const birthday = body.date_of_birth ?? body.dob;
      if (birthday && !validDay(birthday)) fail('Invalid date of birth.');
      currentProfile.date_of_birth = birthday;
      currentProfile.dob = birthday;
    }
    if (employee) {
      await statement(db, 'UPDATE employees SET profile=? WHERE company_id=? AND user_id=?', [JSON.stringify(currentProfile), actor.company_id, employee.user_id]).run();
    }
    await statement(db, `INSERT INTO personal_details (userid, gender, dob, bio, address, address2, state, city, zipcode, country, address_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(userid) DO UPDATE SET
        gender=COALESCE(excluded.gender, personal_details.gender),
        dob=COALESCE(excluded.dob, personal_details.dob),
        bio=COALESCE(excluded.bio, personal_details.bio),
        address=COALESCE(excluded.address, personal_details.address),
        address2=COALESCE(excluded.address2, personal_details.address2),
        state=COALESCE(excluded.state, personal_details.state),
        city=COALESCE(excluded.city, personal_details.city),
        zipcode=COALESCE(excluded.zipcode, personal_details.zipcode),
        country=COALESCE(excluded.country, personal_details.country),
        address_type=COALESCE(excluded.address_type, personal_details.address_type),
        updated_at=CURRENT_TIMESTAMP`, [
      target, body.gender || 'Male', body.dob || body.date_of_birth || null, body.bio || '', body.address || '', body.address2 || '', body.state || '', body.city || '', body.zipcode || '', body.country || 'India', body.address_type || 'Current'
    ]).run();
    return { success: true, message: 'Personal details updated successfully' };
  }

  if (path === '/api/v1/edit-professional' && (method === 'POST' || method === 'PUT')) {
    const body = await bodyOf(request);
    const target = body.userid || actor.user_id;
    if (target !== actor.user_id && target !== actor.username && target !== actor.employee_code && target !== actor.employee_id) admin(actor);
    const employee = await statement(db, 'SELECT * FROM employees WHERE company_id=? AND (user_id=? OR employee_code=?)', [actor.company_id, target, target]).first();
    let currentProfile = {};
    try { currentProfile = typeof employee?.profile === 'string' ? JSON.parse(employee?.profile || '{}') : (employee?.profile || {}); } catch {}
    for (const f of ['designation', 'department', 'experience', 'skills', 'joining_date']) { if (body[f] !== undefined) currentProfile[f] = body[f]; }
    if (employee) {
      await statement(db, 'UPDATE employees SET designation=COALESCE(?, designation), department=COALESCE(?, department), profile=? WHERE company_id=? AND user_id=?', [body.designation || null, body.department || null, JSON.stringify(currentProfile), actor.company_id, employee.user_id]).run();
    }
    await statement(db, `INSERT INTO professional_details (userid, designation, experience, skills, joining_date, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(userid) DO UPDATE SET
        designation=COALESCE(excluded.designation, professional_details.designation),
        experience=COALESCE(excluded.experience, professional_details.experience),
        skills=COALESCE(excluded.skills, professional_details.skills),
        joining_date=COALESCE(excluded.joining_date, professional_details.joining_date),
        updated_at=CURRENT_TIMESTAMP`, [
      target, body.designation || '', body.experience || '', body.skills || '', body.joining_date || ''
    ]).run();
    return { success: true, message: 'Professional details updated successfully' };
  }

  if (path === '/api/v1/edit-bank' && (method === 'POST' || method === 'PUT')) {
    const body = await bodyOf(request);
    const target = body.userid || actor.user_id;
    if (target !== actor.user_id && target !== actor.username && target !== actor.employee_code && target !== actor.employee_id) admin(actor);
    const employee = await statement(db, 'SELECT * FROM employees WHERE company_id=? AND (user_id=? OR employee_code=?)', [actor.company_id, target, target]).first();
    let currentProfile = {};
    try { currentProfile = typeof employee?.profile === 'string' ? JSON.parse(employee?.profile || '{}') : (employee?.profile || {}); } catch {}
    for (const f of ['bank_name', 'account_no', 'ifsc_code', 'branch_name', 'bank_address', 'pan_card', 'aadhar_card']) { if (body[f] !== undefined) currentProfile[f] = body[f]; }
    if (employee) {
      await statement(db, 'UPDATE employees SET profile=? WHERE company_id=? AND user_id=?', [JSON.stringify(currentProfile), actor.company_id, employee.user_id]).run();
    }
    await statement(db, `INSERT INTO bank_details (userid, bank_name, account_no, ifsc_code, branch_name, bank_address, pan_card, aadhar_card, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(userid) DO UPDATE SET
        bank_name=COALESCE(excluded.bank_name, bank_details.bank_name),
        account_no=COALESCE(excluded.account_no, bank_details.account_no),
        ifsc_code=COALESCE(excluded.ifsc_code, bank_details.ifsc_code),
        branch_name=COALESCE(excluded.branch_name, bank_details.branch_name),
        bank_address=COALESCE(excluded.bank_address, bank_details.bank_address),
        pan_card=COALESCE(excluded.pan_card, bank_details.pan_card),
        aadhar_card=COALESCE(excluded.aadhar_card, bank_details.aadhar_card),
        updated_at=CURRENT_TIMESTAMP`, [
      target, body.bank_name || '', body.account_no || '', body.ifsc_code || '', body.branch_name || '', body.bank_address || '', body.pan_card || '', body.aadhar_card || ''
    ]).run();
    return { success: true, message: 'Bank details updated successfully' };
  }

  if (path === '/api/v1/edit-family' && (method === 'POST' || method === 'PUT')) {
    const body = await bodyOf(request);
    const target = body.userid || actor.user_id;
    if (target !== actor.user_id && target !== actor.username && target !== actor.employee_code && target !== actor.employee_id) admin(actor);
    const employee = await statement(db, 'SELECT * FROM employees WHERE company_id=? AND (user_id=? OR employee_code=?)', [actor.company_id, target, target]).first();
    let currentProfile = {};
    try { currentProfile = typeof employee?.profile === 'string' ? JSON.parse(employee?.profile || '{}') : (employee?.profile || {}); } catch {}
    for (const f of ['father_name', 'mother_name', 'personal_email', 'alternate_contact', 'family_address']) { if (body[f] !== undefined) currentProfile[f] = body[f]; }
    if (employee) {
      await statement(db, 'UPDATE employees SET profile=? WHERE company_id=? AND user_id=?', [JSON.stringify(currentProfile), actor.company_id, employee.user_id]).run();
    }
    await statement(db, `INSERT INTO family_details (userid, father_name, mother_name, personal_email, alternate_contact, family_address, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(userid) DO UPDATE SET
        father_name=COALESCE(excluded.father_name, family_details.father_name),
        mother_name=COALESCE(excluded.mother_name, family_details.mother_name),
        personal_email=COALESCE(excluded.personal_email, family_details.personal_email),
        alternate_contact=COALESCE(excluded.alternate_contact, family_details.alternate_contact),
        family_address=COALESCE(excluded.family_address, family_details.family_address),
        updated_at=CURRENT_TIMESTAMP`, [
      target, body.father_name || '', body.mother_name || '', body.personal_email || '', body.alternate_contact || '', body.family_address || ''
    ]).run();
    return { success: true, message: 'Family details updated successfully' };
  }

  if (path === '/api/v1/request-profile-edit' && method === 'POST') {
    const body = await bodyOf(request);
    const target = body.userid || actor.user_id;
    const proposed = body.proposed_data || {};
    const section = (body.section || 'Personal').toLowerCase();
    const employee = await statement(db, 'SELECT * FROM employees WHERE company_id=? AND (user_id=? OR employee_code=?)', [actor.company_id, target, target]).first();
    let currentProfile = {};
    try { currentProfile = typeof employee?.profile === 'string' ? JSON.parse(employee?.profile || '{}') : (employee?.profile || {}); } catch {}
    
    // Update local profile JSON and corresponding table
    Object.assign(currentProfile, proposed);
    if (employee) {
      await statement(db, 'UPDATE employees SET profile=? WHERE company_id=? AND user_id=?', [JSON.stringify(currentProfile), actor.company_id, employee.user_id]).run();
    }
    if (section.includes('personal')) {
      await statement(db, `INSERT INTO personal_details (userid, gender, dob, bio, address, address2, state, city, zipcode, country, address_type, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(userid) DO UPDATE SET
          gender=COALESCE(excluded.gender, personal_details.gender),
          dob=COALESCE(excluded.dob, personal_details.dob),
          bio=COALESCE(excluded.bio, personal_details.bio),
          address=COALESCE(excluded.address, personal_details.address),
          address2=COALESCE(excluded.address2, personal_details.address2),
          state=COALESCE(excluded.state, personal_details.state),
          city=COALESCE(excluded.city, personal_details.city),
          zipcode=COALESCE(excluded.zipcode, personal_details.zipcode),
          country=COALESCE(excluded.country, personal_details.country),
          address_type=COALESCE(excluded.address_type, personal_details.address_type),
          updated_at=CURRENT_TIMESTAMP`, [
        target, proposed.gender || 'Male', proposed.dob || null, proposed.bio || '', proposed.address || '', proposed.address2 || '', proposed.state || '', proposed.city || '', proposed.zipcode || '', proposed.country || 'India', proposed.address_type || 'Current'
      ]).run();
    } else if (section.includes('bank')) {
      await statement(db, `INSERT INTO bank_details (userid, bank_name, account_no, ifsc_code, branch_name, bank_address, pan_card, aadhar_card, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(userid) DO UPDATE SET
          bank_name=COALESCE(excluded.bank_name, bank_details.bank_name),
          account_no=COALESCE(excluded.account_no, bank_details.account_no),
          ifsc_code=COALESCE(excluded.ifsc_code, bank_details.ifsc_code),
          branch_name=COALESCE(excluded.branch_name, bank_details.branch_name),
          bank_address=COALESCE(excluded.bank_address, bank_details.bank_address),
          pan_card=COALESCE(excluded.pan_card, bank_details.pan_card),
          aadhar_card=COALESCE(excluded.aadhar_card, bank_details.aadhar_card),
          updated_at=CURRENT_TIMESTAMP`, [
        target, proposed.bank_name || '', proposed.account_no || '', proposed.ifsc_code || '', proposed.branch_name || '', proposed.bank_address || '', proposed.pan_card || '', proposed.aadhar_card || ''
      ]).run();
    } else if (section.includes('family')) {
      await statement(db, `INSERT INTO family_details (userid, father_name, mother_name, personal_email, alternate_contact, family_address, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(userid) DO UPDATE SET
          father_name=COALESCE(excluded.father_name, family_details.father_name),
          mother_name=COALESCE(excluded.mother_name, family_details.mother_name),
          personal_email=COALESCE(excluded.personal_email, family_details.personal_email),
          alternate_contact=COALESCE(excluded.alternate_contact, family_details.alternate_contact),
          family_address=COALESCE(excluded.family_address, family_details.family_address),
          updated_at=CURRENT_TIMESTAMP`, [
        target, proposed.father_name || '', proposed.mother_name || '', proposed.personal_email || '', proposed.alternate_contact || '', proposed.family_address || ''
      ]).run();
    } else if (section.includes('prof')) {
      await statement(db, `INSERT INTO professional_details (userid, designation, experience, skills, joining_date, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(userid) DO UPDATE SET
          designation=COALESCE(excluded.designation, professional_details.designation),
          experience=COALESCE(excluded.experience, professional_details.experience),
          skills=COALESCE(excluded.skills, professional_details.skills),
          joining_date=COALESCE(excluded.joining_date, professional_details.joining_date),
          updated_at=CURRENT_TIMESTAMP`, [
        target, proposed.designation || '', proposed.experience || '', proposed.skills || '', proposed.skills || '', proposed.joining_date || ''
      ]).run();
    }
    return { success: true, message: 'Profile details updated and change request submitted successfully' };
  }

  const profileStream = path.match(/^\/api\/v1\/(?:storage\/)?(profile\/[^\s]+)$/);
  if (profileStream && method === 'GET') {
    const key = decodeURIComponent(profileStream[1]);
    const obj = await env.HRMS_DOCUMENTS?.get(key);
    if (!obj) fail('Image not found.', 404);
    return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/webp', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (path === '/api/v1/avatar' && method === 'GET') {
    const key = url.searchParams.get('key');
    if (!isAvatarStorageKey(key)) fail('Photo not found.', 404);
    const employee = await statement(db, "SELECT user_id FROM employees WHERE company_id=? AND json_extract(profile,'$.profile_pic_url')=?", [actor.company_id, key]).first();
    if (!employee || (actor.role !== 'company_admin' && employee.user_id !== actor.user_id)) fail('Photo not found.', 404);
    const stored = await env.HRMS_DOCUMENTS?.get(key);
    if (!stored) fail('Photo not found.', 404);
    const contentType = stored.httpMetadata?.contentType || (key.endsWith('.png') ? 'image/png' : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    return new Response(stored.body, { headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' } });
  }
  if (path === '/api/v1/upload-avatar' && method === 'POST') {
    const body = await bodyOf(request, 8000000);
    const target = body.userid || actor.user_id;
    let employee = await statement(db, `SELECT e.employee_id, e.user_id, e.employee_code, e.first_name, e.last_name, e.profile
      FROM employees e
      LEFT JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id
      WHERE e.company_id=? AND (e.user_id=? OR e.employee_code=? OR e.employee_id=? OR u.username=?)`, [actor.company_id, target, target, target, target]).first();

    if (!employee && actor.role === 'company_admin') {
      const user = await statement(db, 'SELECT user_id, username FROM users WHERE company_id=? AND (user_id=? OR username=?)', [actor.company_id, target, target]).first();
      if (user) {
        const empId = crypto.randomUUID();
        await statement(db, 'INSERT OR IGNORE INTO employees(employee_id, company_id, user_id, employee_code, first_name) VALUES(?,?,?,?,?)', [empId, actor.company_id, user.user_id, user.username, user.username]).run();
        employee = await statement(db, 'SELECT employee_id, user_id, employee_code, first_name, last_name, profile FROM employees WHERE company_id=? AND user_id=?', [actor.company_id, user.user_id]).first();
      }
    }

    if (!employee) fail('Employee not found.', 404);
    if (actor.role !== 'company_admin' && employee.user_id !== actor.user_id) fail('Permission denied.', 403);

    let bytes, contentType;
    if (body.image && typeof body.image === 'string') {
      const match = body.image.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
      if (!match) fail('Invalid image format. Send a base64 image data URL.');
      contentType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
      const binaryString = atob(match[2]);
      const len = binaryString.length;
      bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    } else {
      fail('Image data is required.');
    }

    if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) fail('Image must be smaller than 5 MB.', 413);

    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';

    const company = await statement(db, 'SELECT name FROM companies WHERE company_id=?', [actor.company_id]).first();
    const key = avatarStorageKey({companyName: company?.name, companyId: actor.company_id, personName: [employee.first_name,employee.last_name].filter(Boolean).join(' '), userId: employee.user_id, version: crypto.randomUUID(), extension: ext});

    if (!env.HRMS_DOCUMENTS?.put) fail('Photo storage is unavailable.', 503);
    const storedPhoto = await env.HRMS_DOCUMENTS.put(key, bytes, { httpMetadata: { contentType } });
    if (storedPhoto === false || storedPhoto === null) fail('Photo could not be saved.', 503);

    let currentProfile = {};
    try { currentProfile = typeof employee.profile === 'string' ? JSON.parse(employee.profile || '{}') : (employee.profile || {}); } catch {}
    currentProfile.profile_pic_url = key;
    currentProfile.avatar_updated_at = new Date().toISOString();

    await statement(db, 'UPDATE employees SET profile=? WHERE company_id=? AND user_id=?', [JSON.stringify(currentProfile), actor.company_id, employee.user_id]).run();

    return { success: true, profile_pic_url: key, key, userid: employee.user_id, employee_code: employee.employee_code };
  }
  if (path.startsWith('/api/v1/company-calendar/')) {
    const store = calendarStorage({ mode: 'Cloudflare D1', query: (sql, params) => rows(db, sql, params) });
    const section = path.slice('/api/v1/company-calendar/'.length).split('/');
    if (section[0] === 'configuration' && method === 'GET') {
      const config = await store.configuration(actor.company_id);
      if (actor.role !== 'company_admin') config.assignments = config.assignments.filter(entry => entry.userid === actor.user_id);
      return config;
    }
    if (section[0] === 'reminders') {
      const config = await store.configuration(actor.company_id);
      if (method === 'GET') return dueCalendarReminders(config.importantDates, actor.user_id);
      if (section[1] === 'read' && method === 'POST') {
        const body = await bodyOf(request);
        for (const entry of config.importantDates.filter(entry => entry.owner_id === actor.user_id && (!body.id || 'calendar:' + entry.id === body.id))) await store.change(actor.company_id, 'important_dates', entry.id, { ...entry, read_at: new Date().toISOString() });
        return { saved: true };
      }
      fail('Calendar route not found.', 404);
    }
    admin(actor);
    if (section[0] === 'holiday-cache' && method === 'POST') {
      const body = await bodyOf(request);
      return cachedHolidays({ db: { query: (sql, params) => rows(db, sql, params) }, company: actor.company_id, country: body.country, year: body.year, apiKey: env.CALENDARIFIC_API_KEY });
    }
    if (section[0] === 'assignments' && method === 'POST') {
      const body = await bodyOf(request);
      const employee = await employeeTarget(db, actor, body);
      const user = await statement(db, 'SELECT user_id FROM employees WHERE company_id=? AND employee_id=?', [actor.company_id, employee]).first();
      await store.assign(actor.company_id, { ...object(body), userid: user.user_id }); return { saved: true };
    }
    const column = { holidays: 'holidays', 'important-dates': 'important_dates', 'leave-types': 'leave_types', groups: 'policy_groups' }[section[0]];
    if (!column) fail('Calendar route not found.', 404);
    if (method === 'POST') {
      const body = await bodyOf(request), id = text(body.id, 100) || crypto.randomUUID();
      required(body.name, 'Name');
      if (['holidays', 'important_dates'].includes(column)) body.holiday_date = validDate(body.holiday_date || body.date);
      if (column === 'important_dates') {
        try { Object.assign(body, reminderFields(body, actor.user_id)); }
        catch (error) { fail(error.message, 400); }
      }
      await store.change(actor.company_id, column, id, { ...body, id }); return { ...body, id };
    }
    if (method === 'DELETE' && section[1]) { await store.change(actor.company_id, column, section[1]); return { deleted: true }; }
  }
  if (path === '/api/v1/attendance/schedule' && method === 'GET') {
    admin(actor);
    const [calendar, shiftSettings, schedules] = await Promise.all([
      statement(db, 'SELECT holidays FROM company_calendar WHERE company_id=?', [actor.company_id]).first(),
      statement(db, "SELECT payload FROM dashboard_configuration WHERE company_id=? AND section='shifts'", [actor.company_id]).first(),
      rows(db, `SELECT user_id, json_extract(profile,'$.shift_id') AS shift_id,
        json_extract(profile,'$.shiftId') AS shiftId, json_extract(profile,'$.shift_override') AS shift_override
        FROM employees WHERE company_id=?`, [actor.company_id]),
    ]);
    const shifts = JSON.parse(shiftSettings?.payload || '[]');
    const officeHolidays = JSON.parse(calendar?.holidays || '[]')
      .filter(holiday => holiday.active !== false && String(holiday.type || '').trim().toLowerCase() === 'company holiday' && !holiday.departments?.length && validDay(holiday.holiday_date))
      .map(holiday => ({ date: holiday.holiday_date, name: holiday.name || 'Company holiday' }));
    const workingDaysByUser = Object.fromEntries(schedules.flatMap(person => {
      const shift = shiftFor({ ...person, shift_override: JSON.parse(person.shift_override || 'null') }, shifts);
      return shift?.workingDays?.length ? [[person.user_id, shift.workingDays]] : [];
    }));
    return { officeHolidays, workingDaysByUser };
  }
  if (path === '/api/v1/attendance' && method === 'POST') {
    const body = await bodyOf(request), employee = await employeeTarget(db, actor, body);
    const target = await statement(db, 'SELECT user_id FROM employees WHERE company_id=? AND employee_id=?', [actor.company_id, employee]).first();
    return punchHandle({ db, env, actor: { ...actor, user_id: target.user_id }, path, method, body });
  }
  if (path === '/api/v1/apply-leave' && method === 'POST') {
    const body = await bodyOf(request), employee = await employeeTarget(db, actor, body), id = crypto.randomUUID();
    const start = validDate(body.start_date), end = validDate(body.end_date);
    if (end < start) fail('End date precedes start date.');
    const requester = await statement(db, 'SELECT user_id FROM employees WHERE company_id=? AND employee_id=?', [actor.company_id,employee]).first();
    const leaveType = required(body.leave_type, 'Leave type');
    const reason = required(body.reason, 'Reason', 2000);
    const workflow = await createWorkflow(db, actor, { kind: 'leave', requester: requester.user_id, sourceId: id, payload: { start_date:start, end_date:end, leave_type:leaveType, reason } }, [statement(db, 'INSERT INTO leave_requests(leave_id,company_id,employee_id,leave_type,start_date,end_date,reason) VALUES(?,?,?,?,?,?,?)', [id,actor.company_id,employee,leaveType,start,end,reason])]);
    return { leave_id:id, status:'Pending', workflow };
  }
  if (path === '/api/v1/review-leave' && method === 'POST') {
    const body = await bodyOf(request);
    const workflow = await statement(db, "SELECT request_id FROM workflow_requests WHERE company_id=? AND kind='leave' AND source_id=?",[actor.company_id,required(body.leave_id,'Leave ID')]).first();
    if (!workflow) fail('Routed leave request not found.',404);
    return reviewWorkflow(db,actor,workflow.request_id,body.status,body.remarks);
  }
  if (path === '/api/v1/add-salary' && method === 'POST') {
    admin(actor); const body = await bodyOf(request), employee = await employeeTarget(db, actor, body);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.period)) fail('Period must be YYYY-MM.');
    if (![body.gross_minor, body.deductions_minor].every(n => Number.isSafeInteger(n) && n >= 0) || body.deductions_minor > body.gross_minor) fail('Use nonnegative integer minor currency units.');
    if (body.breakdown?.payment) body.breakdown.payment = validatePaymentDetails(body.breakdown.payment);
    const id = crypto.randomUUID();
    await statement(db, 'INSERT INTO payroll(payroll_id,company_id,employee_id,period,gross_minor,deductions_minor,currency,breakdown) VALUES(?,?,?,?,?,?,?,?)', [id, actor.company_id, employee, body.period, body.gross_minor, body.deductions_minor, 'INR', JSON.stringify(object(body.breakdown))]).run(); return { payroll_id: id };
  }
  const listTable = { '/api/v1/get-attendance': 'attendance', '/api/v1/get-leave': 'leave_requests', '/api/v1/get-salary': 'payroll' }[path];
  if (listTable && method === 'GET') {
    const filters = Object.fromEntries(url.searchParams);
    const employee = actor.role === 'company_admin' && !filters.employee_id && !filters.userid ? null : await employeeTarget(db, actor, filters);
    if (listTable === 'attendance' && filters.year && filters.month) {
      const names=['January','February','March','April','May','June','July','August','September','October','November','December'];
      const year=Number(filters.year), month=names.indexOf(filters.month)+1 || Number(filters.month);
      if(!Number.isInteger(year)||year<1900||year>9999||!Number.isInteger(month)||month<1||month>12)fail('Invalid attendance month.');
      const start=year+'-'+String(month).padStart(2,'0')+'-01';
      const end=new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
      const args=employee?[actor.company_id,employee,start,end]:[actor.company_id,start,end];
      const records=await rows(db,`SELECT * FROM attendance WHERE company_id=? ${employee?'AND employee_id=?':''} AND date>=? AND date<? ORDER BY date DESC`,args);
      const leaves=await rows(db,`SELECT * FROM leave_requests WHERE company_id=? ${employee?'AND employee_id=?':''} AND start_date<? AND end_date>=? AND status='Approved'`,employee?[actor.company_id,employee,end,start]:[actor.company_id,end,start]);
      return attendanceSummary(records,leaves,employee,year,month,new Date(Date.now()+330*60000).toISOString().slice(0,10));
    }
    return rows(db, `SELECT * FROM ${listTable} WHERE company_id=? ${employee ? 'AND employee_id=?' : ''} LIMIT 200`, employee ? [actor.company_id, employee] : [actor.company_id]);
  }
  if (path === '/api/v1/documents' || path.startsWith('/api/v1/documents/')) return documentHandle({ request, env, db, actor, url, path, method });
  if (path === '/api/v1/get-user-notification') {
    return [];
  }
  if (path === '/api/v1/chat/unread-summary') {
    return { total_unread: 0, direct_unread: 0, channels_unread: 0, by_conversation: {} };
  }
  if (path === '/api/v1/chat/conversations') {
    return [];
  }
  fail('Route not available in the company API.', 404);
}


export function allowedOrigin(origin, env) {
  if (!origin) return true;
  const configured = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim());
  if (configured.includes('*') || configured.includes(origin)) return true;
  if (env.ALLOW_LOCALHOST_ORIGINS !== 'true') return false;
  try {
    const url = new URL(origin);
    return url.origin === origin && ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const headers = {
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff'
    };
    if (!allowedOrigin(origin, env)) return Response.json({ success: false, message: 'Origin not allowed.' }, { status: 403, headers });
    if (origin) Object.assign(headers, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Authkey, Cache-Control, Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD'
    });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      const data = await handle(request, env, ctx);
      if (data instanceof Response) { const response = new Response(data.body, data); for (const [key, value] of Object.entries(headers)) response.headers.set(key, value); return response; }
      return Response.json({ success: true, data }, { headers });
    } catch (error) {
      if (/plan limit reached/.test(error.message)) return Response.json({ success: false, message: 'Your company plan limit has been reached or expired. Review Plan & Subscription in Settings.' }, { status: 409, headers });
      const conflict = /UNIQUE constraint failed/.test(error.message);
      return Response.json({ success: false, message: conflict ? 'An account or record with these identifiers already exists.' : error.status ? error.message : 'Service unavailable.' }, { status: conflict ? 409 : error.status || 503, headers });
    }
  },

  async scheduled(event, env, ctx) {
    const billingWork=import('./billingRecurring.mjs').then(({reconcileRecurringSubscriptions})=>reconcileRecurringSubscriptions(env.DB,env)).catch(()=>console.warn('Billing reconciliation requires retry.'));
    if(ctx)ctx.waitUntil(billingWork);else await billingWork;
    await expireOffers(env.DB);
    await processDocumentAlerts(env.DB);
    await processAppraisalTimers(env.DB);
    await processWorkflowTimers(env.DB);
    await processLifecycleTimers(env.DB);
    await env.DB.batch([
      statement(env.DB, 'DELETE FROM sessions WHERE expires_at<?', [Date.now()]),
      statement(env.DB, 'DELETE FROM login_attempts WHERE window_start<?', [Date.now() - 900000])
    ]);
  }
};

export class ChatRoomDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    return new Response('OK');
  }
}

