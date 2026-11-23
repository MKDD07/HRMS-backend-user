CREATE TABLE IF NOT EXISTS billing_workspace_policy (
 company_id TEXT PRIMARY KEY REFERENCES companies(company_id),
 test_enabled INTEGER NOT NULL DEFAULT 0 CHECK(test_enabled IN (0,1)),
 test_plan_id TEXT REFERENCES billing_plans(id),
 mutation_id TEXT,
 revision INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL,
 updated_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_plan_changes (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 actor_id TEXT NOT NULL,
 from_plan TEXT,
 to_plan TEXT,
 action TEXT NOT NULL,
 created_at TEXT NOT NULL,
 details TEXT NOT NULL CHECK(json_valid(details))
);
CREATE INDEX IF NOT EXISTS billing_plan_changes_company ON billing_plan_changes(company_id,created_at);

CREATE VIEW IF NOT EXISTS workspace_plan_capacity AS
SELECT c.company_id,
 CASE WHEN w.test_enabled=1 THEN p.employee_limit ELSE s.employee_limit END AS employee_limit,
 CASE WHEN w.test_enabled=1 THEN p.dashboard_limit ELSE COALESCE(s.dashboard_limit,3) END AS dashboard_limit,
 CASE WHEN w.test_enabled=1 THEN NULL ELSE s.ends_at END AS ends_at
FROM companies c LEFT JOIN billing_workspace_policy w ON w.company_id=c.company_id
LEFT JOIN billing_plans p ON p.id=w.test_plan_id
LEFT JOIN company_subscriptions s ON s.company_id=c.company_id AND s.mode='live';
DROP TRIGGER IF EXISTS dashboard_access_limit;
DROP TRIGGER IF EXISTS dashboard_access_insert_limit;
DROP TRIGGER IF EXISTS employee_plan_insert_limit;
DROP TRIGGER IF EXISTS employee_plan_reactivation_limit;
CREATE TRIGGER dashboard_access_limit BEFORE UPDATE OF dashboard_access ON employees
WHEN NEW.dashboard_access=1 AND OLD.dashboard_access=0 AND EXISTS(SELECT 1 FROM users WHERE user_id=NEW.user_id AND role='employee')
AND EXISTS(SELECT 1 FROM workspace_plan_capacity s WHERE s.company_id=NEW.company_id AND
(s.ends_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR (SELECT COUNT(*) FROM employees e JOIN users u ON u.user_id=e.user_id AND u.company_id=e.company_id WHERE e.company_id=NEW.company_id AND e.dashboard_access=1 AND u.role='employee')>=s.dashboard_limit))
BEGIN SELECT RAISE(ABORT,'Dashboard user plan limit reached'); END;
CREATE TRIGGER dashboard_access_insert_limit BEFORE INSERT ON employees
WHEN NEW.dashboard_access=1 AND EXISTS(SELECT 1 FROM users WHERE user_id=NEW.user_id AND role='employee')
AND EXISTS(SELECT 1 FROM workspace_plan_capacity s WHERE s.company_id=NEW.company_id AND
(s.ends_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR (SELECT COUNT(*) FROM employees e JOIN users u ON u.user_id=e.user_id AND u.company_id=e.company_id WHERE e.company_id=NEW.company_id AND e.dashboard_access=1 AND u.role='employee')>=s.dashboard_limit))
BEGIN SELECT RAISE(ABORT,'Dashboard user plan limit reached'); END;
CREATE TRIGGER employee_plan_insert_limit BEFORE INSERT ON employees
WHEN NEW.status!='Inactive' AND EXISTS(SELECT 1 FROM users WHERE user_id=NEW.user_id AND role='employee')
AND EXISTS(SELECT 1 FROM workspace_plan_capacity s WHERE s.company_id=NEW.company_id AND
(s.ends_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR (SELECT COUNT(*) FROM employees e JOIN users u ON u.user_id=e.user_id AND u.company_id=e.company_id WHERE e.company_id=NEW.company_id AND e.status!='Inactive' AND u.role='employee')>=s.employee_limit))
BEGIN SELECT RAISE(ABORT,'Employee plan limit reached'); END;
CREATE TRIGGER employee_plan_reactivation_limit BEFORE UPDATE OF status ON employees
WHEN NEW.status!='Inactive' AND OLD.status='Inactive' AND EXISTS(SELECT 1 FROM users WHERE user_id=NEW.user_id AND role='employee')
AND EXISTS(SELECT 1 FROM workspace_plan_capacity s WHERE s.company_id=NEW.company_id AND
(s.ends_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR (SELECT COUNT(*) FROM employees e JOIN users u ON u.user_id=e.user_id AND u.company_id=e.company_id WHERE e.company_id=NEW.company_id AND e.status!='Inactive' AND u.role='employee')>=s.employee_limit))
BEGIN SELECT RAISE(ABORT,'Employee plan limit reached'); END;
