Employee punch-in and punch-out use employees.profile.attendance_rule and company geofence_sites. A paused or unassigned rule permits direct punches. Active rules enforce photo_required and the assigned custom/group perimeter on both actions. Group is_unrestricted disables only the perimeter. The server computes the attendance date in IST and closes overnight records on their original date.

Routes: GET /api/v1/attendance-policy, GET /api/v1/getTodaysAttendance, POST /api/v1/user-attendance, POST /api/v1/attendance/upload-image. Existing POST /api/v1/attendance also enforces the same policy. Photos are private to the authenticated employee through GET /api/v1/attendance/photo?key=... . Uploads use the configured HRMS_IMAGES binding. A fresh stored photo is required for each photo punch.

Before deploying, apply migrations/hrms/0016_attendance_punch_evidence.sql:
npx wrangler d1 migrations apply hrms-db --remote --config wrangler.company.toml
npx wrangler deploy --config wrangler.company.toml

Regression check: node worker/punch.test.mjs
