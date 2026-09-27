import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const PAYROLL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS payslip_templates (id TEXT PRIMARY KEY, design TEXT NOT NULL, slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 5), version INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(design, slot))`,
  `CREATE TABLE IF NOT EXISTS payslip_groups (id TEXT PRIMARY KEY, payload TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS payslip_assignments (id TEXT PRIMARY KEY, payload TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS payslip_records (id TEXT PRIMARY KEY, userid TEXT NOT NULL, year TEXT NOT NULL, month TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL, object_key TEXT, error TEXT, payload TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS payslip_employee_period ON payslip_records(userid, year, month)`
];
export function existingCloudflareConfig() {
  let config = ''; try { config = readFileSync(join(process.cwd(), 'wrangler.toml'), 'utf8'); } catch {}
  return { databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID || config.match(/database_id\s*=\s*"([^"]+)"/)?.[1], bucket: process.env.R2_BUCKET_NAME || config.match(/bucket_name\s*=\s*"([^"]+)"/)?.[1] };
}
export function createPayrollDatabase({ filename, env = process.env } = {}) {
  const cloud = existingCloudflareConfig();
  const configured = Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN && cloud.databaseId);
  if (env.NODE_ENV === 'production' && !configured && !filename) throw new Error('Configure Cloudflare D1 before enabling production payroll.');
  let local;
  if (!configured || filename) { if (!filename) mkdirSync(join(process.cwd(), 'data'), { recursive: true }); local = new DatabaseSync(filename || join(process.cwd(), 'data', 'payroll.sqlite')); local.exec('PRAGMA journal_mode = WAL;'); }
  async function query(sql, params = []) {
    if (local) {
      const stmt = local.prepare(sql);
      if (/^\s*(SELECT|PRAGMA)/i.test(sql) || /\bRETURNING\b/i.test(sql)) return stmt.all(...params);
      return stmt.run(...params);
    }
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${cloud.databaseId}/query`, { method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }), signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (!response.ok || !body.success || body.result?.some(result => !result.success)) throw new Error('Cloudflare D1 query failed. Check the server configuration.');
    return body.result[0]?.results || [];
  }
  let ready;
  return { mode: local ? 'SQLite (local)' : 'Cloudflare D1', query, async ready() { ready ||= (async () => { for (const sql of PAYROLL_SCHEMA) await query(sql); })().catch(error => { ready = null; throw error; }); return ready; }, close() { local?.close(); } };
}
