# 📋 Recovery Scripts Summary

This document outlines the complete recovery sequence and scripts available for the CloudlessGR application.

## 🚀 Quick Start (If Everything Breaks)

```powershell
# Complete nuclear reset (⚠️ destroys all data)
.\scripts\emergency-restore.ps1 -ForceCleanStart -SkipConfirmation

# Or for less destructive recovery
.\scripts\quick-fix.ps1 -All
```

## 📊 Available Scripts

### 1. `emergency-restore.ps1` - Nuclear Option
**Use when:** Everything is broken, complete environment corruption

**What it does:**
- ✅ Stops and removes all Docker containers/volumes
- ✅ Fixes all configuration files (`.env`, `nuxt.config.ts`)
- ✅ Fixes line endings in all critical files
- ✅ Rebuilds entire Docker environment
- ✅ Seeds database with users
- ✅ Restores Node.js dependencies
- ✅ Runs comprehensive health checks

**Usage:**
```powershell
# Interactive mode (asks for confirmation)
.\scripts\emergency-restore.ps1

# Skip confirmation
.\scripts\emergency-restore.ps1 -SkipConfirmation

# Force clean start (removes all Docker data)
.\scripts\emergency-restore.ps1 -ForceCleanStart

# Verbose output
.\scripts\emergency-restore.ps1 -VerboseOutput
```

### 2. `quick-fix.ps1` - Targeted Fixes
**Use when:** Specific issues need fixing

**What it does:**
- 🔧 Fixes hardcoded URLs (54321 → 8000)
- 🔧 Fixes Windows line endings
- 🔧 Restarts Docker services
- 🔧 Runs health checks

**Usage:**
```powershell
# Fix specific issues
.\scripts\quick-fix.ps1 -FixUrls           # Fix port 54321 → 8000
.\scripts\quick-fix.ps1 -FixLineEndings    # Fix CRLF → LF
.\scripts\quick-fix.ps1 -RestartServices   # Restart Docker
.\scripts\quick-fix.ps1 -CheckHealth       # Test connectivity

# Fix everything
.\scripts\quick-fix.ps1 -All
```

### 3. `test-connectivity.ps1` - Health Checks
**Use when:** Need to verify system status

**What it does:**
- 🔍 Tests Docker container status
- 🔍 Validates environment configuration
- 🔍 Tests Supabase service endpoints
- 🔍 Checks frontend accessibility

**Usage:**
```powershell
.\scripts\test-connectivity.ps1
```

### 4. `reset-and-seed.ps1` - Standard Reset
**Use when:** Regular development environment reset

**What it does:**
- 🔄 Comprehensive environment validation
- 🔄 Automated issue detection and repair
- 🔄 Database reset and seeding
- 🔄 Service restart and health checks

**Usage:**
```powershell
.\scripts\reset-and-seed.ps1
```

## 🔥 Emergency Scenarios & Solutions

### Scenario 1: "Failed to fetch" in Browser Console
```
ERROR: Failed to fetch http://127.0.0.1:54321/auth/v1/token
```

**Root Cause:** Frontend trying to connect to wrong port (54321 instead of 8000)

**Solution:**
```powershell
.\scripts\quick-fix.ps1 -FixUrls -CheckHealth
# Then restart Nuxt: npm run dev
```

### Scenario 2: Docker Won't Start
```
ERROR: Container keeps restarting or won't start
```

**Root Cause:** Line ending issues, corrupted volumes, or port conflicts

**Solution:**
```powershell
.\scripts\quick-fix.ps1 -FixLineEndings -RestartServices
# Or nuclear option:
.\scripts\emergency-restore.ps1 -ForceCleanStart
```

### Scenario 3: Authentication Completely Broken
```
ERROR: All auth endpoints return errors
```

**Root Cause:** Wrong configuration, missing keys, or service issues

**Solution:**
```powershell
.\scripts\emergency-restore.ps1 -SkipConfirmation
```

