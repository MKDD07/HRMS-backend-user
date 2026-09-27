import { dashboardAuthorization } from './dashboardAuthorization.mjs';
import express from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { AwsClient } from 'aws4fetch';
import { createPayrollDatabase, existingCloudflareConfig } from './payrollDatabase.mjs';
import { validateTemplate, normalizeSalary, textValue, PAY_MONTHS } from '../src/lib/payslipModel.js';
import { createPayslipDocument } from '../src/lib/payslipDocument.js';

const decode = row => row ? JSON.parse(row.payload) : null;
const safeId = value => { const id = String(value || ''); if (!/^[\w-]{1,100}$/.test(id)) throw new Error('Invalid record identifier.'); return id; };
const safeEmployee = person => Object.fromEntries(['userid', 'first_name', 'last_name', 'department', 'designation'].map(key => [key, textValue(person[key], 100)]));
export function createR2Storage(env = process.env) {
  const { bucket } = existingCloudflareConfig();
  const configured = Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && bucket);
  const client = configured ? new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto', retries: 2 }) : null;
  const urlFor = key => `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  return { configured, async upload(key, pdf) {
    if (!client) throw new Error('R2 is not configured. Salary is saved; configure R2 and retry generation.');
    const response = await client.fetch(urlFor(key), { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdf, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`R2 upload failed (${response.status}). Retry generation.`);
  }, async downloadUrl(key) {
    if (!client) throw new Error('R2 is not configured.');
    const url = new URL(urlFor(key)); url.searchParams.set('X-Amz-Expires', '300');
    url.searchParams.set('response-content-disposition', `attachment; filename="${key.split('/').pop()}"`);
    const signed = await client.sign(new Request(url), { aws: { signQuery: true } });
    return signed.url;
  } };
}
export async function payrollAuthorization(req, env = process.env) {
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) return dashboardAuthorization(req, env);
  // Never trust the browser's claimed user/role. Production uses the existing identity service.
  if (env.PAYROLL_AUTH_VERIFY_URL) {
    const target = new URL(env.PAYROLL_AUTH_VERIFY_URL);
    if (target.protocol !== 'https:') throw new Error('The authentication verifier must use HTTPS.');
    if (!req.headers.authorization?.startsWith('Bearer ')) return null;
    const result = await fetch(target, { headers: { Authorization: req.headers.authorization }, signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!result.ok) return null;
    const body = await result.json();
    if (body.success !== true || !body.data?.userid) return null;
    return { userid: String(body.data.userid), company_id: body.data.company_id, role: body.data.role, dashboard_access: body.data.dashboard_access, dashboard_pages: body.data.dashboard_pages || [], admin: body.data.type === 'Super Admin' };
  }
  const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '');
  if (env.NODE_ENV !== 'production' && env.PAYROLL_LOCAL_DEV === 'true' && loopback && localHost) return { userid: 'local-admin', company_id: 'local-development', admin: true };
  return null;
}
export function createPayrollRouter({ database, storage, authorize = payrollAuthorization } = {}) {
  const router = express.Router();
  let db = database; const r2 = storage || createR2Storage();
  // ponytail: deduplicates within one server process; deterministic R2 keys make cross-process retries safe.
  const inFlight = new Map();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.headers.origin && req.headers.origin !== `${req.protocol}://${req.headers.host}`) return res.status(403).json({ message: 'Cross-origin payroll requests are not allowed.' });
    next();
  });
  router.use(async (req, res, next) => {
    try {
      const actor = await authorize(req);
      if (actor?.dashboard_access && actor.role !== 'company_admin') {
        if (!actor.dashboard_pages?.some(page => ['payroll', 'salary-structure'].includes(page))) return res.status(403).json({ message: 'Payroll page access required.' });
        // The legacy payslip store is not tenant-scoped; its management remains Super Admin only.
      }
      if (!actor) return res.status(401).json({ message: 'Payroll requires verified authentication. Configure PAYROLL_AUTH_VERIFY_URL, or enable PAYROLL_LOCAL_DEV=true for loopback-only development.' });
      res.locals.actor = actor; db ||= createPayrollDatabase(); await db.ready(); next();
    } catch (error) { res.status(503).json({ message: error.message }); }
  });
  router.use(express.json({ limit: '3mb' }));
  const route = (handler, admin = true) => async (req, res) => {
    if (admin && !res.locals.actor.admin) return res.status(403).json({ message: 'Only Super Admin can manage payroll.' });
    try { await handler(req, res); } catch (error) { res.status(400).json({ message: error.message }); }
  };
  const load = async (table, id) => decode((await db.query(`SELECT payload FROM ${table} WHERE id = ?`, [id]))[0]);
  const list = async table => (await db.query(`SELECT payload FROM ${table}`)).map(decode);
  const save = (table, id, value) => db.query(`INSERT INTO ${table}(id, payload) VALUES(?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`, [id, JSON.stringify(value)]);
  router.get('/configuration', route(async (req, res) => res.json({ templates: await list('payslip_templates'), groups: await list('payslip_groups'), assignments: await list('payslip_assignments'), storage: { database: db.mode, r2: r2.configured, localDevelopment: res.locals.actor.userid === 'local-admin' } })));
  router.post('/templates', route(async (req, res) => {
    const body = req.body; const value = validateTemplate(body); const id = body.id ? safeId(body.id) : randomUUID();
    const previous = await load('payslip_templates', id);
    if (previous && previous.design !== value.design) throw new Error('A saved variant keeps its base design. Create a new variant to change designs.');
    if (previous && previous.version !== body.version) throw new Error('This template changed elsewhere. Reload before editing.');
    createPayslipDocument({ employee: { userid: 'VALIDATION' }, salaryRecord: {}, template: value, month: 'January', year: '2026' });
    const now = new Date().toISOString();
    const template = { ...value, id, version: (previous?.version || 0) + 1, updated_at: now };
    if (previous) {
      const updated = await db.query('UPDATE payslip_templates SET version = ?, payload = ? WHERE id = ? AND version = ? RETURNING id', [template.version, JSON.stringify(template), id, previous.version]);
      if (!updated.length) throw new Error('Concurrent template edit. Reload and try again.');
    } else {
      const slots = await db.query('SELECT slot FROM payslip_templates WHERE design = ?', [value.design]);
      const slot = [1, 2, 3, 4, 5].find(n => !slots.some(item => item.slot === n));
      if (!slot) throw new Error('This design already has five variants. Edit an existing variant.');
      await db.query('INSERT INTO payslip_templates(id, design, slot, version, payload) VALUES(?, ?, ?, ?, ?)', [id, value.design, slot, 1, JSON.stringify(template)]);
    }
    res.json(template);
  }));
  router.post('/groups', route(async (req, res) => {
    const group = { id: req.body.id ? safeId(req.body.id) : randomUUID(), name: textValue(req.body.name, 100), type: textValue(req.body.type, 100), template_id: safeId(req.body.template_id) };
    if (!group.name || !group.type || !await load('payslip_templates', group.template_id)) throw new Error('Group name, type and a saved template are required.');
    await save('payslip_groups', group.id, group); res.json(group);
  }));
  router.post('/assignments', route(async (req, res) => {
    const assignment = { id: safeId(req.body.userid), group_id: req.body.group_id ? safeId(req.body.group_id) : '', template_id: req.body.template_id ? safeId(req.body.template_id) : '', auto_generate: req.body.auto_generate !== false };
    if (assignment.group_id && !await load('payslip_groups', assignment.group_id)) throw new Error('Group not found.');
    if (assignment.template_id && !await load('payslip_templates', assignment.template_id)) throw new Error('Template not found.');
    if (!assignment.group_id && !assignment.template_id) throw new Error('Choose a group or an individual template.');
    await save('payslip_assignments', assignment.id, assignment); res.json(assignment);
  }));
  async function generate(id) {
    if (inFlight.has(id)) return inFlight.get(id);
    const task = (async () => {
      const row = (await db.query('SELECT * FROM payslip_records WHERE id = ?', [id]))[0];
      if (!row) throw new Error('Payslip record not found.');
      if (row.status === 'ready') return row;
      const record = decode(row);
      try {
        const pdf = createPayslipDocument({ employee: record.employee, salaryRecord: record.salary, template: record.template, month: row.month, year: row.year });
        const key = `payslips/${row.userid}/${row.year}/${row.month}/${id}.pdf`;
        await r2.upload(key, new Uint8Array(pdf.output('arraybuffer')));
        await db.query("UPDATE payslip_records SET status = 'ready', object_key = ?, error = NULL WHERE id = ?", [key, id]);
        return { ...row, status: 'ready', object_key: key, error: null };
      } catch (error) {
        await db.query("UPDATE payslip_records SET status = 'failed', error = ? WHERE id = ? AND status != 'ready'", [textValue(error.message, 400), id]);
        return (await db.query('SELECT * FROM payslip_records WHERE id = ?', [id]))[0];
      }
    })();
    inFlight.set(id, task); try { return await task; } finally { inFlight.delete(id); }
  }
  const publicRecord = row => ({ id: row.id, userid: row.userid, year: row.year, month: row.month, created_at: row.created_at, status: row.status, error: row.error, ...decode(row), download_path: row.status === 'ready' ? `/api/payroll-studio/records/${row.id}/download` : null });
  router.post('/salaries', route(async (req, res) => {
    const employee = safeEmployee(req.body.employee || {}); employee.userid = safeId(employee.userid);
    const month = req.body.month, year = String(req.body.year);
    if (!PAY_MONTHS.includes(month) || !/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2200) throw new Error('Choose a valid salary period.');
    const salary = normalizeSalary(req.body.salary || {});
    const daysInMonth = new Date(Number(year), PAY_MONTHS.indexOf(month) + 1, 0).getDate();
    if (salary.paid_days !== '' && salary.paid_days > daysInMonth) throw new Error('Paid days cannot exceed the days in this month.');
    if (salary.pay_date && (!/^\d{4}-\d{2}-\d{2}$/.test(salary.pay_date) || !Number.isFinite(Date.parse(salary.pay_date)) || new Date(salary.pay_date).toISOString().slice(0, 10) !== salary.pay_date)) throw new Error('Enter a valid payment date.');
    const assignment = await load('payslip_assignments', employee.userid);
    if (!assignment) throw new Error('Assign a payslip group or template to this employee first.');
    const group = assignment.group_id ? await load('payslip_groups', assignment.group_id) : null;
    const template = await load('payslip_templates', assignment.template_id || group?.template_id);
    if (!template) throw new Error('Assigned template is unavailable.');
    const payload = { employee, salary, template, group_name: group?.name || '', saved_by: res.locals.actor.userid };
    // Same salary/template revision produces one record; template edits never rewrite issued PDFs.
    const id = createHash('sha256').update(JSON.stringify({ employee, year, month, salary, template })).digest('hex');
    await db.query("INSERT OR IGNORE INTO payslip_records(id, userid, year, month, created_at, status, payload) VALUES(?, ?, ?, ?, ?, 'pending', ?)", [id, employee.userid, year, month, new Date().toISOString(), JSON.stringify(payload)]);
    const row = assignment.auto_generate || req.body.generate === true ? await generate(id) : (await db.query('SELECT * FROM payslip_records WHERE id = ?', [id]))[0];
    res.json(publicRecord(row));
  }));
  router.get('/records/:userid', route(async (req, res) => {
    if (!res.locals.actor.admin && res.locals.actor.userid !== req.params.userid) return res.status(403).json({ message: 'You can only view your own payslips.' });
    const rows = await db.query('SELECT * FROM payslip_records WHERE userid = ? ORDER BY created_at DESC', [safeId(req.params.userid)]);
    res.json(rows.map(publicRecord));
  }, false));
  router.post('/records/:id/generate', route(async (req, res) => { res.json(publicRecord(await generate(safeId(req.params.id)))); }));
  router.get('/records/:id/download', route(async (req, res) => {
    const row = (await db.query('SELECT * FROM payslip_records WHERE id = ?', [safeId(req.params.id)]))[0];
    if (!row || (!res.locals.actor.admin && res.locals.actor.userid !== row.userid)) return res.status(404).json({ message: 'Payslip not found.' });
    if (row.status !== 'ready' || !row.object_key) throw new Error('Generate and upload this payslip before downloading.');
    res.json({ url: await r2.downloadUrl(row.object_key), expires_in: 300 });
  }, false));
  return router;
}
