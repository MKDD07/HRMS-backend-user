import { Buffer } from 'node:buffer';

export const CALENDAR_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS company_calendar (
    company_id TEXT PRIMARY KEY NOT NULL,
    holidays TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(holidays) AND json_type(holidays)='array'),
    important_dates TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(important_dates) AND json_type(important_dates)='array'),
    leave_types TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(leave_types) AND json_type(leave_types)='array'),
    policy_groups TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(policy_groups) AND json_type(policy_groups)='array'),
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS company_calendar_assignments (
    company_id TEXT NOT NULL, userid TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
    PRIMARY KEY(company_id, userid),
    FOREIGN KEY(company_id) REFERENCES company_calendar(company_id)
  )`
];

const columns = new Set(['holidays', 'important_dates', 'leave_types', 'policy_groups']);
export function calendarStorage(db) {
  async function ensure(company) {
    await db.query('INSERT OR IGNORE INTO company_calendar(company_id) VALUES(?)', [company]);
  }
  return {
    async ready() { for (const sql of CALENDAR_SCHEMA) await db.query(sql); },
    async configuration(company) {
      const row = (await db.query('SELECT * FROM company_calendar WHERE company_id=?', [company]))[0];
      return {
        holidays: JSON.parse(row?.holidays || '[]'), importantDates: JSON.parse(row?.important_dates || '[]'),
        leaveTypes: JSON.parse(row?.leave_types || '[]'), groups: JSON.parse(row?.policy_groups || '[]'),
        assignments: (await db.query('SELECT payload FROM company_calendar_assignments WHERE company_id=?', [company])).map(row => JSON.parse(row.payload)),
        storage: db.mode
      };
    },
    async change(company, column, id, value) {
      if (!columns.has(column)) throw new Error('Invalid calendar collection.');
      await ensure(company);
      // Compare-and-swap prevents simultaneous edits to different entries being lost.
      for (let attempt = 0; attempt < 8; attempt++) {
        const row = (await db.query(`SELECT ${column}, revision FROM company_calendar WHERE company_id=?`, [company]))[0];
        const entries = JSON.parse(row[column]);
        const index = entries.findIndex(item => item.id === id);
        if (value === undefined) { if (index >= 0) entries.splice(index, 1); }
        else if (index >= 0) entries[index] = value;
        else entries.push(value);
        if (Buffer.byteLength(JSON.stringify(entries)) > 500_000) throw new Error('Calendar collection is too large.');
        const updated = await db.query(`UPDATE company_calendar SET ${column}=?, revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE company_id=? AND revision=? RETURNING company_id`, [JSON.stringify(entries), company, row.revision]);
        if (updated.length) return;
      }
      throw new Error('Calendar changed concurrently. Please retry.');
    },
    async assign(company, value) {
      await ensure(company);
      await db.query('INSERT INTO company_calendar_assignments(company_id,userid,payload) VALUES(?,?,?) ON CONFLICT(company_id,userid) DO UPDATE SET payload=excluded.payload', [company, value.userid, JSON.stringify(value)]);
    }
  };
}
