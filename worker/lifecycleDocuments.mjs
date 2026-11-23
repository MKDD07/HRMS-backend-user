import { DOCUMENT_TYPES, defaultContent, probationEnd, mergeContent, validateContent, documentHtml } from '../shared/lifecycleDocuments.mjs';
const stmt = (db, sql, params = []) => db.prepare(sql).bind(...params);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export function documentEmail(content, title) {
  const attachments = [], images = new Map();
  const html = documentHtml(content, title).replace(/src="data:image\/(png|jpeg);base64,([a-zA-Z0-9+/=]+)"/g, (match, type, encoded) => {
    if (!images.has(encoded)) { const cid = `letter-image-${images.size}`; images.set(encoded, cid); attachments.push({ filename: `${cid}.${type === 'jpeg' ? 'jpg' : 'png'}`, content: encoded, content_type: `image/${type}`, content_id: cid }); }
    return `src="cid:${images.get(encoded)}"`;
  });
  return { html, ...(attachments.length ? { attachments } : {}) };
}

// Deterministic IDs make retries and concurrent scheduled runs safe without replacing HR edits.
export async function generateLifecycleDrafts(db, company, page, now = new Date()) {
  const rows = await stmt(db, `SELECT t.*,e.profile,e.first_name,e.last_name,e.department,e.designation,e.employee_code,c.name AS company_name
    FROM talent_records t JOIN employees e ON e.company_id=t.company_id AND e.user_id=json_extract(t.payload,'$.employee_id')
    JOIN companies c ON c.company_id=t.company_id WHERE t.collection=? AND t.company_id=?`, [page, company]).all();
  const templates = await stmt(db, 'SELECT payload FROM talent_records WHERE company_id=? AND collection=? ORDER BY updated_at DESC,id', [company, page + '_templates']).all();
  const published = templates.results.map(row => JSON.parse(row.payload)).filter(t => t.status === 'Published');
  const settings = await stmt(db, "SELECT payload FROM talent_records WHERE company_id=? AND collection='letter_settings' AND id='company-letterhead'", [company]).first();
  const branding = settings ? validateContent(JSON.parse(settings.payload).content).branding || {} : {};
  const threshold = new Date(now); threshold.setUTCDate(threshold.getUTCDate() + 14);
  let created = 0;
  for (const row of rows.results) {
    const plan = JSON.parse(row.payload);
    if (plan.status === 'Cancelled') continue;
    const profile = JSON.parse(row.profile || '{}'), end = probationEnd(profile, plan);
    const fields = { ...profile, employee_name: [row.first_name, row.last_name].filter(Boolean).join(' '), company_name: branding.company_name || row.company_name, company_address: branding.company_address || '', signatory: branding.signatory || '', signatory_role: branding.signatory_role || '', designation: row.designation, department: row.department, joining_date: page === 'onboarding' ? plan.start_date : profile.date_of_joining || profile.joining_date, probation_end_date: end, probation_months: plan.probation_months || profile.probation_months || '', employee_id: row.employee_code || plan.employee_id, letter_date: now.toISOString().slice(0,10), notice_date: plan.start_date, last_working_date: plan.due_date };
    for (const [kind, title, body] of DOCUMENT_TYPES[page]) {
      if (['confirmation', 'extension'].includes(kind)) continue;
      if (kind === 'probation' && (!end || end > threshold.toISOString().slice(0, 10))) continue;
      const source = `${row.id}:${kind}${kind === 'probation' ? ':' + end : ''}`;
      const id = 'auto:' + source;
      const template = published.find(item => item.kind === kind);
      const content = { ...mergeContent(template ? validateContent(template.content) : defaultContent(title, body), fields), branding };
      const payload = { title: template?.title || title, employee_id: plan.employee_id, kind, source_key: source, status: 'Draft', content: JSON.stringify(content), history: [{ at: now.toISOString(), actor: 'automation', status: 'Draft' }] };
      const result = await stmt(db, `INSERT OR IGNORE INTO talent_records(company_id,collection,id,payload,created_at,updated_at) VALUES(?,?,?,?,?,?) RETURNING id`, [company, page + '_documents', id, JSON.stringify(payload), now.toISOString(), now.toISOString()]).first();
      if (result) created++;
    }
  }
  return { created };
}
export async function processLifecycleTimers(db) {
  const companies = await stmt(db, "SELECT DISTINCT company_id,collection FROM talent_records WHERE collection IN ('onboarding','offboarding')").all();
  for (const row of companies.results) await generateLifecycleDrafts(db, row.company_id, row.collection);
}
export async function lifecycleAction({ db, actor, page, id, action, env, body }) {
  if (actor.role !== 'company_admin') fail('Dashboard administrator access required.', 403);
  if (action === 'generate') return generateLifecycleDrafts(db, actor.company_id, page);
  const collection = page + '_documents';
  const row = await stmt(db, 'SELECT * FROM talent_records WHERE company_id=? AND collection=? AND id=?', [actor.company_id, collection, id]).first();
  if (!row) fail('Document not found.', 404);
  const record = JSON.parse(row.payload);
  if (record.status !== 'Finalized') fail('Finalize the document before sending.');
  if (record.delivery?.id) return record.delivery;
  if (body.revision !== row.revision) fail('The document changed. Refresh before sending.', 409);
  if (!env.RESEND_API_KEY || !env.DOCUMENT_EMAIL_FROM) fail('Email delivery is not configured. Set RESEND_API_KEY and DOCUMENT_EMAIL_FROM on the server.', 503);
  const user = await stmt(db, 'SELECT email FROM users WHERE company_id=? AND user_id=?', [actor.company_id, record.employee_id]).first();
  if (!user?.email) fail('This employee has no email address. Update their employee profile.');
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `hr-document/${actor.company_id}/${id}` }, body: JSON.stringify({ from: env.DOCUMENT_EMAIL_FROM, to: [user.email], subject: record.title, ...documentEmail(validateContent(record.content), record.title) }) });
  if (!response.ok) fail('The email provider did not accept the email. Retry after checking the provider configuration.', 502);
  const result = await response.json();
  if (!result.id) fail('The email provider returned no message reference.', 502);
  record.delivery = { id: result.id, recipient: user.email, at: new Date().toISOString(), status: 'Accepted by email provider' };
  await stmt(db, 'UPDATE talent_records SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND collection=? AND id=?', [JSON.stringify(record), record.delivery.at, actor.company_id, collection, id]).run();
  return record.delivery;
}
