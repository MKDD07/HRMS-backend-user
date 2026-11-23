CREATE TABLE IF NOT EXISTS attendance_punch_evidence (
 company_id TEXT NOT NULL,
 attendance_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('punch_in','punch_out')),
 photo_key TEXT,
 latitude REAL,
 longitude REAL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(company_id,attendance_id,action),
 UNIQUE(company_id,photo_key),
 FOREIGN KEY(attendance_id) REFERENCES attendance(attendance_id)
);
