# 🚨 Emergency Recovery Guide

This guide provides comprehensive recovery procedures to restore your CloudlessGR application to a working state.

## 📋 Quick Reference

### Emergency Recovery Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `emergency-restore.ps1` | Complete application restore | Nuclear option - when everything is broken |
| `quick-fix.ps1` | Fix common issues | Minor issues, targeted fixes |
| `reset-and-seed.ps1` | Standard reset with validation | Regular development resets |

## 🆘 Emergency Scenarios

### Scenario 1: "Failed to fetch" Errors (Port 54321 Issue)

**Symptoms:**
- Browser console shows `Failed to fetch` errors to `http://127.0.0.1:54321`
- Authentication not working
- API calls failing

**Quick Fix:**
```powershell
.\scripts\quick-fix.ps1 -FixUrls -CheckHealth
```

**If that doesn't work:**
```powershell
.\scripts\emergency-restore.ps1 -SkipConfirmation
```

### Scenario 2: Docker Services Won't Start

**Symptoms:**
- `docker-compose up` fails
- Containers keep restarting
- Database connection errors

**Quick Fix:**
```powershell
.\scripts\quick-fix.ps1 -RestartServices
```

**If that doesn't work:**
```powershell
.\scripts\emergency-restore.ps1 -ForceCleanStart
```

### Scenario 3: Line Ending Issues (Elixir/SQL Errors)

**Symptoms:**
- Elixir syntax errors in logs
- SQL parsing errors
- Files show `^M` characters

**Quick Fix:**
```powershell
.\scripts\quick-fix.ps1 -FixLineEndings
```

### Scenario 4: Complete Environment Corruption

**Symptoms:**
- Multiple services failing
- Configuration files corrupted
- Nothing works

**Nuclear Option:**
```powershell
.\scripts\emergency-restore.ps1 -ForceCleanStart -SkipConfirmation
```

## 🔧 Recovery Sequence (Manual Steps)

If scripts fail, follow these manual steps:

### Step 1: Environment Cleanup
```powershell
# Stop all Docker containers
docker stop $(docker ps -aq)

# Remove all containers
docker rm $(docker ps -aq)

# Remove volumes (⚠️ DATA LOSS)
docker volume prune -f

# Remove networks
docker network prune -f
```

### Step 2: Fix Configuration Files

**Main .env file:**
```env
# Database Configuration
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Supabase Configuration
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTAwMjEyMDAsImV4cCI6MTkwNzc4NzYwMH0.n7S053n5q1Ih3_cJmdyBSUuiPmemvB3ZJgvEUoVKZ6M

# JWT Configuration
JWT_SECRET=eOvlpJPRGfQkptMLRFSfCPerPR5MkrekkpIuLqXd

# Application Configuration
NODE_ENV=development
PORT=3000

# Storage Configuration (S3-compatible)
S3_ACCESS_KEY=625729a08b95bf1b7ff351a663f3a23c
S3_SECRET_KEY=850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
S3_REGION=local
```

**Nuxt Config (nuxt.config.ts):**
```typescript
export default defineNuxtConfig({
  // ... other config
  supabase: {
    url: "http://127.0.0.1:8000",  // ⚠️ PORT 8000, NOT 54321!
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ",
    // ... rest of config
  },
  runtimeConfig: {
    public: {
      supabaseUrl: "http://127.0.0.1:8000",  // ⚠️ PORT 8000, NOT 54321!
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ",
    },
  },
});
```

### Step 3: Fix Line Endings (Critical!)
```powershell
# Convert all critical files to Unix line endings
Get-ChildItem -Recurse -Include "*.sql", "*.exs" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -and $content.Contains("`r`n")) {
        $content = $content -replace "`r`n", "`n"
        [System.IO.File]::WriteAllText($_.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Output "Fixed: $($_.Name)"
    }
}
```

### Step 4: Start Services
```powershell
cd docker
docker-compose pull
docker-compose up -d

# Wait for services
Start-Sleep 30

# Check health
curl http://localhost:8000/health
```

### Step 5: Seed Database
```powershell
# Wait for database to be ready
Start-Sleep 15

# Run seeding
node scripts/seed-database.js

