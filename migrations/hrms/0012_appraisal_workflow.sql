-- Appraisal workflow; existing simple appraisal records remain untouched.
CREATE TABLE IF NOT EXISTS appraisal_templates (
 company_id TEXT NOT NULL REFERENCES companies(company_id), id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)), revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(company_id,id)
);
CREATE TABLE IF NOT EXISTS appraisal_cycles (
 company_id TEXT NOT NULL REFERENCES companies(company_id), id TEXT NOT NULL,
 name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('Draft','Launched','Published','Closed')),
 template_id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
 revision INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id), FOREIGN KEY(company_id,template_id) REFERENCES appraisal_templates(company_id,id)
);
CREATE TABLE IF NOT EXISTS appraisal_reviews (
 company_id TEXT NOT NULL, id TEXT NOT NULL, cycle_id TEXT NOT NULL, employee_id TEXT NOT NULL,
 manager_id TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(payload)),
 revision INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id), UNIQUE(company_id,cycle_id,employee_id),
 FOREIGN KEY(company_id,cycle_id) REFERENCES appraisal_cycles(company_id,id),
 FOREIGN KEY(company_id,employee_id) REFERENCES users(company_id,user_id),
 FOREIGN KEY(company_id,manager_id) REFERENCES users(company_id,user_id)
);
CREATE INDEX IF NOT EXISTS appraisal_reviews_employee ON appraisal_reviews(company_id,employee_id,status);
CREATE INDEX IF NOT EXISTS appraisal_reviews_manager ON appraisal_reviews(company_id,manager_id,status);
CREATE TABLE IF NOT EXISTS appraisal_responses (
 company_id TEXT NOT NULL, review_id TEXT NOT NULL, question_id TEXT NOT NULL, rater_id TEXT NOT NULL,
 rater_type TEXT NOT NULL CHECK(rater_type IN ('self','manager','peer')),
 rating REAL CHECK(rating>=1 AND rating<=5), comment TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,review_id,rater_type,rater_id,question_id),
 FOREIGN KEY(company_id,review_id) REFERENCES appraisal_reviews(company_id,id)
);
CREATE TABLE IF NOT EXISTS appraisal_scores (
 company_id TEXT NOT NULL, review_id TEXT NOT NULL, self_score REAL, manager_score REAL,
 final_score REAL, calibration_reason TEXT NOT NULL DEFAULT '', calibrated_by TEXT,
 PRIMARY KEY(company_id,review_id), FOREIGN KEY(company_id,review_id) REFERENCES appraisal_reviews(company_id,id)
);
CREATE TABLE IF NOT EXISTS appraisal_outcomes (
 company_id TEXT NOT NULL, review_id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
 PRIMARY KEY(company_id,review_id), FOREIGN KEY(company_id,review_id) REFERENCES appraisal_reviews(company_id,id)
);
CREATE TABLE IF NOT EXISTS appraisal_peer_assignments (
 company_id TEXT NOT NULL, review_id TEXT NOT NULL, user_id TEXT NOT NULL, submitted_at TEXT,
 PRIMARY KEY(company_id,review_id,user_id), FOREIGN KEY(company_id,review_id) REFERENCES appraisal_reviews(company_id,id),
 FOREIGN KEY(company_id,user_id) REFERENCES users(company_id,user_id)
);
CREATE TABLE IF NOT EXISTS appraisal_roles (
 company_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role='hr'),
 PRIMARY KEY(company_id,user_id), FOREIGN KEY(company_id,user_id) REFERENCES users(company_id,user_id)
);
CREATE TABLE IF NOT EXISTS appraisal_audit (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(company_id), entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL,
 before_data TEXT CHECK(before_data IS NULL OR json_valid(before_data)),
 after_data TEXT CHECK(after_data IS NULL OR json_valid(after_data)), created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS appraisal_audit_entity ON appraisal_audit(company_id,entity_type,entity_id,created_at);
CREATE TABLE IF NOT EXISTS appraisal_notifications (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL, recipient_id TEXT NOT NULL,
 review_id TEXT, title TEXT NOT NULL, event_key TEXT NOT NULL,
 unread INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
 UNIQUE(company_id,recipient_id,event_key), FOREIGN KEY(company_id,recipient_id) REFERENCES users(company_id,user_id)
);
CREATE INDEX IF NOT EXISTS appraisal_notification_recipient ON appraisal_notifications(company_id,recipient_id,created_at);
CREATE TABLE IF NOT EXISTS appraisal_payroll_changes (
 company_id TEXT NOT NULL, review_id TEXT NOT NULL, employee_id TEXT NOT NULL,
 effective_date TEXT NOT NULL, base_ctc REAL NOT NULL, revised_ctc REAL NOT NULL,
 bonus REAL NOT NULL DEFAULT 0, payload TEXT NOT NULL CHECK(json_valid(payload)), created_at TEXT NOT NULL,
 PRIMARY KEY(company_id,review_id), FOREIGN KEY(company_id,review_id) REFERENCES appraisal_reviews(company_id,id)
);
CREATE INDEX IF NOT EXISTS appraisal_payroll_employee ON appraisal_payroll_changes(company_id,employee_id,effective_date);
-- A transaction-local assertion row makes stale multi-table writes roll back as a unit.
CREATE TABLE IF NOT EXISTS appraisal_write_checks (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid=1));
