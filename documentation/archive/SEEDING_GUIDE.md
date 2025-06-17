# 🌱 Supabase Seeding Guide

This guide covers all the seeding options available for your Supabase database after reset.

## 📁 Seeding Files Location

### SQL Files (Automatic)
- **`docker/dev/seed.sql`** - Comprehensive SQL seeding file
- **`docker/dev/data.sql`** - Enhanced profiles table setup

### Node.js Scripts (Manual)
- **`scripts/seed-database.js`** - Complete seeding with auth users
- **`scripts/add-user.js`** - Add individual users
- **`scripts/add-themis-as-admin.js`** - Add you as admin
- **`scripts/add-themis-as-user.js`** - Add you as regular user

### PowerShell Scripts (Windows)
- **`scripts/reset-and-seed.ps1`** - Complete reset and seeding
- **`scripts/seed-after-reset.ps1`** - Seeding only after reset

### Bash Scripts (Linux/Mac)
- **`docker/reset.sh`** - Enhanced reset script with seeding

## 🚀 Usage Methods

### Method 1: Automatic Reset and Seed (Recommended)

#### PowerShell (Windows):
```powershell
# Complete reset with seeding
.\scripts\reset-and-seed.ps1

# Reset without seeding
.\scripts\reset-and-seed.ps1 -SkipSeed

# Development mode with enhanced seeding
.\scripts\reset-and-seed.ps1 -DevMode
```

#### Bash (Linux/Mac):
```bash
# Complete reset with seeding
cd docker && ./reset.sh --seed

# Reset without seeding  
cd docker && ./reset.sh --no-seed
```

### Method 2: Manual Seeding After Reset

```bash
# After resetting Supabase manually, run:
node scripts/seed-database.js

# Or with PowerShell wrapper:
.\scripts\seed-after-reset.ps1

# Verify seeding only:
.\scripts\seed-after-reset.ps1 -VerifyOnly
```

### Method 3: SQL-Only Seeding (Database Structure Only)

The SQL files are automatically loaded when using development mode:

```bash
cd docker
docker compose -f docker-compose.yml -f dev/docker-compose.dev.yml up -d
```

## 👥 Default Seeded Users

When you run the complete seeding, these users are created:

| Email | Name | Role | Password | Notes |
|-------|------|------|----------|-------|
| baltzakis.themis@gmail.com | Themistoklis Baltzakis | admin | TH!123789th! | Your main account |
| john.doe@example.com | John Doe | admin | AdminPass123! | Test admin |
| mike.admin@example.com | Mike Admin | admin | AdminPass123! | Secondary admin |
| jane.smith@example.com | Jane Smith | moderator | ModPass123! | Test moderator |
| bob.wilson@example.com | Bob Wilson | user | UserPass123! | Test user |
| alice.johnson@example.com | Alice Johnson | user | UserPass123! | Test user |

## 🗃️ Database Structure Created

### Enhanced Profiles Table
```sql
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    website TEXT,
    bio TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS) Policies
- Users can view/edit their own profile
- Admins can view/edit all profiles
- Role changes restricted to admins
- Automatic profile creation on user signup

### Storage Buckets
- **avatars** - Public bucket for user avatars
- **documents** - Private bucket (admin access only)

### Functions & Triggers
- Auto-update `updated_at` timestamp
- Auto-create profile on user registration
- User metadata extraction from auth

## 🔧 Customization

### Adding Your Own Users

Edit `scripts/seed-database.js` and modify the `seedUsers` array:

```javascript
const seedUsers = [
  // Your existing users...
  {
    email: 'newuser@example.com',
    password: 'SecurePass123!',
    firstName: 'New',
    lastName: 'User',
    username: 'newuser',
    role: 'user', // or 'admin', 'moderator'
    bio: 'Description of the user'
  }
]
```

### Modifying SQL Seeding

Edit `docker/dev/seed.sql` to add more users or modify the database structure.

### Adding Custom Roles

1. Update the role constraint in `seed.sql`:
```sql
role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator', 'custom')),
```

2. Update RLS policies for the new role
3. Add users with the new role in seeding scripts

## 🔍 Verification Commands

### Check Seeded Users
```bash
# Via Docker
docker exec -i supabase_db_docker psql -U postgres -d postgres -c "SELECT email, full_name, role, created_at FROM public.profiles ORDER BY role, created_at;"

# Via Node.js
node scripts/seed-database.js --verify-only
```

### User Statistics
```bash
docker exec -i supabase_db_docker psql -U postgres -d postgres -c "SELECT role, COUNT(*) as count FROM public.profiles GROUP BY role ORDER BY role;"
```

### Check Your Admin Status
```bash
docker exec -i supabase_db_docker psql -U postgres -d postgres -c "SELECT * FROM public.profiles WHERE email = 'baltzakis.themis@gmail.com';"
```

## 🛠️ Troubleshooting

### Seeding Fails with JWT Error
- Ensure Supabase containers are fully running
- Check `.env` file has correct `SUPABASE_SERVICE_ROLE_KEY`
- Wait longer for services to be ready before seeding

### Users Created But Can't Login
- Auth users and profiles are separate - ensure both are created
- Check `auth.users` table for actual auth entries
- Verify passwords match what you're using to login

### SQL Seeding Not Working
- Ensure files are in correct Docker volume mounts
- Check Docker logs: `docker logs supabase_db_docker`
- Verify SQL syntax in seed files

### Profile Not Created Automatically
- Check if trigger is installed: `handle_new_user`
- Manually create profile with user management scripts
- Verify RLS policies aren't blocking creation

## 📋 Quick Commands Reference

```bash
# Full reset and seed (PowerShell)
.\scripts\reset-and-seed.ps1

# Full reset and seed (Bash)
cd docker && ./reset.sh --seed

# Seed only (after manual reset)
node scripts/seed-database.js

# Add individual user
node scripts/add-user.js user@example.com John Doe admin

# Verify current users
node scripts/seed-database.js --verify-only

# Check database directly
docker exec -i supabase_db_docker psql -U postgres -d postgres -c "SELECT * FROM public.profiles;"
```

## 🎯 Best Practices

1. **Always backup before reset** - Export important data first
2. **Use development mode** for testing with automatic seeding
3. **Customize default passwords** before production use
4. **Test RLS policies** with different user roles
5. **Monitor Docker logs** during seeding for any errors
6. **Use verification commands** to confirm seeding success

---

**Status**: All seeding files created and ready to use. Your database will be populated with test users after any reset operation.
