CREATE TABLE IF NOT EXISTS talent_audit (
  company_id TEXT NOT NULL REFERENCES companies(company_id),
  id TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT CHECK(before_json IS NULL OR json_valid(before_json)),
  after_json TEXT NOT NULL CHECK(json_valid(after_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY(company_id, id)
);
CREATE INDEX IF NOT EXISTS talent_audit_record ON talent_audit(company_id, collection, record_id, created_at);
CREATE TABLE IF NOT EXISTS talent_domain_events (
  company_id TEXT NOT NULL REFERENCES companies(company_id),
  id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Processed','Failed')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(company_id,id)
);
CREATE INDEX IF NOT EXISTS talent_domain_events_pending ON talent_domain_events(status, created_at);
CREATE INDEX IF NOT EXISTS talent_recruitment_status ON talent_records(company_id,collection,json_extract(payload,'$.status'),created_at);
