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
const publicUser = user => ({ user_id: user.user_id, userid: user.user_id, company_id: user.company_id, username: user.username, ...(user.first_name != null ? { first_name: user.first_name, last_name: user.last_name || '' } : {}), name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username, profile_pic_url: user.profile_pic_url || '', email: user.email, role: user.role, dashboard_access: Boolean(user.dashboard_access), dashboard_pages: parsePages(user.dashboard_pages), type: user.role === 'company_admin' ? 'Super Admin' : user.dashboard_access ? 'Dashboard User' : 'Employee', status: user.status, must_change_password: Boolean(user.must_change_password) });

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
  if (!/^[a-z0-9][a-z0-9._-]{2,99}$/.test(username)) fail('Username must be 3–100 letters, numbers, dots, underscores or hyphens.');
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

async function authenticate(request, db) {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) fail('Sign in required.', 401);
  const tokenHash = await digest(token);
  const user = await statement(db, `SELECT u.*, e.employee_id, e.first_name, e.last_name, json_extract(e.profile,'$.profile_pic_url') AS profile_pic_url, e.dashboard_access, e.dashboard_pages FROM sessions s
    JOIN users u ON u.company_id=s.company_id AND u.user_id=s.user_id
    JOIN companies c ON c.company_id=u.company_id
    LEFT JOIN employees e ON e.company_id=u.company_id AND e.user_id=u.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' AND c.status='active'`, [tokenHash, Date.now()]).first();
  if (!user) fail('Session expired or account disabled.', 401);
  return { ...user, tokenHash };
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

