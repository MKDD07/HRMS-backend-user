import { OPERATIONS } from '../shared/operationsModel.mjs';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const stmt = (db, sql, values = []) => db.prepare(sql).bind(...values);
const rows = async (db, sql, values = []) => (await stmt(db, sql, values).all()).results;
const unpack = row => row && ({ ...JSON.parse(row.payload), id: row.id, revision: row.revision, created_at: row.created_at, updated_at: row.updated_at });
const text = (value, label, max = 5000) => {
  if (typeof value !== 'string' || value.length > max) fail(`${label} must be text of at most ${max} characters.`);
  return value.trim();
};
const realDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const superAdmin = actor => (actor.original_role || actor.role) === 'company_admin';
const get = async (db, company, collection, id) => unpack(await stmt(db, `SELECT * FROM ${OPERATIONS[collection].table} WHERE company_id=? AND id=?`, [company, id]).first());
function revision(previous, body) { if (!Number.isInteger(body.revision) || previous.revision !== body.revision) fail('This record changed. Refresh before saving.', 409); }
async function persist(db, actor, collection, value, previous) {
  const table = OPERATIONS[collection].table, now = new Date().toISOString(), id = previous?.id || crypto.randomUUID();
  value.history = [...(previous?.history || []), { at: now, actor: actor.user_id, status: value.status }].slice(-100);
  // The total check is part of the write, so concurrent requests cannot both pass it.
  const timeGuard = collection === 'timesheets' && value.status !== 'Rejected';
  let guard = timeGuard ? " AND (SELECT COALESCE(SUM(json_extract(payload,'$.hours')),0) FROM hr_timesheets WHERE company_id=? AND id<>? AND json_extract(payload,'$.employee_id')=? AND json_extract(payload,'$.work_date')=? AND json_extract(payload,'$.status')<>'Rejected') + ? <= 24" : '';
  const guardValues = timeGuard ? [actor.company_id,id,value.employee_id,value.work_date,value.hours] : [];
  if (collection === 'survey_responses') {
    guard += " AND EXISTS(SELECT 1 FROM hr_surveys WHERE company_id=? AND id=? AND revision=? AND json_extract(payload,'$.status')='Open')";
    guardValues.push(actor.company_id,value.survey_id,value.survey_revision);
  }
  if (collection === 'surveys' && previous && JSON.stringify(value.questions) !== JSON.stringify(previous.questions)) {
    guard += " AND NOT EXISTS(SELECT 1 FROM hr_survey_responses WHERE company_id=? AND json_extract(payload,'$.survey_id')=?)";
    guardValues.push(actor.company_id,id);
  }
  try {
    const result = previous
      ? await stmt(db, `UPDATE ${table} SET payload=?,revision=revision+1,updated_at=? WHERE company_id=? AND id=? AND revision=?${guard} RETURNING id`, [JSON.stringify(value), now, actor.company_id, id, previous.revision,...guardValues]).first()
      : await stmt(db, `INSERT INTO ${table}(company_id,id,payload,created_at,updated_at) SELECT ?,?,?,?,? WHERE 1=1${guard} RETURNING id`, [actor.company_id, id, JSON.stringify(value), now, now,...guardValues]).first();
    if (!result) fail(timeGuard ? 'Record changed or daily total would exceed 24 hours. Refresh and check hours across projects.' : 'This record changed. Refresh before saving.', 409);
  } catch (error) { if (/Daily timesheet hours exceed 24/.test(error.message)) fail('Total time across projects cannot exceed 24 hours per employee per day.'); if (/UNIQUE constraint/i.test(error.message)) fail('A record already exists for this employee and review cycle or survey.', 409); throw error; }
  return get(db, actor.company_id, collection, id);
}
async function validate(db, actor, collection, body, previous) {
  const config = OPERATIONS[collection], value = {}, references = {};
  for (const field of config.fields) {
    const raw = body[field.key] ?? '';
    if (raw === '') { if (field.required) fail(`${field.label} is required.`); value[field.key] = ''; continue; }
    if (field.type === 'number') {
      if (!['string', 'number'].includes(typeof raw) || !String(raw).trim() || !Number.isFinite(Number(raw)) || Number(raw) < field.min || Number(raw) > field.max) fail(`${field.label} must be between ${field.min} and ${field.max}.`);
      value[field.key] = Number(raw);
    } else {
      value[field.key] = text(raw, field.label, field.type === 'textarea' ? 5000 : 300);
      if (field.required && !value[field.key]) fail(`${field.label} is required.`);
      if (field.type === 'select' && !field.options.includes(value[field.key])) fail(`Invalid ${field.label.toLowerCase()}.`);
      if (field.type === 'date' && !realDate(raw)) fail(`Invalid ${field.label.toLowerCase()}.`);
      if (field.type === 'employee' && !await stmt(db, 'SELECT user_id FROM employees WHERE company_id=? AND user_id=?', [actor.company_id, raw]).first()) fail(`${field.label} does not belong to this company.`);
      if (field.type === 'reference') {
        references[field.key] = await get(db, actor.company_id, field.collection, raw);
        if (!references[field.key]) fail(`${field.label} does not belong to this company.`);
      }
    }
  }
  if (value.start_date && value.end_date < value.start_date) fail('End date cannot precede the start date.');
  if (config.approval) {
    if (previous && !['Draft', 'Rejected'].includes(previous.status)) fail('Submitted or approved records cannot be edited. Use the review or payment actions.', 409);
    if (!['Draft', 'Submitted'].includes(value.status)) fail('Save a draft or submit for approval. Use the review actions to approve or reject.');
    if (value.employee_id === value.reviewer_id) fail('Choose an approver other than the employee.');
  }
  if (collection === 'expenses') {
    if (Math.abs(value.amount * 100 - Math.round(value.amount * 100)) > 0.00001) fail('Claim amounts support at most two decimal places.');
    if (value.paid_date || value.payment_reference) fail('Record payment after the claim is approved.');
    if (value.status === 'Submitted' && (!previous || !await stmt(db, 'SELECT id FROM hr_expense_receipts WHERE company_id=? AND expense_id=?', [actor.company_id, previous.id]).first())) fail('Save a draft and upload at least one receipt before submitting.');
  }
  if (collection === 'appraisals') {
    if (previous?.status === 'Finalized') fail('Finalized reviews cannot be changed.', 409);
    if (references.cycle_id.status !== 'Open') fail('Employee reviews require an open review cycle.');
    if (value.employee_id === value.reviewer_id) fail('Choose a manager other than the employee.');
    const managerChanged = ['manager_review', 'manager_rating', 'outcome'].some(key => value[key] !== (previous?.[key] ?? '')) || value.status === 'Finalized';
    if (managerChanged && !superAdmin(actor) && actor.user_id !== (previous?.reviewer_id || value.reviewer_id)) fail('Only the assigned manager or company administrator may record manager feedback.', 403);
    if (['Manager review', 'Finalized'].includes(value.status) && (!value.self_review || !value.self_rating)) fail('Record the employee self-review and rating first.');
    if (value.status === 'Finalized' && (!value.manager_review || !value.manager_rating || !value.outcome)) fail('Manager feedback, rating, and final outcome are required.');
    if (previous && !superAdmin(actor) && value.reviewer_id !== previous.reviewer_id) fail('Only a company administrator may reassign the manager.', 403);
  }
  if (collection === 'benefit_enrollments') {
    const plan = references.plan_id;
    if (value.status === 'Active' && plan.status !== 'Active') fail('Choose an active benefit plan.');
    if (value.start_date < plan.start_date || value.end_date > plan.end_date) fail('Coverage dates must be inside the plan period.');
  }
  if (collection === 'dependants' && value.birth_date > new Date().toISOString().slice(0, 10)) fail('Date of birth cannot be in the future.');
  if (collection === 'surveys') {
    if (!Array.isArray(body.questions) || !body.questions.length || body.questions.length > 20) fail('Provide 1–20 survey questions.');
    value.questions = body.questions.map(q => ({ id: text(q.id, 'Question ID', 80), label: text(q.label, 'Question', 500), type: q.type }));
    if (value.questions.some(q => !/^[a-zA-Z0-9_-]+$/.test(q.id) || !q.label || !['rating', 'text'].includes(q.type)) || new Set(value.questions.map(q => q.id)).size !== value.questions.length) fail('Questions need unique IDs, text, and a valid answer type.');
    if (previous && await stmt(db, "SELECT id FROM hr_survey_responses WHERE company_id=? AND json_extract(payload,'$.survey_id')=?", [actor.company_id, previous.id]).first() && JSON.stringify(previous.questions) !== JSON.stringify(value.questions)) fail('Questions cannot change after responses have been recorded.', 409);
  }
  if (collection === 'survey_responses') {
    if (previous) fail('Submitted survey responses cannot be edited.', 409);
    const survey = references.survey_id, today = new Date().toISOString().slice(0, 10);
    if (survey.status !== 'Open' || today < survey.start_date || today > survey.end_date) fail('This survey is not open for responses.');
    if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) fail('Provide survey answers.');
    value.answers = {};
    value.survey_revision = survey.revision;
    for (const question of survey.questions) {
      const answer = body.answers[question.id];
      if (question.type === 'rating') {
        if (!['string', 'number'].includes(typeof answer) || !Number.isInteger(Number(answer)) || Number(answer) < 1 || Number(answer) > 5) fail(`Answer “${question.label}” with a rating from 1 to 5.`);
        value.answers[question.id] = Number(answer);
      } else { value.answers[question.id] = text(answer, question.label); if (!value.answers[question.id]) fail('Answer every survey question.'); }
    }
    value.title = survey.title;
  }
  if (collection === 'timesheets') {
    if (references.project_id.status !== 'Active') fail('Time entries require an active project.');
    if (value.work_date < references.project_id.start_date || value.work_date > references.project_id.end_date) fail('Work date must be within the project period.');
    if (value.work_date > new Date().toISOString().slice(0, 10)) fail('Work date cannot be in the future.');
    if (!Number.isInteger(value.hours * 4)) fail('Enter hours in quarter-hour increments.');
    const total = await stmt(db,"SELECT COALESCE(SUM(json_extract(payload,'$.hours')),0) AS hours FROM hr_timesheets WHERE company_id=? AND id<>? AND json_extract(payload,'$.employee_id')=? AND json_extract(payload,'$.work_date')=? AND json_extract(payload,'$.status')<>'Rejected'",[actor.company_id,previous?.id || '',value.employee_id,value.work_date]).first();
    if (total.hours + value.hours > 24) fail('Total time across projects cannot exceed 24 hours per employee per day.');
  }
  return value;
}
export async function operationsHandle({ db, actor, path, method, body = {}, url }) {
  if (actor.role !== 'company_admin') fail('Dashboard access required.', 403);
  const [collection, rawId, action, extra] = path.slice('/api/v1/operations/'.length).split('/');
  if (!Object.hasOwn(OPERATIONS, collection) || extra) fail('Module not found.', 404);
  const id = rawId ? decodeURIComponent(rawId) : '', config = OPERATIONS[collection];
  if (method === 'GET' && !id) {
    const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0));
    return (await rows(db, `SELECT * FROM ${config.table} WHERE company_id=? ORDER BY created_at DESC,id LIMIT 100 OFFSET ?`, [actor.company_id, offset])).map(unpack);
  }
  if (method !== 'POST') fail('Route not found.', 404);
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Expected a record.');
  const previous = id ? await get(db, actor.company_id, collection, id) : null;
  if (id && !previous) fail('Record not found.', 404);
  if (previous) revision(previous, body);
  if (action) {
    if (!previous || !config.approval || !['review', 'pay'].includes(action)) fail('Action not found.', 404);
    if (action === 'review') {
      if (previous.status !== 'Submitted') fail('Only submitted records can be reviewed.', 409);
      if (!superAdmin(actor) && actor.user_id !== previous.reviewer_id) fail('Only the assigned approver or company administrator can review this record.', 403);
      if (actor.user_id === previous.employee_id) fail('You cannot approve your own claim or time entry.', 403);
      if (!['Approved', 'Rejected'].includes(body.decision)) fail('Choose Approved or Rejected.');
      const review_note = text(body.note || '', 'Review note', 2000);
      if (body.decision === 'Rejected' && !review_note) fail('Explain the rejection.');
      return persist(db, actor, collection, { ...previous, status: body.decision, review_note, reviewed_by: actor.user_id, reviewed_at: new Date().toISOString() }, previous);
    }
    if (collection !== 'expenses' || previous.status !== 'Approved') fail('Only approved expense claims can be marked paid.', 409);
    if (!superAdmin(actor)) fail('Only a company administrator may record payment.', 403);
    if (!realDate(body.paid_date) || body.paid_date < previous.expense_date || body.paid_date > new Date().toISOString().slice(0, 10)) fail('Enter a valid payment date between the expense date and today.');
    const payment_reference = text(body.payment_reference || '', 'Payment reference', 300);
    if (!payment_reference) fail('Payment reference is required.');
    return persist(db, actor, collection, { ...previous, status: 'Paid', paid_date: body.paid_date, payment_reference, paid_by: actor.user_id }, previous);
  }
  const value = await validate(db, actor, collection, body, previous);
  return persist(db, actor, collection, value, previous);
}

