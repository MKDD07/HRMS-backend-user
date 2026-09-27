ALTER TABLE employees ADD COLUMN dashboard_access INTEGER NOT NULL DEFAULT 0 CHECK(dashboard_access IN (0,1));
ALTER TABLE employees ADD COLUMN dashboard_pages TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(dashboard_pages) AND json_type(dashboard_pages)='array');
CREATE TRIGGER dashboard_access_limit BEFORE UPDATE OF dashboard_access ON employees
WHEN NEW.dashboard_access=1 AND OLD.dashboard_access=0
 AND (SELECT COUNT(*) FROM employees e JOIN users u ON u.user_id=e.user_id WHERE e.company_id=NEW.company_id AND e.dashboard_access=1 AND u.role='employee') >= 3
BEGIN SELECT RAISE(ABORT, 'Maximum three dashboard users per company'); END;
CREATE TRIGGER dashboard_access_insert_limit BEFORE INSERT ON employees
WHEN NEW.dashboard_access=1
 AND (SELECT COUNT(*) FROM employees e JOIN users u ON u.user_id=e.user_id WHERE e.company_id=NEW.company_id AND e.dashboard_access=1 AND u.role='employee') >= 3
BEGIN SELECT RAISE(ABORT, 'Maximum three dashboard users per company'); END;
CREATE TABLE dashboard_configuration (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 section TEXT NOT NULL CHECK(section IN ('shifts','settings')),
 payload TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(payload)),
 revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(company_id,section)
);
