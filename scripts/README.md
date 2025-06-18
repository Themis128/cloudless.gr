# Scripts Directory

This directory contains automation scripts for managing the Supabase development environment, organized into logical categories for better maintainability.

## 📁 Directory Structure

```
scripts/
├── 01-setup-configuration/     # Environment setup and configuration
├── 02-database-management/     # Database operations, sync, and migration
├── 03-user-management/         # User backup, restore, and management
├── 04-testing-verification/    # Testing scripts and verification
├── 05-maintenance-utilities/   # System maintenance and troubleshooting
└── 06-legacy-unused/          # Deprecated scripts (kept for reference)
```

## 🚀 Quick Start

### Essential Commands

```powershell
# Complete environment reset and setup
.\scripts\02-database-management\reset-and-seed-enhanced.ps1

# User-safe reset (preserves users)
.\scripts\03-user-management\user-safe-reset.ps1

# Test all connectivity
.\scripts\04-testing-verification\test-connectivity.ps1

# Backup users before major changes
.\scripts\03-user-management\backup-users.ps1
```

## 📂 Script Categories

### 01-setup-configuration/

**Environment setup and configuration management**

- **pgadmin-connection-info.ps1** - Display pgAdmin connection details
- **pgadmin-enhanced.ps1** - Enhanced pgAdmin setup and management
- **pgadmin-manual-setup.ps1** - Manual pgAdmin server setup guide
- **update-pgladmin-servers.ps1** - Update pgAdmin server configurations

### 02-database-management/

**Database operations, synchronization, and migrations**

- **db-admin.ps1** - Database administration management
- **reset-supabase-fixed.ps1** - Enhanced Supabase reset (IPv6 compatible)
- **reset-and-seed-enhanced.ps1** - Complete reset and seed with test data
- **sync-supabase.ps1** - Sync cloud data to local Docker instance
- **sync-comprehensive.ps1** - Complete data synchronization
- **sync-auth-users.ps1** - Sync auth users from cloud to local
- **sync-docker-commands.ps1** - Direct Docker database sync commands
- **cloud_auth_users.sql** - Cloud auth users schema
- **cloud_schema.sql** - Cloud database schema
- **sync-cloud-db.sh** - Shell script for cloud database sync

### 03-user-management/

**User backup, restore, and management utilities**

- **user-safe-reset.ps1** - Complete user-safe reset (preserves existing users)
- **backup-users.ps1** - Advanced user backup and restore
- **simple-backup.ps1** - Simple and reliable user backup
- **10-manage-users.js** - User management utilities

### 04-testing-verification/

**Testing scripts and system verification**

- **test-connectivity.ps1** - Comprehensive connectivity testing
- **test-authentication.js** - Test authentication flows
- **verify-setup.js** - Verify complete setup
- **check-database.js** - Database health check
- **show-access-points.js** - Display access points and URLs
- **test-\*.js** - Various authentication and functionality tests
- **test-\*.mjs** - Modern JavaScript test modules
- **check-\*.js** - System check utilities
- **test-db-schema.sh** - Database schema testing

### 05-maintenance-utilities/

**System maintenance and troubleshooting**

- **connection-fix.ps1** - IPv6 connectivity fix for Supabase
- **fix-ipv6-connection.ps1** - Multiple IPv6 connection solutions
- **security-analysis.mjs** - Security analysis and reporting
- **fix-profile-policy.sql** - Profile policy fixes
- **fix-admin-policies.sql** - Admin policy corrections
- **cleanup-temp-files.ps1** - Clean up temporary files
- **fix-line-endings.ps1** - Fix line ending issues
- **emergency-restore.ps1** - Emergency recovery and restore

### 06-legacy-unused/

**Deprecated scripts kept for reference**

- Contains older scripts that may have historical value but are no longer actively used
  **Solution:**

```powershell
.\scripts\21-fix-supabase-analytics.ps1
```

### Services Won't Start

**Problem:** Containers fail to start or stay running.
**Solution:**

```powershell
.\scripts\02-reset-and-seed.ps1 -Force
```

### Connection Issues

**Problem:** Cannot connect to services.
**Solution:**

```powershell
.\scripts\12-test-connectivity.ps1 -Verbose
```

## Script Options

### Common Parameters

- `-Force` - Skip confirmation prompts
- `-Verbose` - Detailed output
- `-Quick` - Fast mode with minimal checks
- `-DiagnoseOnly` - Check issues without fixing

### Examples

```powershell
# Quick reset without prompts
.\scripts\02-reset-and-seed.ps1 -Force -Quick

# Verbose connectivity test
.\scripts\12-test-connectivity.ps1 -Verbose

# Diagnose analytics issue only
.\scripts\21-fix-supabase-analytics.ps1 -DiagnoseOnly
```

## Troubleshooting

For detailed troubleshooting information, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

### Quick Diagnosis

```powershell
# Check environment
.\scripts\02-reset-and-seed.ps1 -ValidateOnly

# Test connectivity
.\scripts\12-test-connectivity.ps1

# Check for common issues
.\scripts\21-fix-supabase-analytics.ps1 -DiagnoseOnly
```

### Recovery Operations

```powershell
# Complete reset
.\scripts\02-reset-and-seed.ps1

# Emergency restore
.\scripts\18-emergency-restore.ps1

# Fix specific analytics issue
.\scripts\21-fix-supabase-analytics.ps1
```

## Log Files

Most scripts generate log files in the `logs/` directory:

- `logs/supabase-analytics-fix-YYYYMMDD-HHMMSS.log`
- `logs/emergency-restore-YYYYMMDD-HHMMSS.log`
- `logs/reset-and-seed-YYYYMMDD-HHMMSS.log`

## Access Points

After successful setup, you can access:

- **Supabase Studio**: http://localhost:54323
- **API Gateway**: http://localhost:8000
- **Analytics**: http://localhost:4000
- **Database**: localhost:5432

## Development Workflow

### Initial Setup

1. Run `.\scripts\01-setup-environment.ps1`
2. Run `.\scripts\02-reset-and-seed.ps1`
3. Verify with `.\scripts\12-test-connectivity.ps1`

### Daily Development

1. Start services: `docker compose up -d` (from docker directory)
2. Check status: `.\scripts\12-test-connectivity.ps1 -Quick`
3. If issues: `.\scripts\21-fix-supabase-analytics.ps1` (for analytics issues)

### Reset/Recovery

1. Complete reset: `.\scripts\02-reset-and-seed.ps1`
2. Emergency recovery: `.\scripts\18-emergency-restore.ps1`
3. Specific fixes: Use appropriate numbered script

## Script Development

### Adding New Scripts

- Follow the numbering convention
- Include parameter validation
- Add logging capabilities
- Include help/usage information
- Update this README

### Testing Scripts

- Test with various parameter combinations
- Test error conditions
- Verify cleanup on interruption
- Check cross-platform compatibility

## Support

For issues not covered by the automated scripts:

1. Check `TROUBLESHOOTING.md`
2. Review log files in `logs/` directory
3. Run diagnostic scripts with `-Verbose` flag
4. Check Docker logs: `docker compose logs -f`
