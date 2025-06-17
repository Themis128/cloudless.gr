# 🔄 Local to Cloud Sync Workflow

This document explains how to sync your local database changes to your cloud Supabase instance.

## 🎯 Overview

Your project is configured to:
- **Develop locally** with your local Supabase instance
- **Sync changes** to your cloud database when ready
- **Deploy** using cloud database for production

## 📋 Current Setup

### Environment Configuration
- **Local Development**: Uses local Supabase (commented out in `.env`)
- **Cloud/Production**: Uses cloud Supabase (currently active in `.env`)

### Database Status
- **Local**: `http://127.0.0.1:54321` (when Supabase CLI is running)
- **Cloud**: `https://oflctqligzouzshimuqh.supabase.co`
- **Status**: ✅ Currently synced

## 🛠 Workflow Commands

### 1. Check Current Status
```powershell
# Check migration status between local and cloud
.\scripts\check-diff.ps1

# Or manually check
supabase migration list
```

### 2. Create New Migration
```powershell
# Create a new migration
.\scripts\create-migration.ps1 "add_new_table"

# Create and auto-sync to cloud
.\scripts\create-migration.ps1 "add_new_table" -SyncToCloud
```

### 3. Sync Local Changes to Cloud
```powershell
# Sync all local migrations to cloud
.\scripts\sync-to-cloud.ps1

# Or manually
supabase db push
```

### 4. Development Workflow
```powershell
# 1. Make schema changes locally
supabase migration new "your_change_description"

# 2. Edit the migration file in supabase/migrations/

# 3. Apply locally to test
supabase db reset --local

# 4. Test your application

# 5. When ready, sync to cloud
.\scripts\sync-to-cloud.ps1
```

## 🔧 Manual Commands

### Check Differences
```powershell
supabase db diff                    # Show schema differences
supabase migration list             # Show migration status
supabase status                     # Show local services status
```

### Apply Changes
```powershell
supabase db push                    # Push local migrations to cloud
supabase db pull                    # Pull cloud schema to local
supabase db reset --local           # Reset local DB with migrations
supabase db reset --linked          # Reset cloud DB with migrations
```

### Switch Between Local and Cloud
```powershell
# To use LOCAL database (for development)
# In .env file, uncomment:
# SUPABASE_URL=http://127.0.0.1:54321
# SUPABASE_ANON_KEY=...

# To use CLOUD database (for production)
# In .env file, use:
# SUPABASE_URL=https://oflctqligzouzshimuqh.supabase.co
# SUPABASE_ANON_KEY=...
```

## ⚠️ Important Notes

### Before Making Changes
1. Always check current status: `.\scripts\check-diff.ps1`
2. Ensure local Supabase is running: `supabase start`
3. Test changes locally before syncing to cloud

### When Syncing to Cloud
1. **Review changes** before pushing
2. **Backup important data** if needed
3. **Test thoroughly** after syncing

### Safety Tips
- Always test migrations locally first
- Use descriptive migration names
- Keep migrations small and focused  
- Never edit old migration files

## 🚨 Emergency Commands

### If Cloud is Out of Sync
```powershell
# Reset cloud to match local exactly
supabase db reset --linked

# Or pull cloud changes to local
supabase db pull
```

### If Something Goes Wrong
```powershell
# Check what's different
supabase db diff

# See detailed migration history
supabase migration list

# Reset local to start fresh
supabase db reset --local
```

## 📊 Quick Reference

| Task | Command |
|------|---------|
| Create migration | `.\scripts\create-migration.ps1 "name"` |
| Check differences | `.\scripts\check-diff.ps1` |
| Sync to cloud | `.\scripts\sync-to-cloud.ps1` |
| Reset local DB | `supabase db reset --local` |
| Reset cloud DB | `supabase db reset --linked` |
| Check status | `supabase migration list` |

## 🎯 Recommended Workflow

1. **Develop locally** with local Supabase running
2. **Create migrations** for schema changes
3. **Test thoroughly** locally
4. **Check differences** before syncing
5. **Sync to cloud** when ready
6. **Verify** everything works in cloud

This ensures your local changes are always properly applied to your cloud database! 🚀
