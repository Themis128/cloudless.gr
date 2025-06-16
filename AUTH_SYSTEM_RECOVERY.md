# Authentication System Recovery Guide

## Overview

This guide covers the improved authentication and role management system for the Nuxt application with Supabase backend. The system now includes better error handling, type safety, and role-based access control.

## Architecture

### Core Components

1. **Middleware System**
   - `auth.global.ts` - Global authentication guard
   - `admin.ts` - Admin-specific middleware
   - `auth.ts` - User authentication middleware

2. **Composables**
   - `useSupabaseAuth.ts` - Enhanced auth methods with role checking
   - `useAuthGuard.ts` - Advanced auth guards and permissions
   - `useUserProfile.ts` - User profile management

3. **Store**
   - `userStore.ts` - User state management with role support

4. **Types**
   - `auth.d.ts` - TypeScript definitions for auth system

## Key Features

### Role-Based Access Control

The system supports two primary roles:
- `admin` - Full system access including admin panel
- `user` - Standard user access

### Enhanced Authentication Flow

1. **User Login** (`/auth`)
   - Standard user authentication
   - Automatic role detection
   - Redirect to appropriate dashboard

2. **Admin Login** (`/auth/admin-login`)
   - Admin-specific login with role verification
   - Enhanced security checks
   - Direct access to admin panel

### Middleware Protection

- **Global Auth** - Protects all non-public routes
- **Admin Guard** - Ensures admin role for admin routes
- **Route-based** - Different auth levels per route type

## Recovery Scripts

### PowerShell Script
```powershell
.\scripts\fix-auth-system.ps1
```
Options:
- `-CheckOnly` - Run diagnostics without making changes
- `-Force` - Apply fixes without confirmation

### Node.js Script
```bash
node scripts/fix-auth-system.js
```
Options:
- `--check-only` - Run diagnostics only

## Common Issues and Solutions

### 1. No Admin Users Found

**Problem**: System has no admin users, preventing admin access.

**Solution**:
```bash
# Set environment variables
DEFAULT_ADMIN_EMAIL=admin@yourdomain.com
DEFAULT_ADMIN_PASSWORD=secure_password

# Run recovery script
node scripts/fix-auth-system.js
```

### 2. Invalid User Roles

**Problem**: Users have invalid or missing role values.

**Solution**: Recovery script automatically fixes invalid roles by setting them to 'user'.

### 3. Authentication Session Issues

**Problem**: Users get logged out unexpectedly or sessions don't persist.

**Solutions**:
- Check Supabase configuration
- Verify JWT settings
- Ensure proper environment variables

### 4. Middleware Errors

**Problem**: Auth middleware throwing errors or not working correctly.

**Solutions**:
- Verify all middleware files exist
- Check TypeScript compilation
- Review route configurations

## Environment Variables

Required environment variables:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
DEFAULT_ADMIN_EMAIL=admin@yourdomain.com
DEFAULT_ADMIN_PASSWORD=secure_password
```

## Database Schema

### Profiles Table
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### User Info Table
```sql
CREATE TABLE "user-info" (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Usage Examples

### Check User Role in Component
```typescript
<script setup>
import { useAuthGuard } from '~/composables/useAuthGuard'

const { isAdmin, hasRole } = useAuthGuard()

const checkAdminAccess = async () => {
  const isUserAdmin = await isAdmin()
  if (isUserAdmin) {
    // Show admin features
  }
}

const checkSpecificRole = async () => {
  const roleCheck = await hasRole('admin')
  if (roleCheck.hasRole) {
    // User has admin role
  } else if (roleCheck.error) {
    // Handle error
    console.error('Role check failed:', roleCheck.error)
  }
}
</script>
```

### Enhanced Login with Role Check
```typescript
<script setup>
import { useSupabaseAuth } from '~/composables/useSupabaseAuth'

const { signIn } = useSupabaseAuth()

const loginAsAdmin = async () => {
  try {
    // This will check for admin role after authentication
    await signIn(email.value, password.value, true)
    // Redirect to admin dashboard
    await navigateTo('/admin')
  } catch (error) {
    // Handle authentication or role check error
    console.error('Admin login failed:', error)
  }
}
</script>
```

### Using User Store with Roles
```typescript
<script setup>
import { useUserStore } from '~/stores/userStore'

const userStore = useUserStore()
await userStore.fetchUserProfile()

// Check user role
if (userStore.isAdmin()) {
  // Show admin UI
} else if (userStore.isUser()) {
  // Show user UI
}
</script>
```

## Troubleshooting

### Common Error Messages

1. **"Admin access required"**
   - User is authenticated but doesn't have admin role
   - Check user's role in profiles table

2. **"Authentication required"**
   - User session is invalid or expired
   - Redirect to appropriate login page

3. **"Failed to fetch user role"**
   - Database connection issue
   - Missing profiles table entry

### Debugging Steps

1. **Check Database Connection**
   ```bash
   node scripts/fix-auth-system.js --check-only
   ```

2. **Verify Environment Variables**
   ```bash
   # Check if variables are loaded
   echo $SUPABASE_URL
   echo $SUPABASE_ANON_KEY
   ```

3. **Test Authentication Flow**
   - Try logging in as different user types
   - Check browser developer tools for errors
   - Review server logs

4. **Validate Database State**
   ```sql
   -- Check profiles table
   SELECT id, role FROM profiles;
   
   -- Check for users without profiles
   SELECT u.id, u.email 
   FROM auth.users u 
   LEFT JOIN profiles p ON u.id = p.id 
   WHERE p.id IS NULL;
   ```

## Security Considerations

1. **Role Validation**: Always validate roles server-side
2. **JWT Security**: Ensure proper JWT configuration
3. **RLS Policies**: Implement Row Level Security in Supabase
4. **Input Validation**: Validate all auth-related inputs
5. **Session Management**: Proper session timeout and cleanup

## Monitoring

### Health Checks

The recovery script provides comprehensive health checks:
- Database connectivity
- Table existence and accessibility
- User role consistency
- Middleware file presence
- Type definition availability

### Metrics to Monitor

- Authentication success/failure rates
- Role assignment distribution
- Session duration and timeouts
- Middleware performance
- Database query performance

## Maintenance

### Regular Tasks

1. **Weekly**: Run auth system diagnostics
2. **Monthly**: Review user roles and permissions
3. **Quarterly**: Update authentication dependencies
4. **As needed**: Add new roles or permissions

### Updates and Migrations

When updating the auth system:
1. Test in development environment
2. Run recovery script diagnostics
3. Backup user data
4. Apply changes gradually
5. Monitor for issues

## Support

For additional support:
1. Check the recovery script output
2. Review application logs
3. Verify database integrity
4. Test with minimal user cases
5. Consult Supabase documentation
