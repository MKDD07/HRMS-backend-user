import dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { existingCloudflareConfig } from '../server/payrollDatabase.mjs';
import { createD1RestDatabase } from '../server/d1RestDatabase.mjs';

dotenv.config({ quiet: true });
dotenv.config({ path: '.env.groq', quiet: true });
const apply = process.argv.includes('--apply');
const companyId = '958d5903-c86b-45e3-8c95-4162a1b9d4dd';
const userId = '6bc1424d-dfc7-4623-aee7-79075914e52e';
const db = createD1RestDatabase({ account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN, databaseId: existingCloudflareConfig().databaseId });
const person = await db.prepare("SELECT e.profile,e.employee_code,e.first_name,e.last_name,e.department FROM employees e WHERE company_id=? AND user_id=?").bind(companyId, userId).first();
if (!person || person.first_name !== 'Michelle' || person.last_name !== 'Nunes' || person.employee_code !== 'AST-001' || person.department !== 'Fitness') throw new Error('Employee identity did not match the reviewed record.');
const profile = JSON.parse(person.profile || '{}');
const period = '2026-11';
const stableId = name => createHash('sha256').update(`${companyId}:${userId}:${period}:${name}`).digest('hex').slice(0, 32);
const kpis = [
  ['Personal training sessions delivered', 40, 'sessions'],
  ['Client fitness assessments completed', 12, 'assessments'],
  ['Individual workout plans reviewed', 12, 'plans'],
  ['Professional development completed', 4, 'hours'],
].map(([title, target, unit]) => ({ id: stableId(title), title, target, actual: 0, unit, period }));
const note = 'Initial targets added at the user’s request on 15 Nov 2026. Progress starts at zero; no historical achievements have been entered.';
const goals = [
  { title: 'Deliver consistent personal training sessions', due_date: '2026-11-30', key_results: [{ title: 'Deliver planned personal training sessions', target: 40, current: 0 }, { title: 'Record session notes and follow-up actions', target: 40, current: 0 }] },
  { title: 'Refresh client assessments and workout plans', due_date: '2026-11-30', key_results: [{ title: 'Complete client fitness assessments', target: 12, current: 0 }, { title: 'Review and update individual workout plans', target: 12, current: 0 }] },
  { title: 'Strengthen coaching skills and session safety', due_date: '2026-12-31', key_results: [{ title: 'Complete professional development hours', target: 4, current: 0 }, { title: 'Review the session safety checklist with the team', target: 1, current: 0 }] },
].map(goal => ({ ...goal, id: stableId(goal.title), employee_id: userId, status: 'Not started', notes: note }));
const existingGoals = (await db.prepare("SELECT id,payload FROM talent_records WHERE company_id=? AND collection='goals' AND json_extract(payload,'$.employee_id')=?").bind(companyId, userId).all()).results;
const existingKpis = profile.kpi_records || [];
const missingKpis = kpis.filter(item => !existingKpis.some(row => row.id === item.id || (row.title === item.title && row.period === item.period)));
const missingGoals = goals.filter(item => !existingGoals.some(row => row.id === item.id || JSON.parse(row.payload).title === item.title));
console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', employee: 'Michelle Nunes (AST-001)', period, kpisToAdd: missingKpis, goalsToAdd: missingGoals }, null, 2));
if (!apply) process.exit(0);
try { await db.prepare('SELECT id FROM talent_audit LIMIT 1').all(); } catch (error) {
  if (error.code !== 'SQLITE_MISSING_TABLE' || error.table !== 'talent_audit') throw error;
  const migration = readFileSync(new URL('../migrations/hrms/0014_talent_recruitment_audit.sql', import.meta.url), 'utf8');
  for (const sql of migration.split(';').map(sql => sql.trim()).filter(sql => /^CREATE (?:TABLE IF NOT EXISTS talent_audit|INDEX IF NOT EXISTS talent_audit_record)/.test(sql))) await db.prepare(sql).run();
}
const now = new Date().toISOString();
if (missingKpis.length) {
  const next = { ...profile, kpi_records: [...existingKpis, ...missingKpis], dossier_revision: (profile.dossier_revision || 0) + 1, profile_finalized: false };
  next.dossier_audit = [{ at: now, actor: 'Codex (user-requested setup)', action: 'Added KPI targets', fields: ['kpi_records'] }, ...(profile.dossier_audit || [])].slice(0, 50);
  const saved = await db.prepare('UPDATE employees SET profile=? WHERE company_id=? AND user_id=? AND profile=? RETURNING user_id').bind(JSON.stringify(next), companyId, userId, person.profile).all();
  if (saved.results.length !== 1) throw new Error('Profile changed while preparing targets. Rerun to preserve the latest edits.');
}
for (const goal of goals.filter(goal => missingGoals.some(row => row.id === goal.id) || existingGoals.some(row => row.id === goal.id))) {
  await db.prepare("INSERT INTO talent_records(company_id,collection,id,payload,created_at,updated_at) VALUES(?,'goals',?,?,?,?) ON CONFLICT(company_id,collection,id) DO NOTHING").bind(companyId, goal.id, JSON.stringify(goal), now, now).run();
  await db.prepare("INSERT INTO talent_audit(company_id,id,collection,record_id,actor_id,action,before_json,after_json,created_at) VALUES(?,?,'goals',?,'codex:user-request','created',NULL,?,?) ON CONFLICT(company_id,id) DO NOTHING").bind(companyId, stableId('audit:' + goal.id), goal.id, JSON.stringify(goal), now).run();
}
const verifiedProfile = JSON.parse((await db.prepare('SELECT profile FROM employees WHERE company_id=? AND user_id=?').bind(companyId, userId).first()).profile);
const verifiedGoals = (await db.prepare("SELECT id FROM talent_records WHERE company_id=? AND collection='goals' AND json_extract(payload,'$.employee_id')=?").bind(companyId, userId).all()).results;
if (!kpis.every(kpi => verifiedProfile.kpi_records.some(row => row.id === kpi.id || row.title === kpi.title)) || !goals.every(goal => verifiedGoals.some(row => row.id === goal.id) || existingGoals.some(row => JSON.parse(row.payload).title === goal.title))) throw new Error('Verification failed. Review the saved records.');
console.log(JSON.stringify({ verified: true, kpisAdded: missingKpis.length, goalsAdded: missingGoals.length }));
