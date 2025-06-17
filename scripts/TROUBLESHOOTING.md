# Supabase Troubleshooting Guide

This document provides solutions for common Supabase setup and runtime issues encountered in the development environment.

## Table of Contents
1. [Supabase Analytics Password Authentication Issue](#supabase-analytics-password-authentication-issue)
2. [Container Startup Issues](#container-startup-issues)
3. [Database Connection Problems](#database-connection-problems)
4. [Port Conflicts](#port-conflicts)
5. [Environment Configuration Issues](#environment-configuration-issues)
6. [Database Setup Verification](#database-setup-verification)

---

## Supabase Analytics Password Authentication Issue

### Symptoms
- `supabase-analytics` container fails to start or keeps restarting
- Error logs show: `FATAL 28P01 (invalid_password) password authentication failed for user "supabase_admin"`
- Analytics service health checks fail
- Repeated connection errors in docker logs

### Example Error Output
```
[error] Postgrex.Protocol failed to connect: ** (Postgrex.Error) FATAL 28P01 (invalid_password) password authentication failed for user "supabase_admin"
```

### Root Cause
The `supabase_admin` user password is not being set during database initialization because the `roles.sql` file is missing the password configuration for the `supabase_admin` user.

### Solution

#### Option 1: Automated Fix (Recommended)
Run the dedicated fix script:
```powershell
.\scripts\21-fix-supabase-analytics.ps1
```

This script will:
- Diagnose the issue
- Fix the `roles.sql` file
- Reset the Supabase environment
- Verify the fix

#### Option 2: Manual Fix
1. **Stop all services:**
   ```powershell
   cd docker
   docker compose down -v --remove-orphans
   ```

2. **Edit the roles.sql file:**
   Open `docker/volumes/db/roles.sql` and add this line after the other `ALTER USER` statements:
   ```sql
   ALTER USER supabase_admin WITH PASSWORD :'pgpass';
   ```

3. **Remove persistent data:**
   ```powershell
   Remove-Item -Path "volumes/db/data" -Recurse -Force -ErrorAction SilentlyContinue
   ```

4. **Restart services:**
   ```powershell
   docker compose up -d
   ```

### Verification
After applying the fix, verify it worked:

1. **Check container status:**
   ```powershell
   docker ps
   ```
   All containers should be running and healthy.

2. **Check analytics logs:**
   ```powershell
   docker logs supabase-analytics --tail 20
   ```
   Should show normal operation logs, no password errors.

3. **Test database connection:**
   ```powershell
   docker exec supabase-db psql -U supabase_admin -d _supabase -c "SELECT 'Connection successful' as status;"
   ```

### Prevention
This fix modifies the `roles.sql` file permanently, so the issue should not recur unless the file is reset or modified.

---

## Container Startup Issues

### Symptoms
- Services fail to start
- Containers exit immediately
- Health checks fail

### Common Causes & Solutions

#### Port Conflicts
**Check for port usage:**
```powershell
netstat -an | findstr ":54323\|:8000\|:5432"
```

**Solution:** Stop conflicting services or change ports in `.env` file.

#### Docker Resource Issues
**Check Docker resources:**
- Ensure Docker Desktop has enough memory allocated (8GB+ recommended)
- Check available disk space

#### Environment File Issues
**Check `.env` file exists:**
```powershell
Test-Path "docker\.env"
```

**Run environment validation:**
```powershell
.\scripts\02-reset-and-seed.ps1 -ValidateOnly
```

---

## Database Connection Problems

### Symptoms
- Cannot connect to database
- Connection timeouts
- Authentication failures

### Solutions

#### Check Database Container
```powershell
docker exec supabase-db pg_isready -U postgres
```

#### Test Basic Connection
```powershell
docker exec supabase-db psql -U postgres -c "SELECT version();"
```

#### Reset Database
If connection issues persist:
```powershell
.\scripts\02-reset-and-seed.ps1 -Force
```

---

## Port Conflicts

### Default Ports Used
- **54323**: Supabase Studio
- **8000**: API Gateway (Kong)
- **5432**: PostgreSQL (internal)
- **4000**: Analytics (Logflare)

### Check Port Usage
```powershell
# Windows
netstat -an | findstr ":54323\|:8000\|:4000"

# PowerShell alternative
Get-NetTCPConnection | Where-Object LocalPort -in 54323,8000,4000
```

### Change Ports
Edit `docker/.env` file:
```env
STUDIO_PORT=54323
KONG_HTTP_PORT=8000
# Add custom ports as needed
```

---

## Environment Configuration Issues

### Validate Environment
```powershell
.\scripts\02-reset-and-seed.ps1 -ValidateOnly
```

### Check Docker Compose Configuration
```powershell
cd docker
docker compose config
```

### Reset Environment Completely
```powershell
.\scripts\02-reset-and-seed.ps1 -Force
```

---

## Database Setup Verification

After fixing the analytics service and ensuring all containers are healthy, verify that the ML pipeline database tables are properly created:

### Check Database Tables

```bash
# Using Docker CLI to check tables
docker exec -it supabase-db psql -U postgres -d postgres -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

Expected tables:
- `deployments` - Model deployment tracking
- `model_versions` - Model version management  
- `profiles` - User profiles
- `projects` - ML pipeline projects
- `training_sessions` - Training session tracking
- `userinfo` - Additional user information

### Verify Table Structure

```bash
# Check table structure and relationships
docker exec -it supabase-db psql -U postgres -d postgres -c "
SELECT 
    t.table_name,
    COUNT(c.column_name) as column_count,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t.table_name) 
        THEN 'RLS Enabled' 
        ELSE 'No RLS' 
    END as security_status
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
GROUP BY t.table_name
ORDER BY t.table_name;"
```

### Create Missing Tables

If tables are missing, you can create them manually using Docker CLI:

```bash
# Core ML Pipeline Tables
docker exec -it supabase-db psql -U postgres -d postgres -c "
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('cv', 'nlp', 'regression', 'recommendation', 'time-series', 'custom')),
    framework TEXT,
    config JSONB DEFAULT '{}',
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);"

# Enable Row Level Security
docker exec -it supabase-db psql -U postgres -d postgres -c "ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;"

# Create access policy
docker exec -it supabase-db psql -U postgres -d postgres -c "CREATE POLICY projects_user_policy ON public.projects FOR ALL USING (auth.uid() = owner_id);"
```

---

## General Troubleshooting Commands

### Check All Service Status
```powershell
.\scripts\12-test-connectivity.ps1
```

### View Service Logs
```powershell
cd docker
docker compose logs -f [service-name]
```

### Emergency Recovery
```powershell
.\scripts\18-emergency-restore.ps1
```

### Generate Fresh Secrets
```powershell
.\scripts\16-generate-secrets.js
```

---

## Common Script Usage

### Quick Diagnosis
```powershell
# Check for analytics issue specifically
.\scripts\21-fix-supabase-analytics.ps1 -DiagnoseOnly

# General connectivity test
.\scripts\12-test-connectivity.ps1 -Quick

# Environment validation
.\scripts\02-reset-and-seed.ps1 -ValidateOnly
```

### Recovery Operations
```powershell
# Full reset with seeding
.\scripts\02-reset-and-seed.ps1

# Quick reset without cleanup
.\scripts\02-reset-and-seed.ps1 -Quick

# Emergency restore
.\scripts\18-emergency-restore.ps1

# Fix specific analytics issue
.\scripts\21-fix-supabase-analytics.ps1
```

---

## Getting Help

### Verbose Output
Add `-Verbose` flag to most scripts for detailed output:
```powershell
.\scripts\12-test-connectivity.ps1 -Verbose
.\scripts\21-fix-supabase-analytics.ps1 -Verbose
```

### Log Files
Most scripts generate log files in the `logs/` directory for detailed troubleshooting.

### Debug Information
```powershell
# Docker system info
docker system df
docker system info

# Container inspection
docker inspect supabase-analytics
docker inspect supabase-db
```

---

## Contact & Support

If issues persist after trying these solutions:

1. Check the log files generated by the scripts
2. Review Docker logs for specific error messages
3. Ensure all prerequisites are installed and up to date
4. Consider running a complete environment reset

The troubleshooting scripts are designed to handle most common issues automatically. When in doubt, start with the automated diagnosis and fix tools.
