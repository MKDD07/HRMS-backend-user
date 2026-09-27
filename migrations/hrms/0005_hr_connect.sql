CREATE TABLE hr_connect (
 id TEXT PRIMARY KEY NOT NULL,
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 kind TEXT NOT NULL CHECK(kind IN ('announcement','message','email','grievance')),
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 status TEXT NOT NULL,
 audience TEXT NOT NULL DEFAULT 'All employees',
 recipients TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(recipients)),
 priority TEXT NOT NULL DEFAULT 'Normal',
 requester_id TEXT,
 author_id TEXT NOT NULL,
 history TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(history)),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 FOREIGN KEY(company_id,author_id) REFERENCES users(company_id,user_id)
);
CREATE INDEX hr_connect_company ON hr_connect(company_id,updated_at);
