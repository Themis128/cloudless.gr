# ⚡ FAST SUPABASE DEVELOPMENT SCRIPTS

This directory contains optimized scripts for ultra-fast Supabase development workflows.

## 🚀 Quick Start Scripts

### 1. `instant-supabase.ps1` - FASTEST (10-20 seconds)
The absolute fastest way to get Supabase running:
```powershell
# Just get Supabase running (no seeding)
.\scripts\instant-supabase.ps1

# Get Supabase running + seed test data
.\scripts\instant-supabase.ps1 -Seed
```

**Use when:** You just need Supabase running immediately, containers are mostly healthy.

### 2. `reset-and-seed-v2.ps1` - OPTIMIZED (30-60 seconds)
New ultra-fast reset script with smart cleanup:
```powershell
# Fast reset with seeding
.\scripts\reset-and-seed-v2.ps1

# Ultra-fast without seeding (fastest full reset)
.\scripts\reset-and-seed-v2.ps1 -SkipSeed

# Super quick mode (minimal cleanup)
.\scripts\reset-and-seed-v2.ps1 -Quick

# Skip all prompts
.\scripts\reset-and-seed-v2.ps1 -Force
```

**Use when:** You need a clean reset but want it done fast.

### 3. `reset-and-seed-fast.ps1` - MINIMAL RESET (20-40 seconds)
Existing fast script for minimal downtime:
```powershell
# Fast reset with minimal cleanup
.\scripts\reset-and-seed-fast.ps1

# Even faster without seeding
.\scripts\reset-and-seed-fast.ps1 -SkipSeed
```

**Use when:** You want the existing fast workflow.

### 4. `reset-and-seed.ps1` - COMPREHENSIVE (60-120 seconds)
Full reset with all cleanup options:
```powershell
# Full reset with all options
.\scripts\reset-and-seed.ps1

# Quick mode within comprehensive script
.\scripts\reset-and-seed.ps1 -Quick
```

**Use when:** You need thorough cleanup or troubleshooting.

## 🎯 Which Script to Use?

| Scenario | Recommended Script | Time | Command |
|----------|-------------------|------|---------|
| **Just need it running NOW** | `instant-supabase.ps1` | ~15s | `.\scripts\instant-supabase.ps1 -Seed` |
| **Quick daily reset** | `reset-and-seed-v2.ps1` | ~30s | `.\scripts\reset-and-seed-v2.ps1` |
| **Fast reset, no seeding** | `reset-and-seed-v2.ps1` | ~20s | `.\scripts\reset-and-seed-v2.ps1 -SkipSeed` |
| **Containers are broken** | `reset-and-seed-v2.ps1` | ~45s | `.\scripts\reset-and-seed-v2.ps1 -Force` |
| **Need comprehensive cleanup** | `reset-and-seed.ps1` | ~90s | `.\scripts\reset-and-seed.ps1` |

## 🔧 Development Workflow

### Morning Startup (Recommended)
```powershell
# Get up and running immediately
.\scripts\instant-supabase.ps1 -Seed
```

### During Development
```powershell
# Quick reset when things get messy
.\scripts\reset-and-seed-v2.ps1 -Quick

# Ultra-fast restart without seeding
.\scripts\reset-and-seed-v2.ps1 -SkipSeed -Force
```

### When Containers Are Broken
```powershell
# Full reset with force
.\scripts\reset-and-seed-v2.ps1 -Force

# Or comprehensive cleanup
.\scripts\reset-and-seed.ps1 -Force
```

## 📊 Script Comparison

| Script | Cleanup Level | Startup Speed | Seeding | Best For |
|--------|---------------|---------------|---------|----------|
| `instant-supabase.ps1` | Minimal | ⚡ Fastest | Optional | Daily use |
| `reset-and-seed-v2.ps1` | Smart | ⚡ Very Fast | Yes | Development |
| `reset-and-seed-fast.ps1` | Moderate | 🚀 Fast | Yes | Regular resets |
| `reset-and-seed.ps1` | Comprehensive | 🐌 Slower | Yes | Troubleshooting |

## 🌱 Seeding Information

All scripts can seed the database with test users:

### Admin Users
- `baltzakis.themis@gmail.com` / `TH!123789th!` (super admin)
- `john.doe@example.com` / `AdminPass123!` (admin)
- `mike.admin@example.com` / `AdminPass123!` (admin)

### Other Users
- `jane.smith@example.com` / `ModPass123!` (moderator)
- `bob.wilson@example.com` / `UserPass123!` (user)
- `alice.johnson@example.com` / `UserPass123!` (user)

## 🌐 Access Points

After any script completes:
- **Supabase Studio:** http://localhost:54323
- **API Endpoint:** http://localhost:8000
- **Database:** localhost:54322
- **Email Testing:** http://localhost:54324

## 💡 Pro Tips

1. **For daily use:** Bookmark `.\scripts\instant-supabase.ps1 -Seed`
2. **For development:** Use `reset-and-seed-v2.ps1 -Quick` when things break
3. **For troubleshooting:** Use the full `reset-and-seed.ps1` script
4. **For CI/CD:** Use `reset-and-seed-v2.ps1 -Force -SkipSeed`

## 🚨 Troubleshooting

If any script fails:

1. **Check Docker is running:**
   ```powershell
   docker --version
   docker compose --version
   ```

2. **View container logs:**
   ```powershell
   cd docker
   docker compose logs
   ```

3. **Force cleanup everything:**
   ```powershell
   .\scripts\reset-and-seed.ps1 -Force
   ```

4. **Manual container removal:**
   ```powershell
   docker rm -f $(docker ps -aq --filter "name=supabase")
   docker volume prune -f
   ```

## ⚙️ Script Parameters

All scripts support these common parameters:
- `-Force` - Skip confirmation prompts
- `-SkipSeed` - Don't seed the database (faster)
- `-Quick` - Use minimal cleanup (faster)
- `-DevMode` - Use development configuration

## 📝 Notes

- All scripts automatically remove the problematic `supabase-vector` container
- Scripts use optimized timeouts and health checks
- Database seeding includes comprehensive user setup
- All essential services are verified before completion
