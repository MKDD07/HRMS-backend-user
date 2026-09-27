CREATE TABLE workflow_configuration (
 company_id TEXT PRIMARY KEY REFERENCES companies(company_id),
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
CREATE TABLE workflow_requests (
 request_id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 requester_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('leave','attendance','expense','other')),
 source_id TEXT,
 status TEXT NOT NULL CHECK(status IN ('Pending','Approved','Rejected','Blocked')),
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 route TEXT NOT NULL CHECK(json_valid(route)),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(company_id,kind,source_id),
 FOREIGN KEY(company_id,requester_id) REFERENCES users(company_id,user_id)
);
CREATE INDEX workflow_requests_company ON workflow_requests(company_id,status,created_at);
CREATE TABLE workflow_notifications (
 notification_id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL,
 recipient_id TEXT NOT NULL,
 request_id TEXT NOT NULL REFERENCES workflow_requests(request_id),
 title TEXT NOT NULL,
 unread INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 FOREIGN KEY(company_id,recipient_id) REFERENCES users(company_id,user_id)
);
CREATE INDEX workflow_notifications_recipient ON workflow_notifications(company_id,recipient_id,created_at);
CREATE TABLE workflow_audit (
 audit_id TEXT PRIMARY KEY,
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 request_id TEXT,
 actor_id TEXT,
 action TEXT NOT NULL,
 details TEXT NOT NULL CHECK(json_valid(details)),
 created_at TEXT NOT NULL
);
CREATE INDEX workflow_audit_company ON workflow_audit(company_id,created_at);
