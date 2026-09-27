const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const stmt = (db, sql, params = []) => db.prepare(sql).bind(...params);
const required = (value, label, max) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label} is required (maximum ${max} characters).`);
  return value.trim();
};
const serialize = row => ({ ...row, recipients: JSON.parse(row.recipients), history: JSON.parse(row.history) });
export async function hrConnectHandle({ db, actor, path, method, body, url }) {
  const admin = actor.role === 'company_admin';
  const id = path.slice('/api/v1/hr-connect'.length).replace(/^\//, '');
  if (method === 'GET' && !id) {
    const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0));
    const rows = await stmt(db, `SELECT * FROM hr_connect WHERE company_id=? ${admin ? '' : "AND ((kind IN ('announcement','message') AND status='Published' AND EXISTS (SELECT 1 FROM json_each(recipients) WHERE value=?)) OR (kind='grievance' AND requester_id=?))"} ORDER BY updated_at DESC,id LIMIT 100 OFFSET ?`, [actor.company_id, ...(!admin ? [actor.user_id, actor.user_id] : []), offset]).all();
    return rows.results.map(row => { const value = serialize(row); if (!admin) { delete value.history; delete value.recipients; } return value; });
  }
  if (method !== 'POST') fail('Route not found.', 404);
  if (id) {
    if (!admin) fail('Company administrator access required.', 403);
    const row = await stmt(db, 'SELECT * FROM hr_connect WHERE company_id=? AND id=?', [actor.company_id, id]).first();
    if (!row) fail('Record not found.', 404);
    if (!Number.isInteger(body.revision)) fail('A record revision is required.');
    if (row.kind !== 'grievance') {
      if (row.kind === 'email' || row.status !== 'Draft' || body.status !== 'Published') fail('This record cannot be published.');
      const result = await stmt(db, "UPDATE hr_connect SET status='Published',updated_at=?,revision=revision+1 WHERE company_id=? AND id=? AND revision=? AND status='Draft' RETURNING id", [new Date().toISOString(), actor.company_id, id, body.revision]).first();
      if (!result) fail('This record changed. Refresh before publishing.', 409);
      return serialize(await stmt(db, 'SELECT * FROM hr_connect WHERE company_id=? AND id=?', [actor.company_id, id]).first());
    }
    if (!['Open', 'In review', 'Resolved'].includes(body.status)) fail('Invalid review status.');
    const note = required(body.note, 'Review note', 4000);
    const history = [...JSON.parse(row.history), { status: body.status, note, actor: actor.username, at: new Date().toISOString() }];
    const result = await stmt(db, 'UPDATE hr_connect SET status=?,history=?,updated_at=?,revision=revision+1 WHERE company_id=? AND id=? AND revision=? RETURNING id', [body.status, JSON.stringify(history), new Date().toISOString(), actor.company_id, id, body.revision]).first();
    if (!result) fail('This grievance changed. Refresh before reviewing again.', 409);
    return serialize(await stmt(db, 'SELECT * FROM hr_connect WHERE company_id=? AND id=?', [actor.company_id, id]).first());
  }
  const kind = body.kind;
  if (!['announcement', 'message', 'email', 'grievance'].includes(kind)) fail('Invalid record type.');
  if (!admin && kind !== 'grievance') fail('Company administrator access required.', 403);
  const title = required(body.title, 'Subject', 200), content = required(body.body, 'Message', 10000);
  const priority = body.priority || 'Normal';
  if (!['Normal', 'High', 'Urgent'].includes(priority)) fail('Invalid priority.');
  const status = kind === 'grievance' ? 'Open' : body.status || 'Draft';
  if (kind !== 'grievance' && (!['Draft', 'Published'].includes(status) || (kind === 'email' && status !== 'Draft'))) fail('Email delivery is not connected. Save an email draft.');
  const people = (await stmt(db, "SELECT u.user_id,e.department FROM users u JOIN employees e ON e.user_id=u.user_id AND e.company_id=u.company_id WHERE u.company_id=? AND u.status='active' AND e.status!='Inactive'", [actor.company_id]).all()).results;
  let requester = null, recipients = [], audience = 'All employees';
  if (kind === 'grievance') {
    requester = admin ? body.requester_id : actor.user_id;
    if (!people.some(p => p.user_id === requester)) fail('Select an active employee.');
    audience = 'Private HR review';
  } else {
    const scope = body.scope || 'all';
    if (!['all', 'department', 'employee'].includes(scope)) fail('Invalid audience.');
    recipients = people.filter(p => scope === 'all' || (scope === 'department' ? p.department === body.target : p.user_id === body.target)).map(p => p.user_id);
    audience = scope === 'all' ? 'All employees' : scope === 'department' ? body.target : 'Selected employee';
    if (!recipients.length) fail('Select an audience with active employees.');
  }
  const recordId = crypto.randomUUID(), time = new Date().toISOString();
  await stmt(db, 'INSERT INTO hr_connect(id,company_id,kind,title,body,status,audience,recipients,priority,requester_id,author_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', [recordId, actor.company_id, kind, title, content, status, audience, JSON.stringify(recipients), priority, requester, actor.user_id, time, time]).run();
  return serialize(await stmt(db, 'SELECT * FROM hr_connect WHERE company_id=? AND id=?', [actor.company_id, recordId]).first());
}
