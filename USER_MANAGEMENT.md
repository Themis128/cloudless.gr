# User Management Scripts for Themistoklis Baltzakis

## 📋 Available Scripts

### 🛡️ Admin Scripts
1. **`scripts/add-themis-as-admin.js`** - Add you as admin user (Node.js)
2. **`scripts/add-themis-admin.sql`** - Add you as admin user (SQL)
3. **`scripts/add-themis-admin.ps1`** - PowerShell wrapper for admin setup

### 👤 User Scripts
1. **`scripts/add-themis-as-user.js`** - Add you as regular user (Node.js)
2. **`scripts/add-themis-user.sql`** - Add you as regular user (SQL)
3. **`scripts/add-themis-user.ps1`** - PowerShell wrapper for user setup

### 🔧 Generic Scripts
1. **`scripts/add-user.js`** - Add any user with any role
2. **`scripts/add-admin.js`** - Original admin script (generic)

## 🚀 Usage Examples

### Quick Admin Setup (Your Details)
```bash
# Node.js approach
node scripts/add-themis-as-admin.js

# PowerShell approach  
.\scripts\add-themis-admin.ps1

# Direct SQL approach
docker exec -i supabase_db_docker psql -U postgres -d postgres -f scripts/add-themis-admin.sql
```

### Quick User Setup (Your Details)
```bash
# Node.js approach
node scripts/add-themis-as-user.js

# PowerShell approach
.\scripts\add-themis-user.ps1

# Direct SQL approach
docker exec -i supabase_db_docker psql -U postgres -d postgres -f scripts/add-themis-user.sql
```

### Generic User Addition
```bash
# Add any user as admin
node scripts/add-user.js john@example.com John Doe admin

# Add any user as regular user
node scripts/add-user.js jane@example.com Jane Smith user

# Add user with custom password
node scripts/add-user.js bob@example.com Bob Wilson moderator mypassword123
```

## ✅ Current Status

**Your Account**: baltzakis.themis@gmail.com
- **Status**: ✅ **ALREADY SET UP AS ADMIN** 
- **User ID**: `abf0f77d-d299-4454-8e3a-0e4595b74e39`
- **Role**: `admin`
- **Created**: 2025-06-15 22:01:22 UTC

## 🔍 Verification Commands

### Check Your Current Status
```bash
# Via Docker SQL
docker exec -i supabase_db_docker psql -U postgres -d postgres -c "SELECT email, role, created_at FROM public.profiles WHERE email = 'baltzakis.themis@gmail.com';"

# Via SQL file
docker exec -i supabase_db_docker psql -U postgres -d postgres -f scripts/quick-keys.sql
```

### List All Users
```bash
docker exec -i supabase_db_docker psql -U postgres -d postgres -c "SELECT p.email, p.full_name, p.role, p.created_at FROM public.profiles p ORDER BY p.created_at;"
```

### List All Admins
```bash
docker exec -i supabase_db_docker psql -U postgres -d postgres -c "SELECT p.email, p.full_name, p.created_at FROM public.profiles p WHERE p.role = 'admin';"
```

## ⚙️ Configuration

### Your Default Credentials
- **Email**: baltzakis.themis@gmail.com
- **Password**: TH!123789th! (as set in scripts)
- **Name**: Themistoklis Baltzakis

### Environment Requirements
Scripts require these environment variables in your `.env`:
```env
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9zZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

## 🛠️ Troubleshooting

### If Node.js Scripts Fail
- Use SQL scripts directly via Docker
- Check that Supabase containers are running: `docker ps`
- Verify environment variables in `.env`

### If You Need to Reset Your Role
```bash
# Change from admin to user
docker exec -i supabase_db_docker psql -U postgres -d postgres -c "UPDATE public.profiles SET role = 'user' WHERE email = 'baltzakis.themis@gmail.com';"

# Change from user to admin
docker exec -i supabase_db_docker psql -U postgres -d postgres -c "UPDATE public.profiles SET role = 'admin' WHERE email = 'baltzakis.themis@gmail.com';"
```

---
**Status**: ✅ All scripts created and ready to use. You are currently set up as admin.
