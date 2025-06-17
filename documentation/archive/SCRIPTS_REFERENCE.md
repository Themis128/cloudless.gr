# Scripts Directory - Reorganized Structure

This directory contains numbered scripts that should be run in order for proper setup and maintenance of the Nuxt/Supabase development environment.

## 🚀 Quick Start

For a complete setup from scratch:
```bash
# 1. Setup environment
.\scripts\01-setup-environment.ps1

# 2. Reset and seed database
.\scripts\02-reset-and-seed.ps1

# 3. Verify everything is working
node scripts\05-verify-setup.js
```

## 📋 Complete Scripts Reference

### Core Setup Scripts (Run in Order)

#### `01-setup-environment.ps1`
**Environment Setup and Validation**
- Sets up development environment
- Validates system requirements
- Creates necessary directories
- Configures environment variables
- Tests Docker connectivity

```bash
# Usage examples:
.\scripts\01-setup-environment.ps1              # Full setup
.\scripts\01-setup-environment.ps1 -CheckOnly  # Validation only
.\scripts\01-setup-environment.ps1 -Force      # Skip prompts
```

#### `02-reset-and-seed.ps1`
**Complete Environment Reset and Database Seeding**
- Stops and resets Docker containers
- Fixes line ending issues
- Resets database with fresh data
- Creates test user accounts
- Comprehensive environment restoration

```bash
# Usage examples:
.\scripts\02-reset-and-seed.ps1                    # Full reset with seeding
.\scripts\02-reset-and-seed.ps1 -SkipSeed         # Reset without seeding
.\scripts\02-reset-and-seed.ps1 -Quick            # Quick mode
.\scripts\02-reset-and-seed.ps1 -ValidateOnly     # Environment validation only
```

#### `03-create-database-tables.js`
**Database Table Creation and Setup**
- Creates required database tables
- Sets up Row Level Security (RLS)
- Configures table relationships
- Establishes proper permissions

```bash
# Usage examples:
node scripts/03-create-database-tables.js          # Create all tables
node scripts/03-create-database-tables.js --force  # Force recreation
```

#### `04-setup-user-accounts.js`
**User Account Creation and Management**
- Creates admin and test user accounts
- Sets up user profiles and extended info
- Configures user roles and permissions
- Provides interactive user creation

```bash
# Usage examples:
node scripts/04-setup-user-accounts.js                    # Interactive setup
node scripts/04-setup-user-accounts.js --admin           # Admin accounts only
node scripts/04-setup-user-accounts.js --batch           # Batch create defaults
```

#### `05-verify-setup.js`
**Comprehensive Setup Verification**
- Tests all environment components
- Verifies database connectivity
- Checks authentication system
- Tests API endpoints
- Generates health report

```bash
# Usage examples:
node scripts/05-verify-setup.js                # Full verification
node scripts/05-verify-setup.js --quick       # Essential checks only
node scripts/05-verify-setup.js --verbose     # Detailed output
```

### Database Management Scripts

#### `06-check-database.js`
**Database Health Check and Structure Verification**
- Tests database connectivity
- Verifies table structure
- Checks permissions
- Creates missing tables automatically
- Comprehensive database diagnostics

```bash
# Usage examples:
node scripts/06-check-database.js                # Full check and setup
node scripts/06-check-database.js --check-only   # Check only, no creation
node scripts/06-check-database.js --create-only  # Create missing only
```

#### `07-seed-database.js`
**Database Seeding with Test Data**
- Seeds database with test users
- Creates sample data
- Sets up admin accounts
- Configures user profiles
- Verifies seeded data

```bash
# Usage examples:
node scripts/07-seed-database.js                    # Full seeding
node scripts/07-seed-database.js --admin-only      # Admin users only
node scripts/07-seed-database.js --clear-first     # Clear existing data first
```

### User Management Scripts

#### `10-manage-users.js`
**User Management Operations**
- Add, remove, and modify users
- Change user roles
- Reset passwords
- View user information
- Bulk user operations

```bash
# Usage examples:
node scripts/10-manage-users.js                # Interactive management
node scripts/10-manage-users.js --list        # List all users
node scripts/10-manage-users.js --add-admin   # Add admin user
```

### Testing and Development Scripts

#### `11-test-authentication.js`
**Authentication System Testing**
- Tests user login/logout
- Verifies JWT token handling
- Checks role-based access
- Tests password reset
- Comprehensive auth testing

```bash
# Usage examples:
node scripts/11-test-authentication.js              # Full auth testing
node scripts/11-test-authentication.js --quick     # Basic tests only
node scripts/11-test-authentication.js --user-only # User auth only
```

#### `12-test-connectivity.ps1`
**Service Connectivity Testing**
- Tests Docker container status
- Checks port availability
- Verifies service endpoints
- Tests API connectivity
- Generates connectivity report

```bash
# Usage examples:
.\scripts\12-test-connectivity.ps1              # Full connectivity test
.\scripts\12-test-connectivity.ps1 -Quick      # Essential tests only
.\scripts\12-test-connectivity.ps1 -Verbose    # Detailed output
```

#### `13-show-access-points.js`
**Display All Access Points and Endpoints**
- Shows all service URLs
- Displays API endpoints
- Lists database connection info
- Shows admin interfaces
- Provides quick access links

