-- Additive HR modules. Safe to apply repeatedly.
CREATE TABLE IF NOT EXISTS hr_expenses (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_expenses_updated ON hr_expenses(company_id,updated_at);

CREATE TABLE IF NOT EXISTS hr_review_cycles (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_review_cycles_updated ON hr_review_cycles(company_id,updated_at);

CREATE TABLE IF NOT EXISTS hr_appraisals (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_appraisals_updated ON hr_appraisals(company_id,updated_at);

CREATE TABLE IF NOT EXISTS hr_benefit_plans (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_benefit_plans_updated ON hr_benefit_plans(company_id,updated_at);

CREATE TABLE IF NOT EXISTS hr_benefit_enrollments (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_benefit_enrollments_updated ON hr_benefit_enrollments(company_id,updated_at);

CREATE TABLE IF NOT EXISTS hr_dependants (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_dependants_updated ON hr_dependants(company_id,updated_at);

CREATE TABLE IF NOT EXISTS hr_surveys (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_surveys_updated ON hr_surveys(company_id,updated_at);

CREATE TABLE IF NOT EXISTS hr_survey_responses (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_survey_responses_updated ON hr_survey_responses(company_id,updated_at);

CREATE TABLE IF NOT EXISTS hr_projects (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_projects_updated ON hr_projects(company_id,updated_at);

CREATE TABLE IF NOT EXISTS hr_timesheets (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_timesheets_updated ON hr_timesheets(company_id,updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS hr_appraisal_employee_cycle ON hr_appraisals(company_id,json_extract(payload,'$.cycle_id'),json_extract(payload,'$.employee_id'));
CREATE UNIQUE INDEX IF NOT EXISTS hr_survey_employee ON hr_survey_responses(company_id,json_extract(payload,'$.survey_id'),json_extract(payload,'$.employee_id'));
CREATE TABLE IF NOT EXISTS hr_expense_receipts (
 company_id TEXT NOT NULL,
 id TEXT NOT NULL,
 expense_id TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 filename TEXT NOT NULL,
 content_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id),
 FOREIGN KEY(company_id,expense_id) REFERENCES hr_expenses(company_id,id)
);
CREATE INDEX IF NOT EXISTS hr_receipts_expense ON hr_expense_receipts(company_id,expense_id);
CREATE TABLE IF NOT EXISTS hr_analytics_views (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 id TEXT NOT NULL,
 title TEXT NOT NULL,
 from_month TEXT NOT NULL,
 to_month TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(company_id,id)
);
