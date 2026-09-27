# Dashboard users, settings and shifts

Migration `0006_dashboard_access.sql` adds `employees.dashboard_access` (0/1), `employees.dashboard_pages` (JSON array), and `dashboard_configuration`. Both insert and update triggers enforce the limit of three employee-linked dashboard users per company. The existing company administrator is excluded. No new accounts or passwords are seeded.

The Super Admin uses **Dashboard Users** to select an existing employee, change their login ID, set a temporary password, and check permitted pages. Login credentials belong to the existing employee account. A password reset always requires a change before console access. Every access update revokes that employee's sessions. Passwords use the existing salted PBKDF2 hashing; they are never returned from the API.

Delegated accounts retain the employee database role. The Worker checks page permissions before granting request-scoped administrative access to explicitly mapped routes. Unmapped routes fail closed. User management is Super Admin only. The frontend filters navigation, guards page rendering, and revalidates sessions every 30 seconds. Shared employee pickers receive a limited directory response unless the employee-directory page itself is granted. Dashboard metrics and attendance screens necessarily share some attendance/leave data.

`GET/POST /api/v1/dashboard-users` is Super Admin only. `GET/POST /api/v1/dashboard-configuration/:section` loads/saves company shifts or contact settings with optimistic revisions. Reads expose non-sensitive shift/contact configuration; writes require the corresponding page permission.

Settings and Shifts are separate pages styled like the Tenant Admin Console. Shifts start empty and offer editable office, early, and overnight templates. Profiles persist in D1; a company-keyed browser cache supports existing shift readers. These profiles do not by themselves assign employee rosters or implement punch enforcement. Geofence templates populate the existing site editor and require real coordinates; the existing geofence store remains browser-local.

The legacy non-company-scoped Express endpoints and payslip-template management remain Super Admin only. Delegated payroll permissions cover company-scoped salary routes; they do not unlock the legacy payslip studio. Onboarding, offboarding and learning are existing navigation placeholders without implemented pages and therefore are not offered as delegated permissions.

The migration has been applied to the configured remote D1 database. Restart the local Express gateway to use the new code. Production requires the updated Worker and frontend to be deployed. No production deployment or employee access grant is performed automatically.

Validation: Worker integration tests cover first-login enforcement, page denial, tenant isolation, concurrent three-user limits, revocation, and configuration conflicts. `npm run lint`, `npm run build`, payroll tests and geofence-store tests are also run.