# Or create admin manually
node scripts/add-admin.js
```

### Step 6: Start Frontend
```powershell
# Clean install dependencies
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item package-lock.json -Force -ErrorAction SilentlyContinue
npm install

# Start development server
npm run dev
```

## 🔍 Health Check Commands

### Check Services Status
```powershell
# Docker containers
docker ps

# Docker logs
docker-compose logs kong
docker-compose logs auth
docker-compose logs db

# Service endpoints
curl http://localhost:8000/health
curl http://localhost:8000/auth/v1/health
curl http://localhost:8000/rest/v1/
```

### Verify Configuration
```powershell
# Check environment variables
Get-Content .env | Select-String "SUPABASE_URL"
Get-Content docker/.env | Select-String "SUPABASE_URL"

# Check Nuxt config
Get-Content nuxt.config.ts | Select-String "54321"  # Should return nothing!
Get-Content nuxt.config.ts | Select-String "8000"   # Should find URLs
```

## 🚨 Critical Port Information

**⚠️ IMPORTANT: Always use port 8000, never 54321!**

| Service | Correct URL | Wrong URL |
|---------|-------------|-----------|
| API Gateway | `http://localhost:8000` | ~~http://localhost:54321~~ |
| Auth Service | `http://localhost:8000/auth/v1` | ~~http://localhost:54321/auth/v1~~ |
| REST API | `http://localhost:8000/rest/v1` | ~~http://localhost:54321/rest/v1~~ |

## 📋 Common Issues & Solutions

### Issue: "Connection refused" to port 8000
**Solution:** Check if Kong is running:
```powershell
docker-compose ps kong
docker-compose logs kong
```

### Issue: Database connection errors
**Solution:** Check database container:
```powershell
docker-compose ps db
docker-compose logs db
```

### Issue: Authentication not working
**Solution:** Check auth service:
```powershell
curl http://localhost:8000/auth/v1/health
docker-compose logs auth
```

### Issue: Elixir syntax errors
**Solution:** Fix line endings in pooler.exs:
```powershell
.\scripts\quick-fix.ps1 -FixLineEndings
```

## 🔄 Recovery Script Details

### emergency-restore.ps1 Parameters
```powershell
# Skip confirmation prompt
.\scripts\emergency-restore.ps1 -SkipConfirmation

# Enable verbose output
.\scripts\emergency-restore.ps1 -VerboseOutput

# Force clean Docker start (removes all containers/volumes)
.\scripts\emergency-restore.ps1 -ForceCleanStart
```

### quick-fix.ps1 Parameters
```powershell
# Fix URL issues
.\scripts\quick-fix.ps1 -FixUrls

# Fix line ending issues
.\scripts\quick-fix.ps1 -FixLineEndings

# Restart Docker services
.\scripts\quick-fix.ps1 -RestartServices

# Check application health
.\scripts\quick-fix.ps1 -CheckHealth

# Run all fixes
.\scripts\quick-fix.ps1 -All
```

## 📁 Important Files Locations

### Configuration Files
- `.env` - Main environment file
- `docker/.env` - Docker environment file
- `nuxt.config.ts` - Nuxt configuration
- `docker/docker-compose.yml` - Docker services

### Critical Docker Files
- `docker/volumes/pooler/pooler.exs` - Database pooler config
- `docker/volumes/db/*.sql` - Database initialization
- `docker/dev/*.sql` - Development data

### Scripts
- `scripts/emergency-restore.ps1` - Full recovery
- `scripts/quick-fix.ps1` - Quick fixes
- `scripts/reset-and-seed.ps1` - Standard reset
- `scripts/seed-database.js` - Database seeding

## 📞 Emergency Contacts

If all else fails:
1. Check the log files in `logs/` directory
2. Review Docker Compose logs: `docker-compose logs`
3. Backup current state before trying fixes
4. Use the emergency restore script as last resort

## 🎯 Success Indicators

Your application is working when:
- ✅ `curl http://localhost:8000/health` returns 200
- ✅ `curl http://localhost:8000/auth/v1/health` returns 200
- ✅ Frontend loads without console errors
- ✅ Login/authentication works
- ✅ No "Failed to fetch" errors in browser console

---

**Remember: Always backup your work before running emergency procedures!**
