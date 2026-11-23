CREATE TABLE IF NOT EXISTS signin_activity (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('login','logout')),
  occurred_at TEXT NOT NULL,
  FOREIGN KEY(company_id,user_id) REFERENCES users(company_id,user_id)
);
CREATE INDEX IF NOT EXISTS signin_activity_company_time ON signin_activity(company_id,occurred_at DESC);
