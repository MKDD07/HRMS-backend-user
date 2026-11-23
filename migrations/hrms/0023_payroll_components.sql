CREATE TABLE IF NOT EXISTS payroll_components (
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  PRIMARY KEY(company_id,user_id,id),
  FOREIGN KEY(company_id,user_id) REFERENCES users(company_id,user_id)
);