// Files are served only through authenticated routes; the R2 object key is never public.
export async function expenseReceipts({ db, env, actor, request, expenseId, receiptId }) {
  if (actor.role !== 'company_admin') fail('Dashboard access required.', 403);
  const expense = await get(db, actor.company_id, 'expenses', expenseId);
  if (!expense) fail('Expense not found.', 404);
  if (request.method === 'GET' && !receiptId) return rows(db, 'SELECT id,filename,size_bytes,created_at FROM hr_expense_receipts WHERE company_id=? AND expense_id=? ORDER BY created_at,id', [actor.company_id, expenseId]);
  if (!env.HRMS_DOCUMENTS) fail('Receipt storage is not configured.', 503);
  if (request.method === 'GET' && receiptId) {
    const receipt = await stmt(db, 'SELECT * FROM hr_expense_receipts WHERE company_id=? AND expense_id=? AND id=?', [actor.company_id, expenseId, receiptId]).first();
    if (!receipt) fail('Receipt not found.', 404);
    const object = await env.HRMS_DOCUMENTS.get(receipt.object_key);
    if (!object) fail('Stored receipt is unavailable.', 404);
    return new Response(object.body, { headers: { 'Content-Type': receipt.content_type, 'Content-Disposition': `attachment; filename="${receipt.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (request.method !== 'POST' || receiptId) fail('Route not found.', 404);
  if (!['Draft', 'Rejected'].includes(expense.status)) fail('Receipts can only be added to drafts or rejected claims.', 409);
  const max = 5 * 1024 * 1024;
  if (Number(request.headers.get('Content-Length')) > max) fail('Receipts must be 5 MB or smaller.', 413);
  const buffer = await request.arrayBuffer(), bytes = new Uint8Array(buffer);
  if (!bytes.length || bytes.length > max) fail('Receipts must contain 1 byte to 5 MB.', 413);
  const type = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d ? 'application/pdf' : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg' : [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b) ? 'image/png' : '';
  if (!type) fail('Upload a PDF, PNG, or JPEG receipt.');
  const filename = text(new URL(request.url).searchParams.get('name') || 'receipt', 'Filename', 180);
  const id = crypto.randomUUID(), key = `${actor.company_id}/expense-receipts/${expenseId}/${id}`;
  await env.HRMS_DOCUMENTS.put(key, buffer, { httpMetadata: { contentType: type } });
  try {
    const saved = await stmt(db, `INSERT INTO hr_expense_receipts(company_id,id,expense_id,object_key,filename,content_type,size_bytes,created_at)
      SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM hr_expenses WHERE company_id=? AND id=? AND revision=? AND json_extract(payload,'$.status') IN ('Draft','Rejected'))
      AND (SELECT count(*) FROM hr_expense_receipts WHERE company_id=? AND expense_id=?)<10 RETURNING id`, [actor.company_id,id,expenseId,key,filename,type,bytes.length,new Date().toISOString(),actor.company_id,expenseId,expense.revision,actor.company_id,expenseId]).first();
    if (!saved) fail('Claim changed or already has 10 receipts. Refresh before uploading.', 409);
  } catch (error) { await env.HRMS_DOCUMENTS.delete(key).catch(() => {}); throw error; }
  return { id, filename, size_bytes: bytes.length };
}
