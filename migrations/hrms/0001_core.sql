CREATE TABLE companies (
 company_id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 settings TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(settings) AND json_type(settings)='object'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE users (
 user_id TEXT PRIMARY KEY NOT NULL,
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 username TEXT NOT NULL COLLATE NOCASE UNIQUE,
 email TEXT COLLATE NOCASE UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('company_admin','employee')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
 must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(company_id,user_id)
);
CREATE INDEX users_company ON users(company_id);
CREATE TABLE employees (
 employee_id TEXT PRIMARY KEY NOT NULL,
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 user_id TEXT NOT NULL UNIQUE,
 employee_code TEXT NOT NULL,
 first_name TEXT NOT NULL,
 last_name TEXT NOT NULL DEFAULT '',
 department TEXT NOT NULL DEFAULT '',
 designation TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive','OnLeave','Probation')),
 profile TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(profile) AND json_type(profile)='object'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(company_id,employee_id), UNIQUE(company_id,employee_code),
 FOREIGN KEY(company_id,user_id) REFERENCES users(company_id,user_id)
);
CREATE INDEX employees_directory ON employees(company_id,status,department);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 company_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 FOREIGN KEY(company_id,user_id) REFERENCES users(company_id,user_id)
);
CREATE INDEX sessions_user ON sessions(company_id,user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE company_calendar (
 company_id TEXT PRIMARY KEY NOT NULL REFERENCES companies(company_id),
 holidays TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(holidays) AND json_type(holidays)='array'),
 important_dates TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(important_dates) AND json_type(important_dates)='array'),
 leave_types TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(leave_types) AND json_type(leave_types)='array'),
 policy_groups TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(policy_groups) AND json_type(policy_groups)='array'),
 revision INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE company_calendar_assignments (
 company_id TEXT NOT NULL REFERENCES company_calendar(company_id),
 userid TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 PRIMARY KEY(company_id,userid),
 FOREIGN KEY(company_id,userid) REFERENCES users(company_id,user_id)
);
CREATE TABLE documents (
 document_id TEXT PRIMARY KEY NOT NULL,
 company_id TEXT NOT NULL REFERENCES companies(company_id),
 employee_id TEXT,
 title TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 content_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL CHECK(size_bytes>=0),
 metadata TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata) AND json_type(metadata)='object'),
 uploaded_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(company_id,employee_id) REFERENCES employees(company_id,employee_id),
 FOREIGN KEY(company_id,uploaded_by) REFERENCES users(company_id,user_id)
);
CREATE INDEX documents_owner ON documents(company_id,employee_id);
CREATE TABLE attendance (
 attendance_id TEXT PRIMARY KEY NOT NULL,
 company_id TEXT NOT NULL,
 employee_id TEXT NOT NULL,
 date TEXT NOT NULL,
 check_in_time TEXT NOT NULL,
 check_out_time TEXT,
 UNIQUE(company_id,employee_id,date),
 FOREIGN KEY(company_id,employee_id) REFERENCES employees(company_id,employee_id)
);
CREATE TABLE leave_requests (
 leave_id TEXT PRIMARY KEY NOT NULL,
 company_id TEXT NOT NULL,
 employee_id TEXT NOT NULL,
 leave_type TEXT NOT NULL,
 start_date TEXT NOT NULL,
 end_date TEXT NOT NULL CHECK(end_date>=start_date),
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
 reviewed_by TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(company_id,employee_id) REFERENCES employees(company_id,employee_id),
 FOREIGN KEY(company_id,reviewed_by) REFERENCES users(company_id,user_id)
);
CREATE INDEX leave_company ON leave_requests(company_id,employee_id,start_date);
CREATE TABLE payroll (
 payroll_id TEXT PRIMARY KEY NOT NULL,
 company_id TEXT NOT NULL,
 employee_id TEXT NOT NULL,
 period TEXT NOT NULL,
 gross_minor INTEGER NOT NULL CHECK(gross_minor>=0),
 deductions_minor INTEGER NOT NULL CHECK(deductions_minor>=0 AND deductions_minor<=gross_minor),
 currency TEXT NOT NULL DEFAULT 'INR',
 breakdown TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(breakdown) AND json_type(breakdown)='object'),
 status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Paid')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(company_id,employee_id,period),
 FOREIGN KEY(company_id,employee_id) REFERENCES employees(company_id,employee_id)
);
CREATE TABLE login_attempts (
 identifier_hash TEXT PRIMARY KEY NOT NULL,
 attempts INTEGER NOT NULL,
 window_start INTEGER NOT NULL
);
