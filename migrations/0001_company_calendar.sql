-- Creates calendar storage only; does not import or delete existing production data.
CREATE TABLE IF NOT EXISTS company_calendar (
    company_id TEXT PRIMARY KEY NOT NULL,
    holidays TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(holidays) AND json_type(holidays)='array'),
    important_dates TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(important_dates) AND json_type(important_dates)='array'),
    leave_types TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(leave_types) AND json_type(leave_types)='array'),
    policy_groups TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(policy_groups) AND json_type(policy_groups)='array'),
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE IF NOT EXISTS company_calendar_assignments (
    company_id TEXT NOT NULL, userid TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
    PRIMARY KEY(company_id, userid),
    FOREIGN KEY(company_id) REFERENCES company_calendar(company_id)
  );
