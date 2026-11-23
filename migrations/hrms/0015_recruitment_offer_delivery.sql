-- Offer links retain only a token hash. Delivery snapshots contain no credential.
CREATE TABLE recruitment_offer_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(company_id),
  offer_id TEXT NOT NULL,
  collection TEXT NOT NULL DEFAULT 'offers' CHECK(collection='offers'),
  token_hash TEXT NOT NULL UNIQUE,
  snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
  status TEXT NOT NULL DEFAULT 'Prepared' CHECK(status IN ('Prepared','Sent')),
  provider_id TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  UNIQUE(company_id,offer_id),
  FOREIGN KEY(company_id,collection,offer_id) REFERENCES talent_records(company_id,collection,id)
);
CREATE INDEX talent_offer_expiry ON talent_records(json_extract(payload,'$.status'),json_extract(payload,'$.valid_until'),updated_at) WHERE collection='offers';
CREATE INDEX talent_offer_application_status ON talent_records(company_id,json_extract(payload,'$.candidate_id'),json_extract(payload,'$.status')) WHERE collection='offers';
CREATE INDEX talent_candidate_job_status ON talent_records(company_id,json_extract(payload,'$.job_id'),json_extract(payload,'$.status')) WHERE collection='candidates';
