import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CALENDAR_SCHEMA } from './calendarStorage.mjs';

// Run only after confirming all legacy calendar records belong to this company.
export function migrateCalendar(db, company, { removeLegacy = false } = {}) {
  if (typeof company !== 'string' || !company.trim() || company.length > 100) throw new Error('Explicit company ID is required.');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const sql of CALENDAR_SCHEMA) db.exec(sql);
    db.exec('CREATE TABLE IF NOT EXISTS calendar_migrations (source TEXT PRIMARY KEY, company_id TEXT NOT NULL)');
    const previous = db.prepare("SELECT company_id FROM calendar_migrations WHERE source='legacy-calendar'").get();
    if (previous) {
      if (previous.company_id !== company) throw new Error('Legacy calendar has already been assigned to another company.');
      if (removeLegacy && db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name IN ('calendar_holidays','calendar_leave_types','calendar_policy_groups','calendar_assignments')").get()) throw new Error('Already migrated. Review legacy tables before deleting them.');
      db.exec('COMMIT'); return;
    }
    if (db.prepare('SELECT 1 FROM company_calendar WHERE company_id=?').get(company)) throw new Error('Target already has calendar data. Merge must be reviewed explicitly.');
    const read = table => db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)
      ? db.prepare(`SELECT id, payload FROM ${table}`).all().map(row => {
        const value = JSON.parse(row.payload);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid legacy record in ${table}`);
        return { ...value, id: row.id };
      }) : [];
    const holidays = read('calendar_holidays');
    const leaveTypes = read('calendar_leave_types');
    const groups = read('calendar_policy_groups');
    db.prepare('INSERT INTO company_calendar(company_id,holidays,leave_types,policy_groups) VALUES(?,?,?,?)')
      .run(company, JSON.stringify(holidays), JSON.stringify(leaveTypes), JSON.stringify(groups));
    for (const entry of read('calendar_assignments')) {
      if (!entry.userid || entry.userid !== entry.id) throw new Error('Invalid legacy employee assignment.');
      const { id, ...payload } = entry;
      db.prepare('INSERT INTO company_calendar_assignments(company_id,userid,payload) VALUES(?,?,?)').run(company, entry.userid, JSON.stringify(payload));
    }
    db.prepare("INSERT INTO calendar_migrations(source,company_id) VALUES('legacy-calendar',?)").run(company);
    const saved = db.prepare('SELECT * FROM company_calendar WHERE company_id=?').get(company);
    for (const [column, expected] of [['holidays', holidays], ['leave_types', leaveTypes], ['policy_groups', groups]]) {
      if (saved[column] !== JSON.stringify(expected)) throw new Error('Calendar migration verification failed.');
    }
    const assignments = read('calendar_assignments');
    for (const { id, ...payload } of assignments) {
      const savedAssignment = db.prepare('SELECT payload FROM company_calendar_assignments WHERE company_id=? AND userid=?').get(company, id);
      if (savedAssignment?.payload !== JSON.stringify(payload)) throw new Error('Assignment migration verification failed.');
    }
    if (removeLegacy) {
      for (const table of ['calendar_holidays', 'calendar_leave_types', 'calendar_policy_groups', 'calendar_assignments']) db.exec(`DROP TABLE IF EXISTS ${table}`);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [filename, company] = process.argv.slice(2);
  if (!filename || !company || !existsSync(filename)) throw new Error('Usage: node server/migrateCalendar.mjs <existing-sqlite-file> <confirmed-company-id>');
  const db = new DatabaseSync(filename);
  try {
    const backupFile = `${filename}.calendar-backup-${Date.now()}.sqlite`;
    await backup(db, backupFile);
    const removeLegacy = process.argv.includes('--remove-legacy');
    migrateCalendar(db, company, { removeLegacy });
    console.log(`Calendar migrated for ${company}. Backup: ${backupFile}. Legacy tables ${removeLegacy ? 'removed after verification' : 'retained'}.`);
  } finally { db.close(); }
}
