import { istDay } from '../shared/overviewModel.mjs';

// Support existing installations before their next migration rollout.
async function withSchema(db, operation) {
  try { return await operation(); } catch (error) {
    if (!(error.code === 'SQLITE_MISSING_TABLE' && error.table === 'signin_activity') && !/no such table.*signin_activity/i.test(error.message)) throw error;
    await db.prepare("CREATE TABLE IF NOT EXISTS signin_activity (id TEXT PRIMARY KEY NOT NULL, company_id TEXT NOT NULL, user_id TEXT NOT NULL, event TEXT NOT NULL CHECK(event IN ('login','logout')), occurred_at TEXT NOT NULL, FOREIGN KEY(company_id,user_id) REFERENCES users(company_id,user_id))").run();
    await db.prepare('CREATE INDEX IF NOT EXISTS signin_activity_company_time ON signin_activity(company_id,occurred_at DESC)').run();
    return operation();
  }
}

export async function recordSigninActivity(db, actor, event, time = Date.now()) {
  const timestamp = new Date(time).toISOString();
  await withSchema(db, () => db.prepare('INSERT INTO signin_activity(id,company_id,user_id,event,occurred_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), actor.company_id, actor.user_id, event, timestamp).run());
}

export async function signinActivityHandle({ db, actor, time = Date.now() }) {
  // Company-wide authentication history is reserved for company administrators.
  if (actor.role !== 'company_admin') throw Object.assign(new Error('Company administrator access required.'), { status: 403 });
  const day = istDay(time);
  const start = new Date(day + 'T00:00:00+05:30').toISOString();
  const end = new Date(Date.parse(start) + 86400000).toISOString();
  const result = await withSchema(db, () => db.prepare(`SELECT a.id,a.user_id,a.event,a.occurred_at,
    COALESCE(NULLIF(TRIM(COALESCE(e.first_name,'') || ' ' || COALESCE(e.last_name,'')),''),u.username) AS name
    FROM signin_activity a JOIN users u ON u.company_id=a.company_id AND u.user_id=a.user_id
    LEFT JOIN employees e ON e.company_id=a.company_id AND e.user_id=a.user_id
    WHERE a.company_id=? AND a.occurred_at>=? AND a.occurred_at<?
    ORDER BY a.occurred_at DESC,a.id DESC LIMIT 50`).bind(actor.company_id, start, end).all());
  return { day, items: result.results, limit: 50 };
}