```bash
# Usage examples:
node scripts/13-show-access-points.js              # Show all access points
node scripts/13-show-access-points.js --urls-only  # URLs only
node scripts/13-show-access-points.js --test      # Test accessibility
```

### Utility Scripts

#### `16-generate-secrets.js`
**JWT Secrets and Keys Generation**
- Generates secure JWT secrets
- Creates API keys
- Generates database passwords
- Creates encryption keys
- Updates environment files

```bash
# Usage examples:
node scripts/16-generate-secrets.js                    # Generate all secrets
node scripts/16-generate-secrets.js --jwt-only        # JWT secrets only
node scripts/16-generate-secrets.js --update-env      # Update .env file
```

#### `18-emergency-restore.ps1`
**Emergency Recovery and Restore**
- Emergency environment recovery
- Restores from backup
- Fixes common issues
- Rebuilds Docker environment
- Comprehensive restoration

```bash
# Usage examples:
.\scripts\18-emergency-restore.ps1                    # Full recovery
.\scripts\18-emergency-restore.ps1 -Force           # No prompts
.\scripts\18-emergency-restore.ps1 -BackupFirst     # Create backup first
```

#### `19-fix-line-endings.ps1`
**Line Endings Repair**
- Fixes cross-platform line ending issues
- Prevents Docker/Supabase parsing errors
- Bulk file processing
- Creates backups before changes
- Supports multiple file types

```bash
# Usage examples:
.\scripts\19-fix-line-endings.ps1                # Fix critical files
.\scripts\19-fix-line-endings.ps1 -All          # Fix all supported types
.\scripts\19-fix-line-endings.ps1 -Backup       # Create backup first
```

#### `20-cleanup-temp-files.ps1`
**Temporary Files and Cache Cleanup**
- Cleans Node.js caches
- Removes temporary files
- Docker cleanup
- Log file management
- Frees up disk space

```bash
# Usage examples:
.\scripts\20-cleanup-temp-files.ps1              # Standard cleanup
.\scripts\20-cleanup-temp-files.ps1 -Deep       # Deep cleanup + Docker
.\scripts\20-cleanup-temp-files.ps1 -DryRun     # Preview cleanup
```

## 🔄 Common Workflows

### Initial Setup
```bash
.\scripts\01-setup-environment.ps1
.\scripts\02-reset-and-seed.ps1
node scripts\05-verify-setup.js
```

### Development Reset
```bash
.\scripts\02-reset-and-seed.ps1 -Quick
node scripts\11-test-authentication.js
```

### Troubleshooting
```bash
node scripts\13-show-access-points.js
.\scripts\12-test-connectivity.ps1
node scripts\06-check-database.js
```

### Emergency Recovery
```bash
.\scripts\18-emergency-restore.ps1 -BackupFirst
node scripts\05-verify-setup.js
```

### Maintenance
```bash
.\scripts\20-cleanup-temp-files.ps1
.\scripts\19-fix-line-endings.ps1
node scripts\16-generate-secrets.js --update-env
```

## 📁 Removed Scripts

The following scripts have been removed as they were obsolete, broken, or superseded:

### Obsolete/Broken Scripts
- `add-themis-*` scripts (user-specific, superseded)
- `create-tables-direct.js` (superseded by 03-create-database-tables.js)
- `fix-auth-system.*` (superseded by reset script)
- `user-troubleshooter.js` (merged into 11-test-authentication.js)

### Merged Scripts
- `debug-user-login.js` + `verify-user-setup.js` → `11-test-authentication.js`
- `show-access-points.js` + `test-studio-access.js` → `13-show-access-points.js`
- `add-admin.js` + `add-admin-simple.js` + `add-user.js` → `10-manage-users.js`
- `check-database.js` + `setup-database.js` → `06-check-database.js`
- `reset-and-seed*.ps1` (all versions) → `02-reset-and-seed.ps1`

## 🎯 Script Execution Order

For a complete setup from scratch, run scripts in this order:

1. **01-setup-environment.ps1** - Environment preparation
2. **02-reset-and-seed.ps1** - Database reset and seeding
3. **05-verify-setup.js** - Verification

For ongoing development:
- **11-test-authentication.js** - Test auth system
- **12-test-connectivity.ps1** - Check services
- **13-show-access-points.js** - Get access URLs

For maintenance:
- **19-fix-line-endings.ps1** - Fix file issues
- **20-cleanup-temp-files.ps1** - Clean temporary files
- **16-generate-secrets.js** - Rotate secrets

For emergencies:
- **18-emergency-restore.ps1** - Full recovery

## 💡 Tips

- Use `--help` or `-h` with any script to see available options
- Scripts with `.ps1` extension require PowerShell
- Scripts with `.js` extension require Node.js
- Always run scripts from the project root directory
- Check logs in the `logs/` directory for troubleshooting
- Use `-Verbose` or `--verbose` for detailed output
- Use `-Force` or `--force` to skip confirmation prompts

## 🔗 Dependencies

- **Docker & Docker Compose** - For containerized services
- **Node.js & NPM** - For JavaScript scripts
- **PowerShell 7+** - For PowerShell scripts
- **Supabase** - Database and auth services

## 📞 Support

If you encounter issues:
1. Check the logs in `logs/` directory
2. Run the verification script: `node scripts/05-verify-setup.js --verbose`
3. Use the emergency restore: `.\scripts\18-emergency-restore.ps1`
4. Check Docker status: `docker-compose ps`
