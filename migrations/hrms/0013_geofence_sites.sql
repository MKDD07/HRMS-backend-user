CREATE TABLE IF NOT EXISTS geofence_sites (
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 group_id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(company_id,group_id)
);
