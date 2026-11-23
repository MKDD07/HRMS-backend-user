CREATE TABLE IF NOT EXISTS directory_cache_revisions (
  company_id TEXT PRIMARY KEY NOT NULL,
  revision TEXT NOT NULL
);

-- Triggers cover edits from every API module and direct database updates.
CREATE TRIGGER IF NOT EXISTS directory_employee_insert AFTER INSERT ON employees BEGIN
  INSERT INTO directory_cache_revisions VALUES(NEW.company_id,lower(hex(randomblob(16))))
  ON CONFLICT(company_id) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS directory_employee_update AFTER UPDATE ON employees BEGIN
  INSERT INTO directory_cache_revisions VALUES(OLD.company_id,lower(hex(randomblob(16))))
  ON CONFLICT(company_id) DO UPDATE SET revision=excluded.revision;
  INSERT INTO directory_cache_revisions VALUES(NEW.company_id,lower(hex(randomblob(16))))
  ON CONFLICT(company_id) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS directory_employee_delete AFTER DELETE ON employees BEGIN
  INSERT INTO directory_cache_revisions VALUES(OLD.company_id,lower(hex(randomblob(16))))
  ON CONFLICT(company_id) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS directory_user_insert AFTER INSERT ON users BEGIN
  INSERT INTO directory_cache_revisions VALUES(NEW.company_id,lower(hex(randomblob(16))))
  ON CONFLICT(company_id) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS directory_user_update AFTER UPDATE ON users BEGIN
  INSERT INTO directory_cache_revisions VALUES(OLD.company_id,lower(hex(randomblob(16))))
  ON CONFLICT(company_id) DO UPDATE SET revision=excluded.revision;
  INSERT INTO directory_cache_revisions VALUES(NEW.company_id,lower(hex(randomblob(16))))
  ON CONFLICT(company_id) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS directory_user_delete AFTER DELETE ON users BEGIN
  INSERT INTO directory_cache_revisions VALUES(OLD.company_id,lower(hex(randomblob(16))))
  ON CONFLICT(company_id) DO UPDATE SET revision=excluded.revision;
END;
