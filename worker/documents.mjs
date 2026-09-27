const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TYPES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', txt: 'text/plain' };
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const stmt = (db, sql, values = []) => db.prepare(sql).bind(...values);
const admin = actor => { if (actor.role !== 'company_admin') fail('Company administrator access required.', 403); };
const metadata = doc => JSON.parse(doc.metadata || '{}');
const select = `SELECT d.*, e.user_id AS userid, u.username AS uploader FROM documents d LEFT JOIN employees e ON e.company_id=d.company_id AND e.employee_id=d.employee_id LEFT JOIN users u ON u.company_id=d.company_id AND u.user_id=d.uploaded_by`;
function serialize(doc) {
  const m = metadata(doc);
  return { id: doc.document_id, document_id: doc.document_id, employee_id: doc.employee_id, userid: doc.userid, title: doc.title, category: doc.employee_id ? undefined : m.category || 'General', doc_type: doc.employee_id ? m.category || 'General' : undefined, description: m.description || '', version: m.version || '', effective_date: m.effective_date || '', mandatory_acknowledgement: m.mandatory_acknowledgement === true, document_number: m.document_number || '', verified: m.verified === true, verified_by: m.verified_by || null, created_at: doc.created_at, uploaded_by: doc.uploader || doc.uploaded_by, file_name: m.file_name || doc.document_id, format: m.format || 'FILE', content_type: doc.content_type, size_bytes: doc.size_bytes, file_size: doc.size_bytes >= 1048576 ? `${(doc.size_bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.ceil(doc.size_bytes / 1024))} KB`, file_url: `/documents/${encodeURIComponent(doc.document_id)}/download` };
}
async function employeeTarget(db, actor, values) {
  const employeeId = clean(values.employee_id), userId = clean(values.userid);
  if (!employeeId && !userId) return null;
  const employee = await stmt(db, `SELECT employee_id FROM employees WHERE company_id=? AND ${employeeId ? 'employee_id' : 'user_id'}=?`, [actor.company_id, employeeId || userId]).first();
  if (!employee || (actor.role !== 'company_admin' && actor.employee_id !== employee.employee_id)) fail('Employee not found.', 404);
  return employee.employee_id;
}
export async function documentHandle({ request, env, db, actor, url, path, method }) {
  if (path === '/api/v1/documents' && method === 'GET') {
    const values = Object.fromEntries(url.searchParams);
    const employee = await employeeTarget(db, actor, values);
    const params = [actor.company_id];
    let where = "d.company_id=? AND json_extract(d.metadata,'$.deleted_at') IS NULL";
    if (employee) { where += ' AND d.employee_id=?'; params.push(employee); }
    else if (values.scope === 'policies') where += ' AND d.employee_id IS NULL';
    else if (values.scope === 'personnel') {
      if (actor.role === 'company_admin') where += ' AND d.employee_id IS NOT NULL';
      else { where += ' AND d.employee_id=?'; params.push(actor.employee_id || ''); }
    }
    else if (actor.role !== 'company_admin') { where += ' AND (d.employee_id IS NULL OR d.employee_id=?)'; params.push(actor.employee_id || ''); }
    const offset = Math.max(0, Math.floor(Number(values.offset) || 0));
    const result = await stmt(db, `${select} WHERE ${where} ORDER BY d.created_at DESC,d.document_id LIMIT 100 OFFSET ?`, [...params, offset]).all();
    return result.results.map(serialize);
  }
  if (path === '/api/v1/documents' && method === 'POST') {
    if (!env.HRMS_DOCUMENTS) fail('Document storage is not configured.', 503);
    if (Number(request.headers.get('Content-Length')) > MAX_FILE_SIZE + 65536) fail('Files must be 10 MB or smaller.', 413);
    let values, bytes, name, type;
    if (request.headers.get('Content-Type')?.startsWith('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') fail('Choose a file to upload.');
      if (!file.size || file.size > MAX_FILE_SIZE) fail('Files must be between 1 byte and 10 MB.', 413);
      values = Object.fromEntries(form);
      name = clean(file.name, 180).replace(/[\r\n"\\/]/g, '_');
      const extension = name.split('.').pop().toLowerCase();
      type = TYPES[extension];
      if (!type) fail('Supported files: PDF, PNG, JPG, WEBP, DOCX, XLSX, CSV and TXT.');
      bytes = await file.arrayBuffer();
      values.format = extension.toUpperCase();
    } else {
      // Compatibility for existing authenticated binary-upload clients.
      values = Object.fromEntries(url.searchParams);
      bytes = await request.arrayBuffer();
      name = clean(values.file_name) || 'document.bin'; type = 'application/octet-stream';
    }
    if (!bytes.byteLength || bytes.byteLength > MAX_FILE_SIZE) fail('Files must be between 1 byte and 10 MB.', 413);
    const employee = await employeeTarget(db, actor, values);
    if (!employee) admin(actor);
    const title = clean(values.title);
    if (!title) fail('Document title is required.');
    const effectiveDate = clean(values.effective_date, 10);
    if (effectiveDate && (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || !Number.isFinite(Date.parse(effectiveDate)) || new Date(effectiveDate).toISOString().slice(0, 10) !== effectiveDate)) fail('Invalid effective date.');
    const m = { file_name: name, format: values.format || 'FILE', category: clean(values.category) || 'General', description: clean(values.description, 2000), version: employee ? '' : clean(values.version, 50), effective_date: employee ? '' : effectiveDate, mandatory_acknowledgement: !employee && values.mandatory_acknowledgement === 'true', document_number: employee ? clean(values.document_number) : '', verified: false };
    const id = crypto.randomUUID();
    const key = `companies/${actor.company_id}/${employee ? `employees/${employee}/` : ''}documents/${id}`;
    const result = await env.HRMS_DOCUMENTS.put(key, bytes, { httpMetadata: { contentType: type } });
    if (result === false || result === null) fail('File storage failed. No document was saved.', 503);
    try {
      await stmt(db, 'INSERT INTO documents(document_id,company_id,employee_id,title,object_key,content_type,size_bytes,uploaded_by,metadata) VALUES(?,?,?,?,?,?,?,?,?)', [id, actor.company_id, employee, title, key, type, bytes.byteLength, actor.user_id, JSON.stringify(m)]).run();
    } catch (error) { await env.HRMS_DOCUMENTS.delete(key); throw error; }
    return serialize(await stmt(db, `${select} WHERE d.company_id=? AND d.document_id=?`, [actor.company_id, id]).first());
  }
  const match = path.match(/^\/api\/v1\/documents\/([^/]+)(?:\/(download|verify))?$/);
  if (!match) fail('Document route not found.', 404);
  const doc = await stmt(db, `${select} WHERE d.company_id=? AND d.document_id=?`, [actor.company_id, match[1]]).first();
  if (!doc || metadata(doc).deleted_at || (actor.role !== 'company_admin' && doc.employee_id && doc.employee_id !== actor.employee_id)) fail('Document not found.', 404);
  if (match[2] === 'download' && method === 'GET') {
    const stored = await env.HRMS_DOCUMENTS?.get(doc.object_key);
    if (!stored) fail('The original file is not available in storage.', 404);
    const filename = metadata(doc).file_name || doc.document_id;
    return new Response(stored.body, { headers: { 'Content-Type': doc.content_type, 'Content-Disposition': `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(filename)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
  }
  if (match[2] === 'verify' && method === 'POST') {
    admin(actor);
    if (!doc.employee_id) fail('Only employee documents have a verification status.');
    const body = await request.json().catch(() => fail('Invalid JSON.'));
    if (typeof body.verified !== 'boolean') fail('Verification status must be true or false.');
    await stmt(db, "UPDATE documents SET metadata=json_set(metadata,'$.verified',json(?),'$.verified_by',?,'$.verified_at',?) WHERE company_id=? AND document_id=?", [JSON.stringify(body.verified), body.verified ? actor.username : null, body.verified ? new Date().toISOString() : null, actor.company_id, doc.document_id]).run();
    return serialize(await stmt(db, `${select} WHERE d.company_id=? AND d.document_id=?`, [actor.company_id, doc.document_id]).first());
  }
  if (!match[2] && method === 'DELETE') {
    admin(actor);
    // Archive the record without permanently erasing the original file.
    await stmt(db, "UPDATE documents SET metadata=json_set(metadata,'$.deleted_at',?,'$.deleted_by',?) WHERE company_id=? AND document_id=?", [new Date().toISOString(), actor.user_id, actor.company_id, doc.document_id]).run();
    return { archived: true };
  }
  fail('Document route not found.', 404);
}
