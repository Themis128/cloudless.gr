# Development & Scripts Service Documentation

![Scripts](https://img.shields.io/badge/scripts-20+-orange?style=flat-square&logo=terminal)
![PowerShell](https://img.shields.io/badge/powershell-7+-5391FE?style=flat-square&logo=powershell)
![Node.js](https://img.shields.io/badge/node.js-18+-339933?style=flat-square&logo=node.js)
![Automation](https://img.shields.io/badge/automation-full-green?style=flat-square&logo=automation)
![Fast Setup](https://img.shields.io/badge/setup-10s-brightgreen?style=flat-square&logo=rocket)
![Recovery](https://img.shields.io/badge/recovery-emergency-red?style=flat-square&logo=medical)

This document consolidates all development workflow and scripts documentation for the CloudlessGR application.

## Overview

The development service provides comprehensive automation scripts and workflows for efficient development of the CloudlessGR application. It includes setup, maintenance, testing, and deployment scripts organized in a logical sequence.

## Scripts Architecture

### 📋 Numbered Scripts (Sequential)

The main scripts are numbered for sequential execution:

#### Setup & Initialization (01-05)
1. **`01-setup-environment.ps1`** - Complete environment setup
2. **`02-reset-and-seed.ps1`** - Database reset and seeding
3. **`03-create-database-tables.js`** - Database table creation
4. **`04-setup-user-accounts.js`** - User account initialization
5. **`05-verify-setup.js`** - Setup verification and testing

#### Maintenance & Operations (06-15)
6. **`06-check-database.js`** - Database health checks
7. **`07-seed-database.js`** - Database seeding operations
8. **`08-[reserved]`** - Future maintenance script
9. **`09-[reserved]`** - Future maintenance script
10. **`10-manage-users.js`** - User management operations
11. **`11-test-authentication.js`** - Authentication testing
12. **`12-test-connectivity.ps1`** - Connectivity testing
13. **`13-show-access-points.js`** - Display access endpoints

#### Utilities & Tools (16-20)
16. **`16-generate-secrets.js`** - Secret generation utilities
17. **`17-[reserved]`** - Future utility script
18. **`18-emergency-restore.ps1`** - Emergency recovery procedures
19. **`19-fix-line-endings.ps1`** - File format corrections
20. **`20-cleanup-temp-files.ps1`** - Temporary file cleanup

### 🚀 Quick Start Workflows

#### Complete Setup from Scratch
```bash
# 1. Setup environment
.\scripts\01-setup-environment.ps1

# 2. Reset and seed database
.\scripts\02-reset-and-seed.ps1

# 3. Verify everything is working
node scripts\05-verify-setup.js
```

#### Daily Development Workflow
```bash
# Check system status
node scripts\06-check-database.js
node scripts\12-test-connectivity.ps1

# Test authentication
node scripts\11-test-authentication.js

# Show current access points
node scripts\13-show-access-points.js
```

#### Emergency Recovery
```bash
# Nuclear option - complete restore
.\scripts\18-emergency-restore.ps1

# Quick fixes for common issues
.\scripts\quick-fix.ps1
```

## Fast Development Scripts

### ⚡ Ultra-Fast Workflows

#### 1. Instant Supabase (10-20 seconds)
```powershell
# Just get Supabase running (no seeding)
.\scripts\instant-supabase.ps1

# Get Supabase running + seed test data
.\scripts\instant-supabase.ps1 -Seed
```
**Use when:** You just need Supabase running immediately, containers are mostly healthy.

#### 2. Optimized Reset (30-60 seconds)
```powershell
# Ultra-fast reset with smart cleanup
.\scripts\reset-and-seed-v2.ps1
```
**Use when:** You need a clean slate but want to minimize downtime.

#### 3. Quick Reset (5-10 seconds)
```powershell
# Clear data only, keep containers running
.\scripts\quick-reset.ps1
```
**Use when:** You just need to clear data without restarting services.

#### 4. Container Optimization (15-30 seconds)
```powershell
# Optimize containers without full rebuild
.\scripts\optimize-containers.ps1
```
**Use when:** Containers are slow but functional.

### Speed Comparison

| Script | Time | Use Case |
|--------|------|----------|
| `instant-supabase.ps1` | 10-20s | Quick development start |
| `quick-reset.ps1` | 5-10s | Data-only reset |
| `reset-and-seed-v2.ps1` | 30-60s | Clean development environment |
| `18-emergency-restore.ps1` | 2-5min | Complete system recovery |

## Script Enhancement Features

### Smart Detection & Optimization

#### Container Health Checks
- Automatic detection of container status
- Smart restart only when necessary
- Health validation before proceeding

#### Process Optimization
- Parallel execution where possible
- Skip unnecessary steps
- Intelligent caching

#### Error Recovery
- Automatic retry mechanisms
- Graceful degradation
- Comprehensive error reporting

### Advanced Features

#### Conditional Execution
```powershell
# Run with conditions
.\scripts\reset-and-seed.ps1 -SkipBuild -FastMode

# Development mode with debugging
.\scripts\01-setup-environment.ps1 -Development -Verbose
```

#### Environment Detection
- Automatic Windows/Linux detection
- PowerShell/Bash script selection
- Docker environment validation

#### Progress Reporting
- Real-time progress indicators
- Detailed logging
- Success/failure notifications

## Recovery & Emergency Procedures

### 🆘 Emergency Scenarios

#### Scenario 1: "Failed to fetch" Errors (Port 54321 Issue)

**Symptoms:**
- Browser console shows `Failed to fetch` errors to `http://127.0.0.1:54321`
- Authentication requests fail
- Database connection issues

**Quick Fix:**
```powershell
# Immediate fix
.\scripts\fix-port-54321.ps1

# If that doesn't work, full reset
.\scripts\18-emergency-restore.ps1
```

#### Scenario 2: Docker Container Issues

**Symptoms:**
- Containers won't start
- Port conflicts
- Volume mount issues

**Recovery Steps:**
```powershell
# Clean docker environment
.\scripts\clean-docker.ps1

# Full container rebuild
.\scripts\rebuild-containers.ps1
```

#### Scenario 3: Database Corruption

**Symptoms:**
- Data inconsistencies
- Migration failures
- Foreign key violations

**Recovery Steps:**
```powershell
# Database-only recovery
.\scripts\recover-database.ps1

# Full system recovery if needed
.\scripts\18-emergency-restore.ps1
```

### Recovery Script Hierarchy

1. **Level 1**: Quick fixes (`quick-fix.ps1`)
2. **Level 2**: Service-specific recovery (`recover-database.ps1`)
3. **Level 3**: Component reset (`reset-and-seed.ps1`)
4. **Level 4**: Nuclear option (`18-emergency-restore.ps1`)

## Development Environment Management

### Environment Setup

#### Prerequisites Check
```powershell
# Check all prerequisites
.\scripts\check-prerequisites.ps1

# Install missing dependencies
.\scripts\install-dependencies.ps1
```

#### Configuration Management
```powershell
# Generate configuration files
.\scripts\16-generate-secrets.js

# Validate configuration
.\scripts\validate-config.ps1
```

### Testing & Validation

#### Comprehensive Testing
```bash
# Run all tests
npm run test

# Test specific components
node scripts\11-test-authentication.js
node scripts\12-test-connectivity.ps1
```

#### Continuous Integration
```bash
# CI pipeline script
.\scripts\ci-pipeline.ps1

# Pre-commit validation
.\scripts\pre-commit-check.ps1
```

### Maintenance Scripts

#### Regular Maintenance
```powershell
# Daily maintenance
.\scripts\daily-maintenance.ps1

# Weekly cleanup
.\scripts\20-cleanup-temp-files.ps1

# File format fixes
.\scripts\19-fix-line-endings.ps1
```

#### Performance Optimization
```powershell
# Optimize development environment
.\scripts\optimize-dev-env.ps1

# Clean up unused resources
.\scripts\cleanup-resources.ps1
```

## Script Development Guidelines

### Naming Conventions

#### Numbered Scripts (01-20)
- Use for sequential operations
- Two-digit prefix for ordering
- Descriptive names

#### Utility Scripts
- Use descriptive names
- Group by functionality
- Include file extensions

#### Emergency Scripts
- Clear emergency indication
- Easy to identify
- Quick to execute

### Best Practices

#### Error Handling
- Comprehensive error checking
- Graceful failure handling
- Clear error messages

#### Logging
- Detailed operation logs
- Progress indicators
- Success/failure reporting

#### Documentation
- Inline script documentation
- Usage examples
- Parameter descriptions

## API Reference

### Script Execution

#### PowerShell Scripts
```powershell
# Standard execution
.\scripts\script-name.ps1

# With parameters
.\scripts\script-name.ps1 -Parameter Value -Flag
```

#### Node.js Scripts
```bash
# Standard execution
node scripts/script-name.js

# With environment variables
NODE_ENV=development node scripts/script-name.js
```

### Common Parameters

#### PowerShell Scripts
- `-Verbose`: Detailed output
- `-Development`: Development mode
- `-Force`: Skip confirmations
- `-SkipBuild`: Skip build steps

#### Node.js Scripts
- `--verbose`: Detailed logging
- `--dev`: Development mode
- `--force`: Force operations
- `--dry-run`: Simulate operations

## Troubleshooting

### Common Script Issues

#### Permission Errors
```powershell
# Fix PowerShell execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Path Issues
- Ensure scripts are run from project root
- Check file path separators
- Verify working directory

#### Environment Issues
- Validate environment variables
- Check Docker daemon status
- Verify Node.js version

### Debug Tools

```bash
# Script debugging
.\scripts\debug-environment.ps1

# Verbose script execution
.\scripts\any-script.ps1 -Verbose

# Test script environment
node scripts\test-script-env.js
```

## Integration Points

### CI/CD Integration
- Jenkins pipeline scripts
- GitHub Actions workflows
- Docker build automation

### Development Tools
- VS Code task integration
- NPM script integration
- Docker Compose integration

### Monitoring & Alerts
- Script execution monitoring
- Failure notifications
- Performance tracking

## Related Files

- `SCRIPTS_REFERENCE.md` (source)
- `FAST_SCRIPTS_GUIDE.md` (source)
- `RESET_SCRIPT_ENHANCEMENTS.md` (source)
- `REORGANIZATION_COMPLETE.md` (source)
- All numbered scripts in `/scripts` directory
