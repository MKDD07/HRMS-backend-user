CREATE TABLE IF NOT EXISTS company_holiday_cache (
  company_id TEXT NOT NULL,
  country TEXT NOT NULL,
  year INTEGER NOT NULL,
  holidays TEXT CHECK(holidays IS NULL OR (json_valid(holidays) AND json_type(holidays)='array')),
  fetched_at TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(company_id, country, year)
);
