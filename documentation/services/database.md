# Database Service Documentation

![PostgreSQL](https://img.shields.io/badge/postgresql-15-336791?style=flat-square&logo=postgresql)
![Supabase](https://img.shields.io/badge/supabase-hosted-3ECF8E?style=flat-square&logo=supabase)
![Docker](https://img.shields.io/badge/docker-containerized-2496ED?style=flat-square&logo=docker)
![Seeding](https://img.shields.io/badge/seeding-automated-green?style=flat-square&logo=database)
![Backup](https://img.shields.io/badge/backup-available-blue?style=flat-square&logo=archive)
![Recovery](https://img.shields.io/badge/recovery-tested-red?style=flat-square&logo=refresh)

This document consolidates all database-related documentation for the CloudlessGR application, including seeding, recovery, and management procedures.

## Overview

The database service uses Supabase (PostgreSQL) as the primary database with Docker containerization for local development. It includes comprehensive seeding, backup, and recovery capabilities.

## Database Architecture

### Core Tables

1. **auth.users** (Supabase managed)
   - User authentication data
   - Managed by Supabase Auth

2. **profiles**
   - User profile information
   - Linked to auth.users via foreign key
   - Includes role-based access control

3. **Additional Tables**
   - Application-specific tables
   - Defined in migration files

### Database Configuration

- **Development**: Docker container with PostgreSQL
- **Production**: Supabase hosted PostgreSQL
- **Backup**: Automated and manual backup solutions

## Seeding Guide

### 📁 Seeding Files Location

#### SQL Files (Automatic)
- **`docker/dev/seed.sql`** - Comprehensive SQL seeding file
- **`docker/dev/data.sql`** - Enhanced profiles table setup

#### Node.js Scripts (Manual)
- **`scripts/07-seed-database.js`** - Complete seeding with auth users
- **`scripts/04-setup-user-accounts.js`** - User account seeding
- **`scripts/03-create-database-tables.js`** - Table creation and setup

#### PowerShell Scripts (Windows)
- **`scripts/02-reset-and-seed.ps1`** - Complete reset and seeding
- **`scripts/seed-after-reset.ps1`** - Seeding only after reset

### Seeding Process

#### 1. Automatic Seeding (Docker)
When containers start, they automatically run:
```sql
-- Executed from docker/dev/seed.sql
-- Creates tables, triggers, and initial data
```

#### 2. Manual Seeding (Node.js)
```bash
# Complete database seeding
node scripts/07-seed-database.js

# Setup user accounts
node scripts/04-setup-user-accounts.js
```

#### 3. PowerShell Seeding (Windows)
```powershell
# Complete reset and seed
.\scripts\02-reset-and-seed.ps1

# Seed after reset
.\scripts\seed-after-reset.ps1
```

### Seeding Content

#### User Accounts
- Default admin user
- Test user accounts
- Role assignments

#### Sample Data
- Application-specific sample data
- Test data for development
- Reference data

#### Database Structure
- Table creation
- Indexes and constraints
- Triggers and functions
- Row Level Security policies

## Database Recovery & Emergency Procedures

### 🚨 Emergency Recovery Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `18-emergency-restore.ps1` | Complete application restore | Nuclear option - when everything is broken |
| `02-reset-and-seed.ps1` | Standard reset with validation | Regular development resets |
| `06-check-database.js` | Database health check | Verify database status |

### Emergency Scenarios

#### Scenario 1: Database Connection Issues

**Symptoms:**
- Cannot connect to database
- Application shows database errors
- Supabase dashboard inaccessible

**Recovery Steps:**
1. Check container status:
   ```bash
   docker-compose ps
   ```

2. Restart database containers:
   ```bash
   docker-compose restart db
   ```

3. Full container reset:
   ```bash
   .\scripts\18-emergency-restore.ps1
   ```

#### Scenario 2: Data Corruption

**Symptoms:**
- Inconsistent data
- Foreign key violations
- Missing critical records

**Recovery Steps:**
1. Stop application:
   ```bash
   docker-compose down
   ```

2. Restore from backup:
   ```bash
   .\scripts\restore-from-backup.ps1
   ```

3. Re-seed if necessary:
   ```bash
   .\scripts\02-reset-and-seed.ps1
   ```

#### Scenario 3: Migration Failures

**Symptoms:**
- Schema out of sync
- Missing tables or columns
- Migration errors

**Recovery Steps:**
1. Check migration status:
   ```bash
   node scripts/06-check-database.js
   ```

2. Reset database:
   ```bash
   .\scripts\02-reset-and-seed.ps1
   ```

3. Reapply migrations:
   ```bash
   node scripts/03-create-database-tables.js
   ```

## Fast Database Operations

### ⚡ Quick Start Scripts

#### 1. Instant Database Setup (10-20 seconds)
```powershell
# Just get database running
.\scripts\instant-database.ps1

# Get database running + seed test data
.\scripts\instant-database.ps1 -Seed
```

#### 2. Optimized Reset (30-60 seconds)
```powershell
# Ultra-fast reset with smart cleanup
.\scripts\reset-and-seed-v2.ps1
```

#### 3. Minimal Reset (5-10 seconds)
```powershell
# Clear data only, keep structure
.\scripts\quick-reset.ps1
```

### Performance Optimization

#### Database Indexing
- Ensure proper indexes on frequently queried columns
- Monitor query performance
- Optimize slow queries

#### Connection Pooling
- Configure appropriate connection limits
- Monitor connection usage
- Implement connection pooling for production

#### Caching Strategy
- Implement Redis for session caching
- Cache frequently accessed data
- Use appropriate cache invalidation

## Database Maintenance

### Regular Maintenance Tasks

#### Daily
- Monitor database performance
- Check error logs
- Verify backup completion

#### Weekly
- Review slow queries
- Check database size growth
- Validate data integrity

#### Monthly
- Optimize database indexes
- Archive old data
- Review security settings

### Backup Procedures

#### Automated Backups
```bash
# Daily backup script
.\scripts\backup-database.ps1

# Weekly full backup
.\scripts\full-backup.ps1
```

#### Manual Backups
```bash
# Create manual backup
node scripts/create-backup.js

# Restore from backup
node scripts/restore-backup.js
```

### Monitoring & Health Checks

#### Database Health Check
```bash
# Comprehensive health check
node scripts/06-check-database.js

# Quick status check
node scripts/db-status.js
```

#### Performance Monitoring
- Monitor query execution times
- Track connection usage
- Watch for memory usage
- Monitor disk space

## Development Workflow

### Schema Changes

1. **Create Migration**
   ```bash
   # Create new migration file
   node scripts/create-migration.js "add_new_table"
   ```

2. **Apply Migration**
   ```bash
   # Apply pending migrations
   node scripts/apply-migrations.js
   ```

3. **Verify Changes**
   ```bash
   # Verify schema changes
   node scripts/verify-schema.js
   ```

### Testing

#### Database Tests
```bash
# Run database tests
npm run test:database

# Test specific functionality
node scripts/test-database-functions.js
```

#### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Test with seeded data
npm run test:seeded
```

## API Reference

### Database Connection

```typescript
// Get database client
const client = await getSupabaseClient()

// Execute query
const { data, error } = await client
  .from('profiles')
  .select('*')
  .eq('role', 'admin')
```

### Common Operations

#### Create Record
```typescript
const { data, error } = await client
  .from('profiles')
  .insert([
    { email: 'user@example.com', role: 'user' }
  ])
```

#### Update Record
```typescript
const { data, error } = await client
  .from('profiles')
  .update({ role: 'admin' })
  .eq('id', userId)
```

#### Delete Record
```typescript
const { data, error } = await client
  .from('profiles')
  .delete()
  .eq('id', userId)
```

## Troubleshooting

### Common Issues

#### Connection Timeout
- Check network connectivity
- Verify database service status
- Review connection string

#### Permission Denied
- Check RLS policies
- Verify user permissions
- Review authentication status

#### Data Integrity Issues
- Check foreign key constraints
- Verify data types
- Review validation rules

### Debug Tools

```bash
# Database connection test
node scripts/test-db-connection.js

# Schema validation
node scripts/validate-schema.js

# Data integrity check
node scripts/check-data-integrity.js
```

## Security Best Practices

### Access Control
- Implement Row Level Security (RLS)
- Use least privilege principle
- Regular security audits

### Data Protection
- Encrypt sensitive data
- Implement backup encryption
- Secure connection strings

### Monitoring
- Log database access
- Monitor for suspicious activity
- Set up alerts for anomalies

## Related Files

- `SEEDING_GUIDE.md` (source)
- `EMERGENCY_RECOVERY_GUIDE.md` (source)
- `RECOVERY_SCRIPTS_GUIDE.md` (source)
- `FAST_SCRIPTS_GUIDE.md` (source)
- Database-related scripts in `/scripts` directory
