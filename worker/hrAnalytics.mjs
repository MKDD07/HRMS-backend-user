const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const stmt = (db, sql, values = []) => db.prepare(sql).bind(...values);
const rows = async (db, sql, values = []) => (await stmt(db, sql, values).all()).results;
const monthOK = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const monthsBetween = (from, to) => (Number(to.slice(0,4)) - Number(from.slice(0,4))) * 12 + Number(to.slice(5)) - Number(from.slice(5));
function range(from, to) { if (!monthOK(from) || !monthOK(to) || from > to || monthsBetween(from, to) > 23) fail('Choose a valid range of up to 24 months.'); }
export async function analyticsHandle({ db, actor, path, method, body = {}, url }) {
  if (actor.role !== 'company_admin') fail('Dashboard access required.', 403);
  const company = actor.company_id;
  if (path === '/api/v1/hr-analytics/views') {
    if (method === 'GET') return rows(db, 'SELECT id,title,from_month,to_month FROM hr_analytics_views WHERE company_id=? ORDER BY created_at DESC', [company]);
    if (method !== 'POST') fail('Route not found.', 404);
    range(body.from, body.to);
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 100) fail('Provide a view name of up to 100 characters.');
    const id = crypto.randomUUID();
    await stmt(db, 'INSERT INTO hr_analytics_views(company_id,id,title,from_month,to_month,created_at) VALUES(?,?,?,?,?,?)', [company,id,body.title.trim(),body.from,body.to,new Date().toISOString()]).run();
    return { id, title: body.title.trim(), from_month: body.from, to_month: body.to };
  }
  if (path !== '/api/v1/hr-analytics' || method !== 'GET') fail('Route not found.', 404);
  const from = url.searchParams.get('from'), to = url.searchParams.get('to'); range(from, to);
  const through = new Date(Date.UTC(Number(to.slice(0,4)), Number(to.slice(5)), 0)).toISOString().slice(0,10);
  const warnings = [];
  const people = await rows(db, 'SELECT user_id,department,status,profile,created_at FROM employees WHERE company_id=?', [company]);
  const exits = await rows(db, "SELECT json_extract(payload,'$.employee_id') AS employee_id,MAX(json_extract(payload,'$.due_date')) AS exit_date FROM talent_records WHERE company_id=? AND collection='offboarding' AND json_extract(payload,'$.status')='Completed' GROUP BY json_extract(payload,'$.employee_id')", [company]);
  const exitMap = new Map(exits.map(row => [row.employee_id, row.exit_date]));
  let fallback = 0, unknownExits = 0;
  const employees = people.map(person => {
    const profile = JSON.parse(person.profile), recorded = profile.joining_date || profile.date_of_joining;
    if (!recorded) fallback++;
    const exit = profile.last_working_date || exitMap.get(person.user_id) || '';
    if (person.status === 'Inactive' && !exit) unknownExits++;
    return { ...person, joined: (recorded || person.created_at).slice(0,10), exited: exit.slice(0,10) };
  });
  if (fallback) warnings.push(`${fallback} employee(s) have no joining date; account creation dates are used for their headcount history.`);
  if (unknownExits) warnings.push(`${unknownExits} inactive employee(s) have no recorded exit date. Historical headcount and attrition may be overstated or incomplete.`);
  const attendance = await rows(db, `SELECT substr(date,1,7) AS month,COUNT(*) AS punch_days,
    SUM(CASE WHEN check_out_time IS NULL OR check_out_time='' THEN 1 ELSE 0 END) AS open_punches,
    ROUND(SUM(CASE WHEN julianday(check_out_time)>=julianday(check_in_time) THEN (julianday(check_out_time)-julianday(check_in_time))*24 ELSE 0 END),2) AS hours
    FROM attendance WHERE company_id=? AND date>=? AND date<=? GROUP BY substr(date,1,7)`, [company,from+'-01',through]);
  const payroll = await rows(db, `SELECT period AS month,currency,status,COUNT(*) AS records,SUM(gross_minor)/100.0 AS gross,SUM(deductions_minor)/100.0 AS deductions,SUM(gross_minor-deductions_minor)/100.0 AS net FROM payroll WHERE company_id=? AND period>=? AND period<=? GROUP BY period,currency,status ORDER BY period`, [company,from,to]);
  const hasPayslips = await stmt(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='payslip_records'").first();
  const salaryLedger = [];
  if (hasPayslips) {
    const saved = await rows(db, "SELECT userid,year,month,payload,created_at,id FROM payslip_records WHERE json_extract(payload,'$.company_id')=? ORDER BY created_at DESC,id DESC", [company]);
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const seen = new Set(), totals = new Map();
    for (const row of saved) {
      const payload = JSON.parse(row.payload), index = monthNames.indexOf(row.month), month = `${row.year}-${String(index+1).padStart(2,'0')}`;
      if (index < 0 || month < from || month > to || payload.salary_status !== 'Finalized') continue;
      const key = row.userid + '/' + month; if (seen.has(key)) continue; seen.add(key);
      const salary = payload.salary || {}, total = totals.get(month) || { month, currency: 'INR', status: 'Finalized', records: 0, gross: 0, deductions: 0, net: 0 };
      const values = [salary.monthly_gross, salary.total_deductions, salary.monthly_net].map(Number);
      if (!values.every(Number.isFinite)) { warnings.push('A finalized salary with invalid totals was excluded.'); continue; }
      total.records++; total.gross += values[0]; total.deductions += values[1]; total.net += values[2]; totals.set(month,total);
    }
    salaryLedger.push(...[...totals.values()].sort((a,b) => a.month.localeCompare(b.month)));
  } else warnings.push('Payroll Studio records are not available in this database. Core payroll totals are shown separately.');
  const monthly = [];
  for (let offset = 0; offset <= monthsBetween(from,to); offset++) {
    const start = new Date(Date.UTC(Number(from.slice(0,4)), Number(from.slice(5))-1+offset,1));
    const month = start.toISOString().slice(0,7), first = month+'-01', last = new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).toISOString().slice(0,10);
    const opening = employees.filter(p => p.joined < first && (!p.exited || p.exited >= first)).length;
    const closing = employees.filter(p => p.joined <= last && (!p.exited || p.exited > last)).length;
    const joined = employees.filter(p => p.joined >= first && p.joined <= last).length;
    const left = employees.filter(p => p.exited >= first && p.exited <= last).length;
    const average = (opening+closing)/2;
    monthly.push({ month, opening, closing, joined, left, attrition: average ? Math.round(left/average*10000)/100 : null, ...(attendance.find(row => row.month === month) || { punch_days: 0, hours: 0, open_punches: 0 }) });
  }
  const departments = [...new Set(people.map(p => p.department || 'Unassigned'))].map(department => ({ department, employees: people.filter(p => (p.department || 'Unassigned') === department && p.status !== 'Inactive').length }));
  return { monthly, departments, payroll, salaryLedger, warnings: [...new Set(warnings)], currentHeadcount: people.filter(p => p.status !== 'Inactive').length, sources: { payroll: 'Core payroll table; amounts grouped by currency and status.', salaryLedger: 'Latest finalized Payroll Studio salary per employee and month. Finalization does not confirm payment.' } };
}
