import { TALENT_COLLECTIONS, fieldIsVisible } from '../shared/talentModel.mjs';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const statement = (db, sql, params = []) => db.prepare(sql).bind(...params);
const unpack = row => ({ ...JSON.parse(row.payload), id: row.id, revision: row.revision, created_at: row.created_at, updated_at: row.updated_at });
const cleanText = (value, label, max = 200) => {
  if (typeof value !== 'string' || value.length > max) fail(`${label} must be text with at most ${max} characters.`);
  return value.trim();
};
async function validate(db, company, collection, body, previous) {
  const config = TALENT_COLLECTIONS[collection], value = {};
  if (config.assetTypes) {
    if (!Array.isArray(body.types) || body.types.length < 1 || body.types.length > 5) fail('Provide between 1 and 5 asset types.');
    value.types = body.types.map(type => cleanText(type, 'Asset type', 300) || fail('Asset type is required.'));
    if (new Set(value.types.map(type => type.toLowerCase())).size !== value.types.length) fail('Asset types must be unique.');
  }
  for (const field of config.fields) {
    if (!fieldIsVisible(field, body)) { value[field.key] = ''; continue; }
    const raw = body[field.key] ?? '';
    if (raw === '' && field.required) fail(`${field.label} is required.`);
    if (raw === '') { value[field.key] = ''; continue; }
    if (field.type === 'number') {
      if (!['string', 'number'].includes(typeof raw) || !Number.isFinite(Number(raw)) || Number(raw) < (field.min ?? 0) || Number(raw) > (field.max ?? 1000000)) fail(`${field.label} is out of range.`);
      value[field.key] = Number(raw);
      if (field.key === 'positions' && !Number.isInteger(value[field.key])) fail('Open positions must be a whole number.');
    } else {
      value[field.key] = cleanText(raw, field.label, field.type === 'textarea' ? 5000 : 300);
      if (field.required && !value[field.key]) fail(`${field.label} is required.`);
      if (field.type === 'select' && !field.options.includes(value[field.key])) fail(`Invalid ${field.label.toLowerCase()}.`);
      if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(Date.parse(raw)) || new Date(raw).toISOString().slice(0, 10) !== raw)) fail(`Invalid ${field.label.toLowerCase()}.`);
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) fail('Enter a valid email address.');
      if (field.type === 'url') { try { if (!['https:', 'http:'].includes(new URL(raw).protocol)) fail('Use an HTTP or HTTPS course link.'); } catch { fail('Use a valid HTTP or HTTPS course link.'); } }
      if (field.type === 'employee' && !await statement(db, 'SELECT user_id FROM employees WHERE company_id=? AND user_id=?', [company, raw]).first()) fail('Employee does not belong to this company.');
      if (field.type === 'reference' && !await statement(db, 'SELECT id FROM talent_records WHERE company_id=? AND collection=? AND id=?', [company, field.collection, raw]).first()) fail(`${field.label} does not belong to this company.`);
    }
  }
  if (value.start_date && value.due_date < value.start_date) fail('Due date must be on or after the start date.');
  if (config.checklist) {
    if (!Array.isArray(body.checklist) || !body.checklist.length || body.checklist.length > 50) fail('Provide between 1 and 50 checklist tasks.');
    value.checklist = body.checklist.map(item => ({ title: cleanText(item.title, 'Task', 300) || fail('Task title is required.'), done: item.done === true }));
    if (value.status === 'Completed' && value.checklist.some(item => !item.done)) fail('Finish every checklist task before completing this plan.');
  }
  if (config.keyResults) {
    if (!Array.isArray(body.key_results) || !body.key_results.length || body.key_results.length > 20) fail('Provide between 1 and 20 key results.');
    value.key_results = body.key_results.map(item => {
      const current = Number(item.current), target = Number(item.target);
      if (!Number.isFinite(current) || !Number.isFinite(target) || current < 0 || target <= 0 || target > 1000000000 || current > 1000000000) fail('Key results require a positive target and non-negative current value.');
      return { title: cleanText(item.title, 'Key result', 300) || fail('Key result title is required.'), current, target };
    });
    if (value.status === 'Completed' && value.key_results.some(item => item.current < item.target)) fail('Reach every key result target before completing the objective.');
  }
  if (collection === 'assets') {
    if (value.list_id) {
      const list = await statement(db, "SELECT payload FROM talent_records WHERE company_id=? AND collection='asset_lists' AND id=?", [company, value.list_id]).first();
      const types = JSON.parse(list.payload).types || [];
      if (value.category !== 'Other' || (types.length && !types.includes(value.custom_type))) fail('Choose an asset type from this list.');
    }
    if (value.purchase_date && value.warranty_until && value.warranty_until < value.purchase_date) fail('Warranty expiry must be on or after the purchase date.');
    if (value.purchase_price !== '' && !value.currency) fail('Currency is required when a purchase price is provided.');
    if (previous && value.status !== 'Available' && await statement(db, "SELECT id FROM talent_records WHERE company_id=? AND collection='asset_issues' AND json_extract(payload,'$.asset_id')=? AND json_extract(payload,'$.status') IN ('Issued','Received')", [company, previous.id]).first()) fail('Return the issued asset before changing its inventory status.');
  }
  if (collection === 'asset_issues') {
    const asset = await statement(db, "SELECT payload FROM talent_records WHERE company_id=? AND collection='assets' AND id=?", [company, value.asset_id]).first();
    const details = JSON.parse(asset.payload);
    value.title = details.title;
    if (value.status !== 'Returned' && details.status !== 'Available') fail('Only available inventory can be issued.');
    if (previous) {
      const old = JSON.parse(previous.payload);
      if (old.asset_id !== value.asset_id || old.employee_id !== value.employee_id) fail('Asset and employee cannot be changed on an existing issue. Return it and create a new issue.');
      if (old.status === 'Returned' && value.status !== 'Returned') fail('Create a new issue to reissue a returned asset.');
    }
    if (value.received_date && value.received_date < value.issue_date) fail('Received date cannot precede the issued date.');
    if (value.return_date && value.return_date < (value.received_date || value.issue_date)) fail('Return date cannot precede receipt or issue.');
    if (value.status === 'Received' && (!value.received_date || !value.acknowledgement_note)) fail('Received date and acknowledgement note are required.');
    if (value.status === 'Returned' && !value.return_date) fail('Return date is required.');
    if (value.status !== 'Returned' && value.return_date) fail('Choose Returned when recording a return date.');
    if (value.status === 'Issued' && value.received_date) fail('Choose Received when recording an employee receipt.');
  }
  if (collection === 'enrollments' && value.status === 'Completed' && value.progress !== 100) fail('Set progress to 100% before completing the assignment.');
  return value;
}
export async function talentHandle({ db, actor, path, method, body, url }) {
  if (actor.role !== 'company_admin') fail('Dashboard administrator access required.', 403);
  const [collection, id, extra] = path.slice('/api/v1/talent/'.length).split('/');
  if (!Object.hasOwn(TALENT_COLLECTIONS, collection) || extra) fail('Module not found.', 404);
  const financialAdmin = (actor.original_role || actor.role) === 'company_admin';
  const publicRecord = row => {
    const record = unpack(row);
    if (collection === 'assets' && !financialAdmin) for (const field of TALENT_COLLECTIONS.assets.fields) if (field.adminOnly) delete record[field.key];
    return record;
  };
  if (method === 'GET' && !id) {
    const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0));
    const result = await statement(db, 'SELECT * FROM talent_records WHERE company_id=? AND collection=? ORDER BY created_at DESC,id LIMIT 100 OFFSET ?', [actor.company_id, collection, offset]).all();
    return result.results.map(publicRecord);
  }
  if (method !== 'POST') fail('Route not found.', 404);
  const previous = id ? await statement(db, 'SELECT * FROM talent_records WHERE company_id=? AND collection=? AND id=?', [actor.company_id, collection, id]).first() : null;
  if (id && !previous) fail('Record not found.', 404);
  if (previous && (!Number.isInteger(body.revision) || body.revision !== previous.revision)) fail('This record changed. Refresh and open it again before saving.', 409);
  if (collection === 'assets' && !financialAdmin) {
    const old = previous ? JSON.parse(previous.payload) : {};
    body = { ...body };
    for (const field of TALENT_COLLECTIONS.assets.fields) if (field.adminOnly) {
      if (Object.hasOwn(body, field.key) && body[field.key] !== old[field.key] && body[field.key] !== '') fail('Purchase details are restricted to company administrators.', 403);
      body[field.key] = old[field.key] ?? '';
    }
  }
  const value = await validate(db, actor.company_id, collection, body, previous);
  if (['assets', 'asset_issues'].includes(collection)) value.photos = previous ? JSON.parse(previous.payload).photos || {} : {};
  const now = new Date().toISOString(), recordId = id || crypto.randomUUID();
  value.history = [...(previous ? JSON.parse(previous.payload).history || [] : []), { at: now, actor: actor.user_id, status: value.status }].slice(-100);
  let guard = '', guardParams = [];
  if (collection === 'asset_issues' && value.status !== 'Returned') {
    guard = " AND EXISTS (SELECT 1 FROM talent_records inventory WHERE inventory.company_id=? AND inventory.collection='assets' AND inventory.id=? AND json_extract(inventory.payload,'$.status')='Available')";
    guardParams = [actor.company_id, value.asset_id];
  } else if (collection === 'assets' && value.status !== 'Available') {
    guard = " AND NOT EXISTS (SELECT 1 FROM talent_records issued WHERE issued.company_id=? AND issued.collection='asset_issues' AND json_extract(issued.payload,'$.asset_id')=? AND json_extract(issued.payload,'$.status') IN ('Issued','Received'))";
    guardParams = [actor.company_id, recordId];
  }
  if (['assets', 'asset_lists'].includes(collection)) {
    if (collection === 'asset_lists' && value.title.toLowerCase() === 'it assets list') fail('IT assets list already exists.', 409);
    guard += " AND NOT EXISTS (SELECT 1 FROM talent_records duplicate WHERE duplicate.company_id=? AND duplicate.collection=? AND duplicate.id<>? AND lower(trim(json_extract(duplicate.payload,'$.title')))=lower(?)" + (collection === 'assets' ? " AND coalesce(json_extract(duplicate.payload,'$.list_id'),'')=?" : "") + ")";
    guardParams.push(actor.company_id, collection, recordId, value.title);
    if (collection === 'assets') guardParams.push(value.list_id || '');
  }
  if (collection === 'assets' && value.list_id) {
    guard += " AND EXISTS (SELECT 1 FROM talent_records list WHERE list.company_id=? AND list.collection='asset_lists' AND list.id=?)";
    guardParams.push(actor.company_id, value.list_id);
  }
  try {
    if (previous) {
      const changed = await statement(db, `UPDATE talent_records SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND collection=? AND id=? AND revision=?${guard} RETURNING id`, [JSON.stringify(value), now, actor.company_id, collection, recordId, body.revision, ...guardParams]).first();
      if (!changed) fail(['assets', 'asset_lists'].includes(collection) ? 'This name already exists in the list, or the record changed. Use a unique name and refresh.' : 'This record changed. Refresh and try again.', 409);
    } else {
      const inserted = await statement(db, `INSERT INTO talent_records(company_id,collection,id,payload,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE 1=1${guard} RETURNING id`, [actor.company_id, collection, recordId, JSON.stringify(value), now, now, ...guardParams]).first();
      if (!inserted) fail(['assets', 'asset_lists'].includes(collection) ? 'This name already exists. Choose a different name.' : 'Asset availability changed. Refresh before issuing.', 409);
    }
  } catch (error) {
    if (/UNIQUE constraint/i.test(error.message)) fail('A record with this asset tag, candidate email and job, employee and course, or active asset issue already exists.', 409);
    throw error;
  }
  return publicRecord(await statement(db, 'SELECT * FROM talent_records WHERE company_id=? AND collection=? AND id=?', [actor.company_id, collection, recordId]).first());
}
