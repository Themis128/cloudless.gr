# Scripts Directory

This directory contains automation scripts for managing the Supabase development environment.

## Quick Start

### Essential Commands
```powershell
# Complete environment reset and setup
.\scripts\02-reset-and-seed.ps1

# Test all connectivity
.\scripts\12-test-connectivity.ps1

# Fix common analytics issue
.\scripts\21-fix-supabase-analytics.ps1
```

## Script Categories

### Setup & Configuration
- **01-setup-environment.ps1** - Initial environment setup
- **02-reset-and-seed.ps1** - Complete reset and seeding
- **16-generate-secrets.js** - Generate new JWT secrets and keys

### Database Management
- **03-create-database-tables.js** - Create database tables
- **04-setup-user-accounts.js** - Set up user accounts
- **06-check-database.js** - Database health check
- **07-seed-database.js** - Seed database with test data

### Testing & Verification
- **05-verify-setup.js** - Verify complete setup
- **11-test-authentication.js** - Test authentication flows
- **12-test-connectivity.ps1** - Comprehensive connectivity testing
- **13-show-access-points.js** - Display access points and URLs

### User Management
- **10-manage-users.js** - User management utilities

### Maintenance & Troubleshooting
- **18-emergency-restore.ps1** - Emergency recovery and restore
- **19-fix-line-endings.ps1** - Fix line ending issues
- **20-cleanup-temp-files.ps1** - Clean up temporary files
- **21-fix-supabase-analytics.ps1** - Fix analytics authentication issues

## Common Issues & Solutions

### Supabase Analytics Password Error
**Problem:** Analytics service fails with password authentication errors.
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