async function handle(request, env) {
  const db = env.DB;
  if (!db) fail('Database binding is missing.', 503);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  const method = request.method;
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
    const token = randomToken();
    await db.batch([
      statement(db, 'DELETE FROM login_attempts WHERE identifier_hash=?', [identifierHash]),
      statement(db, 'INSERT INTO sessions(token_hash,company_id,user_id,expires_at) VALUES(?,?,?,?)', [await digest(token), user.company_id, user.user_id, now + 8 * 3600000])
    ]);
    return { ...publicUser(user), token };
  }
  const actor = await authenticate(request, db);
  if (path === '/api/v1/auth/verify' && method === 'GET') {
    if (actor.must_change_password) fail('Change your initial password before continuing.', 403);
    return publicUser(actor);
  }
  if (path === '/api/v1/logout' && method === 'POST') {
    await statement(db, 'DELETE FROM sessions WHERE token_hash=?', [actor.tokenHash]).run(); return { logged_out: true };
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
  if (path.startsWith('/api/v1/billing/')) return billingHandle({ db, env, actor, path, method, body: method === 'POST' ? await bodyOf(request) : {} });
  if (path === '/api/v1/dashboard-users') return dashboardAdmin({ db, actor, path, method, body: method === 'POST' ? await bodyOf(request) : {}, hashPassword });
  if (path.startsWith('/api/v1/dashboard-configuration/')) return dashboardConfiguration({ db, actor, section: path.split('/').pop(), method, body: method === 'POST' ? await bodyOf(request) : {} });
  if (actor.role !== 'company_admin' && actor.dashboard_access) {
    const allowed = routePages(path, method).some(page => parsePages(actor.dashboard_pages).includes(page));
    if (!allowed) fail('Your dashboard account does not have access to this page.', 403);
    if (path === '/api/v1/get-all-users' && !parsePages(actor.dashboard_pages).includes('employees')) {
      return rows(db, "SELECT e.user_id AS userid,e.employee_id,e.employee_code,e.first_name,e.last_name,e.department,e.designation,e.status,json_extract(e.profile,'$.profile_pic_url') AS profile_pic_url FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND u.status='active'", [actor.company_id]);
    }
    actor.role = 'company_admin'; // Request-scoped elevation only after the explicit route permission check.
  }
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
    const userRows = await rows(db, `SELECT e.employee_id,e.employee_code,e.first_name,e.last_name,e.department,e.designation,e.status,e.profile,u.user_id AS userid,u.email,u.username,u.company_id,'Employee' AS type
      FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? ORDER BY e.first_name,e.employee_id LIMIT ? OFFSET ?`, [actor.company_id, limit, offset]);
    return userRows.map(row => {
      let parsed = {};
      try { parsed = typeof row.profile === 'string' ? JSON.parse(row.profile || '{}') : (row.profile || {}); } catch {}
      return { ...row, profile: parsed, profile_pic_url: parsed.profile_pic_url || row.profile_pic_url };
    });
  }
  if (path === '/api/v1/get-user' && method === 'GET') {
    const target = url.searchParams.get('userid') || actor.user_id;
    if (target !== actor.user_id) admin(actor);
    const user = await statement(db, 'SELECT * FROM users WHERE company_id=? AND user_id=?', [actor.company_id, target]).first();
    if (!user) fail('User not found.', 404);
    const employee = await statement(db, 'SELECT * FROM employees WHERE company_id=? AND user_id=?', [actor.company_id, target]).first();
    let parsedProfile = {};
    try { parsedProfile = typeof employee?.profile === 'string' ? JSON.parse(employee?.profile || '{}') : (employee?.profile || {}); } catch {}
    return [{ ...(employee || {}), ...publicUser(user), profile: parsedProfile, profile_pic_url: parsedProfile.profile_pic_url || employee?.profile_pic_url, ...(employee ? { status: employee.status } : { first_name: user.username }) }];
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
    if (!key || !key.startsWith('profile/')) fail('Photo not found.', 404);
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
    let employee = await statement(db, `SELECT e.employee_id, e.user_id, e.employee_code, e.profile
      FROM employees e
      LEFT JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id
      WHERE e.company_id=? AND (e.user_id=? OR e.employee_code=? OR e.employee_id=? OR u.username=?)`, [actor.company_id, target, target, target, target]).first();

    if (!employee && actor.role === 'company_admin') {
      const user = await statement(db, 'SELECT user_id, username FROM users WHERE company_id=? AND (user_id=? OR username=?)', [actor.company_id, target, target]).first();
      if (user) {
        const empId = crypto.randomUUID();
        await statement(db, 'INSERT OR IGNORE INTO employees(employee_id, company_id, user_id, employee_code, first_name) VALUES(?,?,?,?,?)', [empId, actor.company_id, user.user_id, user.username, user.username]).run();
        employee = await statement(db, 'SELECT employee_id, user_id, employee_code, profile FROM employees WHERE company_id=? AND user_id=?', [actor.company_id, user.user_id]).first();
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

    // Format target company name directory e.g. profile/company-name/...
    const company = await statement(db, 'SELECT name FROM companies WHERE company_id=?', [actor.company_id]).first();
    const companyName = (company?.name || 'company').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'company';
    const filename = `${employee.employee_code || employee.user_id}_${Date.now()}.${ext}`;
    const key = `profile/${companyName}/${filename}`;

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
    admin(actor);
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
      await store.change(actor.company_id, column, id, { ...body, id }); return { ...body, id };
    }
    if (method === 'DELETE' && section[1]) { await store.change(actor.company_id, column, section[1]); return { deleted: true }; }
  }
  if (path === '/api/v1/attendance' && method === 'POST') {
    const body = await bodyOf(request), employee = await employeeTarget(db, actor, body);
    const now = new Date().toISOString(), day = now.slice(0, 10);
    if (body.action === 'check-out') {
      const result = await statement(db, 'UPDATE attendance SET check_out_time=? WHERE company_id=? AND employee_id=? AND date=? AND check_out_time IS NULL RETURNING attendance_id', [now, actor.company_id, employee, day]).first();
      if (!result) fail('Open attendance record not found.', 409); return result;
    }
    if (body.action !== 'check-in') fail('Use check-in or check-out.');
    const id = crypto.randomUUID();
    await statement(db, 'INSERT INTO attendance(attendance_id,company_id,employee_id,date,check_in_time) VALUES(?,?,?,?,?)', [id, actor.company_id, employee, day, now]).run();
    return { attendance_id: id };
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
    const id = crypto.randomUUID();
    await statement(db, 'INSERT INTO payroll(payroll_id,company_id,employee_id,period,gross_minor,deductions_minor,currency,breakdown) VALUES(?,?,?,?,?,?,?,?)', [id, actor.company_id, employee, body.period, body.gross_minor, body.deductions_minor, 'INR', JSON.stringify(object(body.breakdown))]).run(); return { payroll_id: id };
  }
  const listTable = { '/api/v1/get-attendance': 'attendance', '/api/v1/get-leave': 'leave_requests', '/api/v1/get-salary': 'payroll' }[path];
  if (listTable && method === 'GET') {
    const filters = Object.fromEntries(url.searchParams);
    const employee = actor.role === 'company_admin' && !filters.employee_id && !filters.userid ? null : await employeeTarget(db, actor, filters);
    return rows(db, `SELECT * FROM ${listTable} WHERE company_id=? ${employee ? 'AND employee_id=?' : ''} LIMIT 200`, employee ? [actor.company_id, employee] : [actor.company_id]);
  }
  if (path === '/api/v1/documents' || path.startsWith('/api/v1/documents/')) return documentHandle({ request, env, db, actor, url, path, method });
  fail('Route not available in the company API.', 404);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
    if (origin && !allowed.includes(origin)) return Response.json({ success: false, message: 'Origin not allowed.' }, { status: 403, headers });
    if (origin) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      const data = await handle(request, env);
      if (data instanceof Response) { const response = new Response(data.body, data); for (const [key, value] of Object.entries(headers)) response.headers.set(key, value); return response; }
      return Response.json({ success: true, data }, { headers });
    } catch (error) {
      if (/plan limit reached/.test(error.message)) return Response.json({ success: false, message: 'Your company plan limit has been reached or expired. Review Plan & Subscription in Settings.' }, { status: 409, headers });
      const conflict = /UNIQUE constraint failed/.test(error.message);
      return Response.json({ success: false, message: conflict ? 'An account or record with these identifiers already exists.' : error.status ? error.message : 'Service unavailable.' }, { status: conflict ? 409 : error.status || 503, headers });
    }
  },
  async scheduled(event, env) {
    await processWorkflowTimers(env.DB);
    await env.DB.batch([
      statement(env.DB, 'DELETE FROM sessions WHERE expires_at<?', [Date.now()]),
      statement(env.DB, 'DELETE FROM login_attempts WHERE window_start<?', [Date.now() - 900000])
    ]);
  }
};
