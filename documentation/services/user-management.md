# User Management Service Documentation

![User Management](https://img.shields.io/badge/users-RBAC-blue?style=flat-square&logo=users)
![Profiles](https://img.shields.io/badge/profiles-automated-green?style=flat-square&logo=user)
![Scripts](https://img.shields.io/badge/scripts-10+-orange?style=flat-square&logo=terminal)
![PostgreSQL](https://img.shields.io/badge/storage-postgresql-336791?style=flat-square&logo=postgresql)

This document consolidates all user management related documentation for the CloudlessGR application.

## Overview

The user management system provides comprehensive tools for managing users, roles, and permissions in the CloudlessGR application. It integrates with Supabase Auth and provides both automated scripts and manual tools for user administration.

## Available Scripts

### 🛡️ Admin Scripts
1. **`scripts/04-setup-user-accounts.js`** - Complete user account setup
2. **`scripts/10-manage-users.js`** - Interactive user management tool

### 👤 User Registration Scripts
Scripts for adding specific users with predefined roles:

1. **Generic Scripts**
   - `scripts/add-user.js` - Add any user with any role
   - `scripts/add-admin.js` - Add admin users

2. **Targeted User Scripts**
   - `scripts/add-themis-as-admin.js` - Add Themistoklis as admin user
   - `scripts/add-themis-as-user.js` - Add Themistoklis as regular user

### 🔧 SQL Scripts
Direct database manipulation scripts:
- `scripts/add-themis-admin.sql` - SQL for admin user creation
- `scripts/add-themis-user.sql` - SQL for regular user creation

### 🖥️ PowerShell Wrappers
Windows-specific automation scripts:
- `scripts/add-themis-admin.ps1` - PowerShell wrapper for admin setup
- `scripts/add-themis-user.ps1` - PowerShell wrapper for user setup

## User Management Features

### Role-Based User Management

The system supports multiple user roles:
- **admin**: Full system access and user management capabilities
- **user**: Standard user access with limited permissions
- **moderator**: Enhanced user access (optional, configurable)

### User Profile Management

User profiles are automatically created and managed through:
1. **Automatic Profile Creation**: Triggered on user registration
2. **Profile Updates**: Users can update their own profiles
3. **Admin Profile Management**: Admins can modify any user profile

## Usage Examples

### Adding an Admin User

**Using Node.js Script:**
```bash
node scripts/add-themis-as-admin.js
```

**Using PowerShell:**
```powershell
.\scripts\add-themis-admin.ps1
```

**Using Direct SQL:**
```sql
-- Run the contents of scripts/add-themis-admin.sql
```

### Adding a Regular User

**Using Node.js Script:**
```bash
node scripts/add-themis-as-user.js
```

**Using PowerShell:**
```powershell
.\scripts\add-themis-user.ps1
```

### Interactive User Management

For comprehensive user management:
```bash
node scripts/10-manage-users.js
```

This script provides:
- List all users
- Add new users
- Update user roles
- Delete users
- Reset user passwords

## User Data Structure

### Profiles Table Schema

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'moderator')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### User Authentication Flow

1. **Registration**: User registers through Supabase Auth
2. **Profile Creation**: Automatic trigger creates profile record
3. **Role Assignment**: Default role assigned (usually 'user')
4. **Admin Approval**: Optional admin approval step
5. **Access Granted**: User gains access based on assigned role

## API Reference

### User Management Functions

#### getUserProfile(userId)
Retrieves user profile information.

```typescript
const profile = await getUserProfile(user.id)
```

#### updateUserProfile(userId, profileData)
Updates user profile information.

```typescript
await updateUserProfile(user.id, {
  full_name: 'New Name',
  avatar_url: 'https://example.com/avatar.jpg'
})
```

#### changeUserRole(userId, newRole)
Changes user role (admin only).

```typescript
await changeUserRole(targetUserId, 'admin')
```

#### listUsers(filters?)
Lists users with optional filtering.

```typescript
const users = await listUsers({ role: 'admin' })
```

## Security & Permissions

### Row Level Security (RLS)

User management implements RLS policies:

1. **Profile Access**: Users can read their own profiles
2. **Profile Updates**: Users can update their own profiles
3. **Admin Access**: Admins can read/update all profiles
4. **Role Changes**: Only admins can change user roles

### Permission Checks

Before performing user management operations:
```typescript
// Check if user is admin
const { hasAdminRole } = useAuthGuard()
if (!hasAdminRole()) {
  throw new Error('Admin access required')
}
```

## Troubleshooting

### Common Issues

#### User Registration Not Working
- Check Supabase Auth configuration
- Verify email confirmations are enabled/disabled as needed
- Review RLS policies on profiles table

#### Profile Creation Failing
- Verify database triggers are in place
- Check profile table constraints
- Review foreign key relationships

#### Role Changes Not Persisting
- Verify RLS policies allow role updates
- Check user permissions
- Review database constraints

### Debug Commands

```bash
# Test user authentication
node scripts/11-test-authentication.js

# Verify user setup
node scripts/05-verify-setup.js

# Check database connectivity
node scripts/06-check-database.js
```

## User Login Resolution

### Common Login Issues

1. **Email Not Confirmed**
   - Check email confirmation requirements
   - Resend confirmation email
   - Verify email service configuration

2. **Password Reset Issues**
   - Check password reset URL configuration
   - Verify email delivery
   - Review password requirements

3. **Session Persistence**
   - Check localStorage/sessionStorage
   - Verify cookie settings
   - Review session timeout

### Resolution Scripts

Use these scripts for login troubleshooting:
```bash
# Test user login flow
node scripts/11-test-authentication.js

# Debug specific user issues
node scripts/debug-user-login.js
```

## Best Practices

### User Data Management
- Always validate user input
- Use prepared statements for SQL operations
- Implement proper error handling
- Log user management actions

### Security
- Regularly audit user roles and permissions
- Implement password complexity requirements
- Use multi-factor authentication where appropriate
- Monitor for suspicious login activity

### Performance
- Index frequently queried user fields
- Implement pagination for user listings
- Cache user profile data appropriately
- Optimize database queries

## Related Files

- `USER_MANAGEMENT.md` (source)
- `USER_LOGIN_RESOLUTION.md` (source)
- Various user management scripts in `/scripts` directory
