const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const q = (db, sql, args = []) => db.prepare(sql).bind(...args);
function details(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const amount = Number(input?.amount);
  if (!name || name.length > 150 || !Number.isFinite(amount) || amount <= 0 || amount > 1e9) fail('Enter a component name and valid amount.');
  return { name, amount };
}
export async function payrollComponents({ db, actor, method, body = {} }) {
  if (actor.role !== 'company_admin') fail('Payroll management access required.', 403);
  const company = actor.company_id;
  if (method === 'GET') {
    const result = await q(db, 'SELECT user_id,payload FROM payroll_components WHERE company_id=?', [company]).all();
    return result.results.map(row => ({ ...JSON.parse(row.payload), userid: row.user_id }));
  }
  if (method !== 'POST') fail('Method not allowed.', 405);
  if (body.action === 'add' && !Array.isArray(body.employee_ids)) fail('Choose employees.');
  const ids = body.action === 'add' ? [...new Set(body.employee_ids)] : [body.userid];
  if (!ids.length || ids.length > 99 || ids.some(id => typeof id !== 'string' || !id || id.length > 150)) fail('Choose up to 99 employees.');
  const people = await q(db, `SELECT user_id FROM employees WHERE company_id=? AND user_id IN (${ids.map(() => '?').join(',')})`, [company, ...ids]).all();
  if (people.results.length !== ids.length) fail('Employee not found in this company.', 404);
  if (body.action === 'add') {
    const row = body.row;
    const value = details(row);
    const scope = row?.scope;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (!['earning','deduction'].includes(row?.type) || !['once','ongoing','selected'].includes(scope?.mode) || !/^\d{4}$/.test(String(scope?.year)) || (scope.mode === 'selected' ? !Array.isArray(scope.months) || !scope.months.length || scope.months.some(month => !months.includes(month)) : !months.includes(scope.month))) fail('Choose a valid component type and month scope.');
    const saved = ids.map(userid => ({ ...value, type: row.type, scope: { mode: scope.mode, year: String(scope.year), ...(scope.mode === 'selected' ? { months: [...new Set(scope.months)] } : { month: scope.month }) }, userid, id: crypto.randomUUID(), created_at: new Date().toISOString() }));
    await db.batch(saved.map(({ userid, ...item }) => q(db, 'INSERT INTO payroll_components(company_id,user_id,id,payload) VALUES(?,?,?,?)', [company, userid, item.id, JSON.stringify(item)])));
    return saved;
  }
  if (typeof body.id !== 'string' || body.id.length > 150) fail('Choose a component.');
  if (body.action === 'delete') {
    await q(db, 'DELETE FROM payroll_components WHERE company_id=? AND user_id=? AND id=?', [company, body.userid, body.id]).run();
    return { deleted: true };
  }
  if (body.action === 'update') {
    const value = details(body.patch);
    const saved = await q(db, "UPDATE payroll_components SET payload=json_set(payload,'$.name',?,'$.amount',?) WHERE company_id=? AND user_id=? AND id=? RETURNING payload", [value.name, value.amount, company, body.userid, body.id]).first();
    if (!saved) fail('Component not found.', 404);
    return { ...JSON.parse(saved.payload), userid: body.userid };
  }
  fail('Unknown component action.');
}
