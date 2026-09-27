ALTER TABLE companies ADD COLUMN employee_prefix TEXT COLLATE NOCASE;
ALTER TABLE companies ADD COLUMN next_employee_number INTEGER NOT NULL DEFAULT 1 CHECK(next_employee_number>=1);
CREATE UNIQUE INDEX companies_employee_prefix ON companies(employee_prefix);
