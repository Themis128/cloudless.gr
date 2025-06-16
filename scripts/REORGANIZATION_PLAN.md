# Scripts Directory Organization Plan

## Core Setup Scripts (1-5)
1. `01-setup-environment.ps1` - Environment setup and validation
2. `02-reset-and-seed.ps1` - Complete reset with database seeding
3. `03-create-database-tables.js` - Create required database tables
4. `04-setup-user-accounts.js` - Setup test user accounts
5. `05-verify-setup.js` - Comprehensive setup verification

## Database Management Scripts (6-10)
6. `06-check-database.js` - Database connectivity and structure check
7. `07-seed-database.js` - Database seeding only
8. `08-backup-database.sql` - Database backup queries
9. `09-reset-database.ps1` - Database reset only
10. `10-manage-users.js` - User management utilities

## Development Scripts (11-15)
11. `11-test-authentication.js` - Authentication testing
12. `12-test-connectivity.ps1` - Service connectivity testing
13. `13-show-access-points.js` - Display all access points
14. `14-debug-issues.js` - Issue debugging and troubleshooting
15. `15-fix-common-problems.ps1` - Common problem fixes

## Utility Scripts (16-20)
16. `16-generate-secrets.js` - Generate JWT secrets and keys
17. `17-apply-migrations.ps1` - Apply database migrations
18. `18-emergency-restore.ps1` - Emergency recovery procedures
19. `19-line-ending-fixes.ps1` - Fix line ending issues
20. `20-cleanup-temp-files.ps1` - Cleanup temporary files

## Scripts to Remove (Obsolete/Broken)
- add-themis-admin.ps1 (specific user, superseded)
- add-themis-admin.sql (specific user, superseded)
- add-themis-as-admin.js (specific user, superseded)
- add-themis-as-user.js (specific user, superseded)
- add-themis-user.ps1 (specific user, superseded)
- add-themis-user.sql (specific user, superseded)
- create-tables-direct.js (superseded by better version)
- direct-database-setup.js (superseded by better version)
- fix-auth-system.js (superseded by reset script)
- fix-auth-system.ps1 (superseded by reset script)
- insert-user-data.sql (superseded by JS scripts)
- test-and-create-tables.js (superseded by combined script)
- user-troubleshooter.js (merged into debug script)
- verify-user-data.sql (superseded by JS scripts)

## Scripts to Merge
- Merge: debug-user-login.js + verify-user-setup.js → 11-test-authentication.js
- Merge: show-access-points.js + test-studio-access.js → 13-show-access-points.js
- Merge: add-admin.js + add-admin-simple.js + add-user.js → 10-manage-users.js
- Merge: reset-and-seed.ps1 + reset-and-seed-v2.ps1 + reset-and-seed-fast.ps1 → 02-reset-and-seed.ps1
- Merge: check-database.js + setup-database.js → 06-check-database.js
