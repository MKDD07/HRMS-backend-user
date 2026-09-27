CREATE TABLE IF NOT EXISTS talent_records (
  company_id TEXT NOT NULL REFERENCES companies(company_id),
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload) AND json_type(payload)='object'),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(company_id, collection, id)
);
CREATE INDEX IF NOT EXISTS talent_records_updated ON talent_records(company_id, collection, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS talent_asset_serial ON talent_records(company_id, lower(json_extract(payload,'$.serial_number'))) WHERE collection='assets';
CREATE UNIQUE INDEX IF NOT EXISTS talent_candidate_job_email ON talent_records(company_id, json_extract(payload,'$.job_id'), lower(json_extract(payload,'$.email'))) WHERE collection='candidates';
CREATE UNIQUE INDEX IF NOT EXISTS talent_course_employee ON talent_records(company_id, json_extract(payload,'$.course_id'), json_extract(payload,'$.employee_id')) WHERE collection='enrollments';
