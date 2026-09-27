CREATE TABLE billing_plans (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 amount INTEGER CHECK(amount IS NULL OR amount > 0),
 currency TEXT NOT NULL DEFAULT 'INR',
 employee_limit INTEGER,
 dashboard_limit INTEGER,
 description TEXT NOT NULL,
 sort_order INTEGER NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1
);
INSERT INTO billing_plans(id,name,amount,employee_limit,dashboard_limit,description,sort_order) VALUES
 ('starter','Starter',199900,10,2,'For small teams getting started.',1),
 ('team','Team',399900,50,5,'For growing teams and shared HR responsibilities.',2),
 ('business','Business',599900,200,10,'For established teams with more administrators.',3),
 ('enterprise','Enterprise',NULL,NULL,NULL,'Custom capacity and commercial terms.',4);
CREATE TABLE billing_orders (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 plan_id TEXT NOT NULL REFERENCES billing_plans(id),
 plan_snapshot TEXT NOT NULL CHECK(json_valid(plan_snapshot)),
 amount INTEGER NOT NULL CHECK(amount > 0),
 currency TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 provider_order_id TEXT UNIQUE,
 provider_payment_id TEXT UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('creating','pending','activated','failed')),
 created_at TEXT NOT NULL,
 activated_at TEXT,
 created_by TEXT NOT NULL,
 key_id TEXT NOT NULL
);
CREATE UNIQUE INDEX billing_one_pending ON billing_orders(company_id,mode) WHERE status IN ('creating','pending');
CREATE INDEX billing_company_orders ON billing_orders(company_id,mode,created_at);
CREATE TABLE company_subscriptions (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 id TEXT NOT NULL UNIQUE,
 plan_id TEXT NOT NULL REFERENCES billing_plans(id),
 employee_limit INTEGER NOT NULL,
 dashboard_limit INTEGER NOT NULL,
 starts_at TEXT NOT NULL,
 ends_at TEXT NOT NULL,
 last_order_id TEXT NOT NULL REFERENCES billing_orders(id),
 PRIMARY KEY(company_id,mode)
);
CREATE TABLE billing_events (
 event_id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES billing_orders(id),
 event_type TEXT NOT NULL,
 received_at TEXT NOT NULL
);
CREATE TABLE subscription_audit (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 order_id TEXT NOT NULL UNIQUE REFERENCES billing_orders(id),
 action TEXT NOT NULL,
 created_at TEXT NOT NULL
);
DROP TRIGGER dashboard_access_limit;
DROP TRIGGER dashboard_access_insert_limit;
CREATE TRIGGER dashboard_access_limit BEFORE UPDATE OF dashboard_access ON employees
WHEN NEW.dashboard_access=1 AND OLD.dashboard_access=0 AND (
 EXISTS(SELECT 1 FROM company_subscriptions WHERE company_id=NEW.company_id AND mode='live' AND ends_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 OR (SELECT COUNT(*) FROM employees e JOIN users u ON u.user_id=e.user_id WHERE e.company_id=NEW.company_id AND e.dashboard_access=1 AND u.role='employee') >= COALESCE((SELECT dashboard_limit FROM company_subscriptions WHERE company_id=NEW.company_id AND mode='live'),3))
BEGIN SELECT RAISE(ABORT,'Dashboard user plan limit reached'); END;
CREATE TRIGGER dashboard_access_insert_limit BEFORE INSERT ON employees
WHEN NEW.dashboard_access=1 AND (
 EXISTS(SELECT 1 FROM company_subscriptions WHERE company_id=NEW.company_id AND mode='live' AND ends_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 OR (SELECT COUNT(*) FROM employees e JOIN users u ON u.user_id=e.user_id WHERE e.company_id=NEW.company_id AND e.dashboard_access=1 AND u.role='employee') >= COALESCE((SELECT dashboard_limit FROM company_subscriptions WHERE company_id=NEW.company_id AND mode='live'),3))
BEGIN SELECT RAISE(ABORT,'Dashboard user plan limit reached'); END;
CREATE TRIGGER employee_plan_insert_limit BEFORE INSERT ON employees
WHEN NEW.status!='Inactive' AND EXISTS(SELECT 1 FROM users WHERE user_id=NEW.user_id AND role='employee')
 AND EXISTS(SELECT 1 FROM company_subscriptions s WHERE s.company_id=NEW.company_id AND s.mode='live' AND (s.ends_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR (SELECT COUNT(*) FROM employees e JOIN users u ON u.user_id=e.user_id WHERE e.company_id=NEW.company_id AND e.status!='Inactive' AND u.role='employee')>=s.employee_limit))
BEGIN SELECT RAISE(ABORT,'Employee plan limit reached'); END;
CREATE TRIGGER employee_plan_reactivation_limit BEFORE UPDATE OF status ON employees
WHEN NEW.status!='Inactive' AND OLD.status='Inactive' AND EXISTS(SELECT 1 FROM users WHERE user_id=NEW.user_id AND role='employee')
 AND EXISTS(SELECT 1 FROM company_subscriptions s WHERE s.company_id=NEW.company_id AND s.mode='live' AND (s.ends_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR (SELECT COUNT(*) FROM employees e JOIN users u ON u.user_id=e.user_id WHERE e.company_id=NEW.company_id AND e.status!='Inactive' AND u.role='employee')>=s.employee_limit))
BEGIN SELECT RAISE(ABORT,'Employee plan limit reached'); END;
