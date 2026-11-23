import { DOSSIER_FIELDS, normalizeDossier } from '../shared/dossierFields.mjs';
import { PAYMENT_METHODS } from '../shared/paymentDetails.mjs';
import { validDay } from '../shared/overviewModel.mjs';
import { geofenceSites, resolveAttendanceRule, validateAttendanceRule } from './geofence.mjs';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const stmt = (db, sql, values = []) => db.prepare(sql).bind(...values);
const parse = text => { try { return JSON.parse(text || '{}'); } catch { return {}; } };
const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function validateShift(shift) {
  if (!shift || ![shift.startTime,shift.endTime].every(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) || shift.startTime === shift.endTime) fail('Enter different, valid start and end times.');
  if (!Array.isArray(shift.workingDays) || !shift.workingDays.length || shift.workingDays.some(day => !days.includes(day))) fail('Choose working days.');
  for (const key of ['breakDurationMins','gracePeriodMins','earlyExitGraceMins']) if (!Number.isInteger(shift[key]) || shift[key] < 0 || shift[key] > 240) fail('Break and grace must be 0–240 minutes.');
  const minutes = time => Number(time.slice(0,2))*60+Number(time.slice(3));
  if (shift.breakDurationMins >= (minutes(shift.endTime)-minutes(shift.startTime)+1440)%1440) fail('Break must be shorter than the shift.');
  return { startTime: shift.startTime, endTime: shift.endTime, workingDays: [...new Set(shift.workingDays)], breakDurationMins: shift.breakDurationMins, gracePeriodMins: shift.gracePeriodMins, earlyExitGraceMins: shift.earlyExitGraceMins, name: 'Individual schedule', status: 'Active' };
}
export async function employeeDossier({ db, actor, method, userid, body = {} }) {
  if (actor.role !== 'company_admin') fail('Employee management access required.',403);
  const employee = await stmt(db, 'SELECT e.*,u.email,u.username FROM employees e JOIN users u ON u.company_id=e.company_id AND u.user_id=e.user_id WHERE e.company_id=? AND (e.user_id=? OR e.employee_id=? OR e.employee_code=?)', [actor.company_id,userid,userid,userid]).first();
  if (!employee) fail('Employee not found.',404);
  const profile = parse(employee.profile);
  if (method === 'GET') {
    const config = await stmt(db,"SELECT payload FROM dashboard_configuration WHERE company_id=? AND section='shifts'",[actor.company_id]).first();
    const locations = await geofenceSites(db,actor.company_id);
    const legacy = await Promise.all(['personal_details','professional_details','bank_details','family_details'].map(table => stmt(db,`SELECT * FROM ${table} WHERE userid=?`,[employee.user_id]).first().catch(()=>null)));
    return { ...normalizeDossier(Object.assign({},...legacy.filter(Boolean),profile,employee)), userid: employee.user_id, employee_id: employee.employee_id, employee_code: employee.employee_code,
      profile_pic_url: profile.profile_pic_url || '', dossier_revision: profile.dossier_revision || 0, profile_finalized: profile.profile_finalized === true, finalized_at: profile.finalized_at || '',
      available_locations: locations, available_shifts: parse(config?.payload || '[]'), shift_id: profile.shift_id || '', shift_override: profile.shift_override || null, attendance_rule: resolveAttendanceRule(profile.attendance_rule,locations), kpi_records: profile.kpi_records || [], dossier_audit: profile.dossier_audit || [] };
  }
  if (method !== 'POST') fail('Method not allowed.',405);
  if (body.dossier_revision != null && body.dossier_revision !== (profile.dossier_revision || 0)) fail('This dossier changed. Refresh before saving.',409);
  const changes = {};
  for (const [key,,type] of DOSSIER_FIELDS) if (Object.hasOwn(body,key)) {
    if (typeof body[key] !== 'string' || body[key].length > 2000) fail(`Invalid ${key}.`);
    const value = body[key].trim();
    if (type === 'date' && value && !validDay(value)) fail(`Invalid ${key}.`);
    if (type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(`Invalid ${key}.`);
    changes[key] = value;
  }
  if (Object.hasOwn(changes,'first_name') && !changes.first_name) fail('First name is required.');
  if (changes.preferred_payment_method && !PAYMENT_METHODS.includes(changes.preferred_payment_method)) fail('Choose a valid payment method.');
  if (Object.hasOwn(changes,'email') && !changes.email) fail('Work email is required.');
  if (changes.status && !['Active','OnLeave','Probation','Inactive'].includes(changes.status)) fail('Invalid employment status.');
  if (Object.hasOwn(body,'shift_id')) {
    if (typeof body.shift_id !== 'string') fail('Invalid shift.');
    const config = await stmt(db,"SELECT payload FROM dashboard_configuration WHERE company_id=? AND section='shifts'",[actor.company_id]).first();
    if (body.shift_id && !parse(config?.payload || '[]').some(shift=>shift.id===body.shift_id&&shift.status==='Active')) fail('Choose an active company shift.');
    changes.shift_id = body.shift_id;
  }
  if (Object.hasOwn(body,'shift_override')) changes.shift_override = body.shift_override === null ? null : validateShift(body.shift_override);
  if (Object.hasOwn(body,'attendance_rule')) changes.attendance_rule = await validateAttendanceRule(db,actor.company_id,body.attendance_rule);
  if (Object.hasOwn(body,'kpi_records')) {
    if (!Array.isArray(body.kpi_records) || body.kpi_records.length>50) fail('Use up to 50 KPI records.');
    changes.kpi_records = body.kpi_records.map(item=>{
      if (!String(item.title||'').trim() || !Number.isFinite(item.target) || item.target<=0 || !Number.isFinite(item.actual) || item.actual<0) fail('KPI needs a title, positive target and non-negative actual.');
      return {id:String(item.id||crypto.randomUUID()),title:String(item.title).slice(0,200),target:item.target,actual:item.actual,unit:String(item.unit||'').slice(0,40),period:String(item.period||'').slice(0,40)};
    });
  }
  if (!Object.keys(changes).length && body.profile_finalized !== true) fail('No supported changes supplied.');
  const next = {...profile,...changes,dossier_revision:(profile.dossier_revision||0)+1,profile_finalized:body.profile_finalized===true};
  if (Object.hasOwn(changes,'date_of_birth')) next.dob = changes.date_of_birth;
  if (next.profile_finalized) {
    if (!(changes.first_name ?? employee.first_name) || !(changes.email ?? employee.email)) fail('Add first name and work email before finalizing.');
    next.finalized_at = new Date().toISOString();
  } else next.finalized_at = '';
  next.dossier_audit = [{at:new Date().toISOString(),actor:actor.user_id,action:next.profile_finalized?'Finalized':'Updated',fields:Object.keys(changes)},...(profile.dossier_audit||[])].slice(0,50);
  const statements=[];
  if (Object.hasOwn(changes,'email')) statements.push(stmt(db,'UPDATE users SET email=? WHERE company_id=? AND user_id=? AND EXISTS(SELECT 1 FROM employees WHERE company_id=? AND user_id=? AND profile=?)',[changes.email,actor.company_id,employee.user_id,actor.company_id,employee.user_id,employee.profile]));
  statements.push(stmt(db,'UPDATE employees SET first_name=?,last_name=?,department=?,designation=?,status=?,profile=? WHERE company_id=? AND employee_id=? AND profile=?',[changes.first_name??employee.first_name,changes.last_name??employee.last_name,changes.department??employee.department,changes.designation??employee.designation,changes.status??employee.status,JSON.stringify(next),actor.company_id,employee.employee_id,employee.profile]));
  const results=await db.batch(statements),last=results.at(-1);
  if ((last?.meta?.changes??last?.changes)!==1) fail('This dossier changed. Refresh before saving.',409);
  return {userid:employee.user_id,saved:true,dossier_revision:next.dossier_revision};
}
