CREATE TABLE billing_recurring (
 id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 plan_id TEXT NOT NULL REFERENCES billing_plans(id),
 plan_snapshot TEXT NOT NULL CHECK(json_valid(plan_snapshot)),
 key_id TEXT NOT NULL,
 provider_plan_id TEXT,
 provider_subscription_id TEXT UNIQUE,
 status TEXT NOT NULL,
 starts_at TEXT NOT NULL,
 charge_at TEXT,
 current_start TEXT,
 current_end TEXT,
 authorized_at TEXT,
 created_at TEXT NOT NULL,
 created_by TEXT NOT NULL,
 last_synced_at TEXT,
 last_error TEXT
);
CREATE UNIQUE INDEX billing_one_recurring ON billing_recurring(company_id,mode)
 WHERE status NOT IN ('cancelled','completed','expired','failed');
CREATE TABLE billing_recurring_events (
 event_id TEXT PRIMARY KEY,
 recurring_id TEXT NOT NULL REFERENCES billing_recurring(id),
 event_type TEXT NOT NULL,
 received_at TEXT NOT NULL
);