### Scenario 4: Database Issues
```
ERROR: Database connection failed, SQL errors
```

**Root Cause:** Line ending issues in SQL files, corrupted data, or config problems

**Solution:**
```powershell
.\scripts\quick-fix.ps1 -FixLineEndings
.\scripts\quick-fix.ps1 -RestartServices
# If that fails:
.\scripts\emergency-restore.ps1 -ForceCleanStart
```

## 🎯 Recovery Workflow

### Step 1: Diagnose the Problem
```powershell
# Run health checks first
.\scripts\test-connectivity.ps1

# Check Docker status
docker ps
docker-compose logs
```

### Step 2: Try Quick Fixes First
```powershell
# Most common issues
.\scripts\quick-fix.ps1 -All
```

### Step 3: Standard Reset if Needed
```powershell
# More comprehensive but preserves data
.\scripts\reset-and-seed.ps1
```

### Step 4: Nuclear Option (Last Resort)
```powershell
# Complete environment rebuild
.\scripts\emergency-restore.ps1 -ForceCleanStart
```

## ⚡ Critical Configuration Values

### Environment Files
**`.env` (Main application):**
```env
SUPABASE_URL=http://127.0.0.1:8000  # ⚠️ PORT 8000!
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTAwMjEyMDAsImV4cCI6MTkwNzc4NzYwMH0.n7S053n5q1Ih3_cJmdyBSUuiPmemvB3ZJgvEUoVKZ6M
JWT_SECRET=eOvlpJPRGfQkptMLRFSfCPerPR5MkrekkpIuLqXd
```

**`nuxt.config.ts`:**
```typescript
supabase: {
  url: "http://127.0.0.1:8000",  // ⚠️ PORT 8000!
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ"
},
runtimeConfig: {
  public: {
    supabaseUrl: "http://127.0.0.1:8000",  // ⚠️ PORT 8000!
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ"
  }
}
```

## 🔍 Health Check Endpoints

| Endpoint | Expected Response | Meaning |
|----------|------------------|---------|
| `http://localhost:8000` | 404 | Kong is running |
| `http://localhost:8000/auth/v1/health` | `{"message":"No API key found"}` | Auth service OK |
| `http://localhost:8000/rest/v1/` | 200 | REST API OK |
| `http://localhost:3001` | Nuxt app loads | Frontend OK |

## 📁 Critical Files to Monitor

### Docker Files
- `docker/docker-compose.yml` - Service definitions
- `docker/.env` - Docker environment
- `docker/volumes/pooler/pooler.exs` - Database pooler (line endings critical!)

### SQL Files (Line endings matter!)
- `docker/volumes/db/*.sql`
- `docker/dev/*.sql`

### Application Files
- `.env` - Main config
- `nuxt.config.ts` - Frontend config
- `package.json` - Dependencies

## 🚨 Red Flags (What to Watch For)

### ❌ Bad Signs
- Console errors with port 54321
- "Failed to fetch" errors
- Containers constantly restarting
- Elixir syntax errors in logs
- SQL parsing errors

### ✅ Good Signs
- All Docker containers show "Up" status
- `curl http://localhost:8000/auth/v1/health` returns JSON
- Frontend loads without console errors
- Login/auth works properly

## 💾 Backup Strategy

Before running any recovery script, backups are automatically created in:
- `backups/emergency-YYYYMMDD-HHmmss/` - Critical config files
- `logs/emergency-restore-YYYYMMDD-HHmmss.log` - Detailed logs

## 📞 When All Else Fails

1. **Check logs:** `docker-compose logs` and files in `logs/` directory
2. **Manual inspection:** Verify `.env` and `nuxt.config.ts` have correct port 8000
3. **Line endings:** All SQL/Elixir files must have Unix (LF) line endings
4. **Port conflicts:** Ensure no other services using ports 8000, 3000, 5432
5. **Docker cleanup:** `docker system prune -af` (nuclear option)

---

**Remember: Port 8000 is the correct port, never 54321!**
