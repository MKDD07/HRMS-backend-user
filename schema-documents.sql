-- ============================================================================
-- CLOUDFLARE D1 SQL SCHEMA: DOCUMENT VAULT & POLICIES
-- Target D1 Database ID: 05b74cd6-9516-4b8c-ac3a-d0d99d09029f
-- ============================================================================

-- Table 1: Company Policies & Standard Operating Procedures
CREATE TABLE IF NOT EXISTS company_policies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Compliance', 'Benefits & Health', 'Security & Geofence', 'Tax & Payroll', 'Code of Conduct'
  version TEXT DEFAULT '1.0',
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size TEXT NOT NULL,
  format TEXT DEFAULT 'PDF',
  effective_date DATE NOT NULL,
  mandatory_acknowledgement INTEGER DEFAULT 1,
  uploaded_by TEXT DEFAULT 'HR Legal Operations',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: Employee Personnel Documents (Identity, Tax, Contracts, Appraisals)
CREATE TABLE IF NOT EXISTS employee_documents (
  id TEXT PRIMARY KEY,
  userid TEXT NOT NULL,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL, -- 'ID Proof', 'Tax Form', 'Employment Contract', 'Education & Degree', 'Appraisal & Letter'
  document_number TEXT,   -- Masked identification number (e.g., 'XXXX-XXXX-4921')
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size TEXT NOT NULL,
  format TEXT DEFAULT 'PDF',
  verified INTEGER DEFAULT 1, -- 1 = Verified, 0 = Pending Review
  verified_by TEXT,
  verified_at DATETIME,
  uploaded_by TEXT DEFAULT 'HR Admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast querying
CREATE INDEX IF NOT EXISTS idx_emp_docs_userid ON employee_documents(userid);
CREATE INDEX IF NOT EXISTS idx_emp_docs_type ON employee_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_policies_cat ON company_policies(category);

-- ----------------------------------------------------------------------------
-- SEED DATA: Company Policies
-- ----------------------------------------------------------------------------
INSERT OR IGNORE INTO company_policies (id, title, category, version, description, file_url, file_name, file_size, format, effective_date, mandatory_acknowledgement, uploaded_by) VALUES
('pol-01', 'PulseHRMS Code of Business Conduct & Ethics 2026', 'Code of Conduct', '2.4', 'Enterprise rules governing ethics, anti-corruption, conflict of interest, and workplace conduct.', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/policies/code_of_conduct_2026.pdf', 'code_of_conduct_2026.pdf', '2.4 MB', 'PDF', '2026-01-01', 1, 'Priyanka Chopra'),
('pol-02', 'Group Health & Medical Insurance Schedule FY26-27', 'Benefits & Health', '1.2', 'Complete coverage breakdown for employee and family hospitalization benefits under ICICI Lombard.', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/policies/health_insurance_fy26.pdf', 'health_insurance_fy26.pdf', '1.8 MB', 'PDF', '2026-04-01', 0, 'HR Operations'),
('pol-03', 'Campus Geofence & Biometric Attendance Directive', 'Security & Geofence', '3.0', 'Mandatory 100m geofence rules, facial recognition clock-in compliance, and grace period guidelines.', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/policies/geofence_attendance_directive.pdf', 'geofence_attendance_directive.pdf', '980 KB', 'PDF', '2026-02-15', 1, 'Mohit Kataria'),
('pol-04', 'Statutory Income Tax & Investment Declaration Guide', 'Tax & Payroll', '2026.1', 'Guidelines for Old vs New tax regimes, Section 80C/80D proofs, and HRA exemption declaration.', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/policies/tax_declaration_guidelines_2026.pdf', 'tax_declaration_guidelines_2026.pdf', '1.5 MB', 'PDF', '2026-04-01', 1, 'Finance & Accounts'),
('pol-05', 'Information Security & Cloud Infrastructure Protocol', 'Compliance', '4.1', 'ISO/IEC 27001 guidelines for zero-trust cloud keys, hardware security keys, and code repositories.', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/policies/infosec_cloud_protocol_v4.pdf', 'infosec_cloud_protocol_v4.pdf', '3.1 MB', 'PDF', '2026-01-10', 1, 'Mohit Kataria'),
('pol-06', 'Prevention of Sexual Harassment (POSH) Policy', 'Code of Conduct', '2.0', 'Zero-tolerance policy on workplace harassment, internal committee contacts, and redressal mechanisms.', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/policies/posh_handbook_2026.pdf', 'posh_handbook_2026.pdf', '1.1 MB', 'PDF', '2026-01-01', 1, 'Priyanka Chopra');

-- ----------------------------------------------------------------------------
-- SEED DATA: Employee Documents (Mohit Kataria, Rajesh Sharma, Priyanka Chopra, Ananya Deshmukh)
-- ----------------------------------------------------------------------------
INSERT OR IGNORE INTO employee_documents (id, userid, title, doc_type, document_number, file_url, file_name, file_size, format, verified, verified_by, verified_at, uploaded_by) VALUES
-- Mohit Kataria (TYS-1021)
('doc-1021-01', 'TYS-1021', 'National Identity (Aadhaar Card)', 'ID Proof', 'XXXX-XXXX-8921', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1021/aadhaar_verified.pdf', 'aadhaar_card_m_kataria.pdf', '1.2 MB', 'PDF', 1, 'Priyanka Chopra', '2026-01-16 10:30:00', 'Mohit Kataria'),
('doc-1021-02', 'TYS-1021', 'Permanent Account Number (PAN Card)', 'ID Proof', 'ABCDE1234F', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1021/pan_card_verified.pdf', 'pan_card_m_kataria.pdf', '650 KB', 'PDF', 1, 'Priyanka Chopra', '2026-01-16 10:35:00', 'Mohit Kataria'),
('doc-1021-03', 'TYS-1021', 'Signed Executive Employment Contract & NDA', 'Employment Contract', 'CTR-2023-1021', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1021/executive_contract.pdf', 'executive_employment_agreement.pdf', '3.4 MB', 'PDF', 1, 'Board of Directors', '2023-01-15 09:00:00', 'HR Legal'),
('doc-1021-04', 'TYS-1021', 'Form 16 Tax Certificate (FY 2025-26)', 'Tax Form', 'F16-2026-1021', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1021/form_16_fy26.pdf', 'form_16_part_a_b_1021.pdf', '2.1 MB', 'PDF', 1, 'Finance & Accounts', '2026-05-15 14:20:00', 'Corporate Payroll'),
('doc-1021-05', 'TYS-1021', 'Master of Technology in Computer Systems Degree', 'Education & Degree', 'IITB-CS-2016-89', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1021/mtech_degree.pdf', 'mtech_degree_certificate.pdf', '2.8 MB', 'PDF', 1, 'Priyanka Chopra', '2023-01-18 11:00:00', 'Mohit Kataria'),

-- Rajesh Sharma (TYS-1008)
('doc-1008-01', 'TYS-1008', 'National Identity (Aadhaar Card)', 'ID Proof', 'XXXX-XXXX-3341', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1008/aadhaar.pdf', 'aadhaar_sharma_r.pdf', '1.1 MB', 'PDF', 1, 'Priyanka Chopra', '2022-05-12 11:20:00', 'Rajesh Sharma'),
('doc-1008-02', 'TYS-1008', 'Permanent Account Number (PAN Card)', 'ID Proof', 'BGTPR4492K', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1008/pan.pdf', 'pan_card_r_sharma.pdf', '720 KB', 'PDF', 1, 'Priyanka Chopra', '2022-05-12 11:25:00', 'Rajesh Sharma'),
('doc-1008-03', 'TYS-1008', 'Director Appointment Letter & Stock Option Grant', 'Employment Contract', 'CTR-2022-1008', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1008/appointment_esop.pdf', 'appointment_esop_grant.pdf', '4.2 MB', 'PDF', 1, 'Mohit Kataria', '2022-05-10 10:00:00', 'HR Legal'),
('doc-1008-04', 'TYS-1008', 'Form 16 Tax Certificate (FY 2025-26)', 'Tax Form', 'F16-2026-1008', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1008/form_16.pdf', 'form_16_fy26_1008.pdf', '1.9 MB', 'PDF', 1, 'Finance & Accounts', '2026-05-15 14:25:00', 'Corporate Payroll'),

-- Priyanka Chopra (TYS-1003)
('doc-1003-01', 'TYS-1003', 'National Identity (Aadhaar Card)', 'ID Proof', 'XXXX-XXXX-9902', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1003/aadhaar.pdf', 'aadhaar_p_chopra.pdf', '980 KB', 'PDF', 1, 'Mohit Kataria', '2022-08-03 14:00:00', 'Priyanka Chopra'),
('doc-1003-02', 'TYS-1003', 'Permanent Account Number (PAN Card)', 'ID Proof', 'CPKPR8812L', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1003/pan.pdf', 'pan_card_p_chopra.pdf', '590 KB', 'PDF', 1, 'Mohit Kataria', '2022-08-03 14:05:00', 'Priyanka Chopra'),
('doc-1003-03', 'TYS-1003', 'Head of People Operations Contract & NDA', 'Employment Contract', 'CTR-2022-1003', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1003/employment_agreement.pdf', 'employment_agreement_chopra.pdf', '2.9 MB', 'PDF', 1, 'Mohit Kataria', '2022-08-01 10:00:00', 'HR Legal'),
('doc-1003-04', 'TYS-1003', 'MBA in Human Resources Certificate', 'Education & Degree', 'XLRI-HR-2020-11', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1003/xlri_degree.pdf', 'xlri_mba_degree.pdf', '3.1 MB', 'PDF', 1, 'Mohit Kataria', '2022-08-05 09:30:00', 'Priyanka Chopra'),

-- Ananya Deshmukh (TYS-1005)
('doc-1005-01', 'TYS-1005', 'National Identity (Passport & Aadhaar)', 'ID Proof', 'XXXX-XXXX-5521', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1005/passport_aadhaar.pdf', 'passport_aadhaar_ananya.pdf', '1.7 MB', 'PDF', 1, 'Priyanka Chopra', '2023-03-22 15:30:00', 'Ananya Deshmukh'),
('doc-1005-02', 'TYS-1005', 'Lead Mobile & Flutter Engineer Offer Letter', 'Employment Contract', 'CTR-2023-1005', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1005/signed_offer_letter.pdf', 'signed_offer_letter_1005.pdf', '2.6 MB', 'PDF', 1, 'Priyanka Chopra', '2023-03-20 12:00:00', 'HR Legal'),
('doc-1005-03', 'TYS-1005', 'B.Tech in Computer Engineering Degree', 'Education & Degree', 'VJTI-CE-2021-44', 'https://hrms-api.mkmkataria07.workers.dev/storage/documents/personnel/TYS-1005/btech_certificate.pdf', 'btech_certificate_ananya.pdf', '2.2 MB', 'PDF', 1, 'Priyanka Chopra', '2023-03-24 16:00:00', 'Ananya Deshmukh');
