# Role-Based Access Control (RBAC) System

## Overview

The RBAC system provides fine-grained access control for the Cloudless.gr application. It allows administrators to define roles with specific permissions and assign them to users, ensuring secure access to different parts of the application.

## Architecture

### Core Components

1. **Roles**: Named collections of permissions (e.g., "admin", "user", "developer")
2. **Permissions**: Granular access rights (e.g., "bot:create", "user:read")
3. **User Roles**: Assignments of roles to users with optional expiration
4. **Role Permissions**: Mappings between roles and their permissions

### Database Schema

```sql
-- Roles table
roles (id, name, description, isActive, createdAt, updatedAt)

-- Permissions table
permissions (id, name, description, resource, action, isActive, createdAt, updatedAt)

-- Role-Permission mappings
role_permissions (id, roleId, permissionId, createdAt)

-- User-Role assignments
user_roles (id, userId, roleId, assignedBy, assignedAt, expiresAt, isActive)
```

## Default Roles and Permissions

### Roles

1. **Admin**: Full system administrator with all permissions
2. **User**: Standard user with basic permissions
3. **Developer**: Extended permissions for development tasks

### Permission Categories

#### User Management
- `user:read` - Read user information
- `user:create` - Create new users
- `user:update` - Update user information
- `user:delete` - Delete users

#### Bot Management
- `bot:read` - Read bot information
- `bot:create` - Create new bots
- `bot:update` - Update bot information
- `bot:delete` - Delete bots
- `bot:deploy` - Deploy bots

#### Model Management
- `model:read` - Read model information
- `model:create` - Create new models
- `model:update` - Update model information
- `model:delete` - Delete models
- `model:train` - Train models

#### Pipeline Management
- `pipeline:read` - Read pipeline information
- `pipeline:create` - Create new pipelines
- `pipeline:update` - Update pipeline information
- `pipeline:delete` - Delete pipelines
- `pipeline:execute` - Execute pipelines

#### Administrative
- `admin:all` - Full administrative access
- `admin:users` - Manage users
- `admin:roles` - Manage roles and permissions
- `admin:analytics` - Access analytics
- `admin:system` - System administration

## Usage

### Server-Side (API Routes)

#### Using RBAC Middleware

```typescript
import { requirePermission, requireAdmin } from '~/server/middleware/rbac'

// Protect route with specific permission
export default defineEventHandler(async (event) => {
  await requirePermission({ resource: 'bot', action: 'create' })(event)
  // Route logic here
})

// Protect route with admin access
export default defineEventHandler(async (event) => {
  await requireAdmin()(event)
  // Admin-only logic here
})

// Check multiple permissions
export default defineEventHandler(async (event) => {
  await requirePermission({
    permissions: [
      { resource: 'bot', action: 'read' },
      { resource: 'model', action: 'read' }
    ],
    requireAll: false // Any permission is sufficient
  })(event)
  // Route logic here
})
```

#### Direct Permission Checks

```typescript
import { rbacService } from '~/server/utils/rbac-service'

// Check single permission
const canCreateBot = await rbacService.hasPermission(userId, 'bot', 'create')

// Check multiple permissions
const canManageBots = await rbacService.hasAllPermissions(userId, [
  { resource: 'bot', action: 'create' },
  { resource: 'bot', action: 'update' },
  { resource: 'bot', action: 'delete' }
])

// Get user permissions
const permissions = await rbacService.getUserPermissions(userId)
```

### Client-Side (Vue Components)

#### Using RBAC Composable

```vue
<template>
  <div>
    <!-- Show admin panel only to admins -->
    <div v-if="isAdmin">
      <AdminPanel />
    </div>
    
    <!-- Show create button only to users with permission -->
    <v-btn v-if="canCreateBots" @click="createBot">
      Create Bot
    </v-btn>
    
    <!-- Conditional rendering based on permissions -->
    <div v-if="hasPermission('bot', 'delete')">
      <DeleteButton @click="deleteBot" />
    </div>
  </div>
</template>

<script setup>
const { 
  isAdmin, 
  canCreateBots, 
  hasPermission,
  fetchUserRBAC 
} = useRBAC()

// Fetch RBAC data on component mount
onMounted(() => {
  fetchUserRBAC()
})
</script>
```

#### Route Guards

```typescript
// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const { isAdmin, hasPermission } = useRBAC()
  
  // Protect admin routes
  if (to.path.startsWith('/admin') && !isAdmin.value) {
    return navigateTo('/auth/login')
  }
  
  // Protect specific routes based on permissions
  if (to.path === '/bots/create' && !hasPermission('bot', 'create')) {
    return navigateTo('/bots')
  }
})
```

## API Endpoints

### Authentication & RBAC
- `GET /api/auth/permissions` - Get current user's permissions
- `GET /api/auth/roles` - Get current user's roles

### Admin Management
- `GET /api/admin/roles` - Get all roles (requires user management permission)
- `POST /api/admin/roles` - Create new role (requires user management permission)
- `POST /api/admin/users/[id]/roles` - Assign role to user (requires user management permission)

## Management Functions

### Creating Custom Roles

```typescript
import { rbacService } from '~/server/utils/rbac-service'

// Create a new role
const roleId = await rbacService.createRole(
  'moderator',
  'Content moderator with limited permissions',
  [1, 2, 3] // Permission IDs
)
```

### Assigning Roles to Users

```typescript
// Assign role to user
await rbacService.assignRole(
  userId,
  roleId,
  assignedByUserId, // Optional: who assigned this role
  new Date('2024-12-31') // Optional: expiration date
)
```

### Checking Permissions

```typescript
// Check if user can perform action
const canDeleteBot = await rbacService.hasPermission(userId, 'bot', 'delete')

// Check multiple permissions
const canManageContent = await rbacService.hasAllPermissions(userId, [
  { resource: 'bot', action: 'create' },
  { resource: 'bot', action: 'update' },
  { resource: 'bot', action: 'delete' }
])
```

## Security Features

### Session Management
- JWT tokens with expiration
- Session tracking with IP and user agent
- Automatic session invalidation on password reset

### Rate Limiting
- Login attempts: 5 per 15 minutes
- Registration: 3 per hour
- API endpoints: Configurable per endpoint

### Account Protection
- Account lockout after 5 failed login attempts
- 15-minute lockout period
- Email verification requirement for new users

### Audit Trail
- Login history tracking
- Role assignment tracking
- Permission usage logging

## Best Practices

### Permission Design
1. Use resource:action format (e.g., "bot:create")
2. Keep permissions granular but not excessive
3. Use descriptive permission names
4. Group related permissions logically

### Role Design
1. Create roles based on job functions, not individuals
2. Use the principle of least privilege
3. Regularly review and update role assignments
4. Document role purposes and responsibilities

### Security Considerations
1. Always verify permissions server-side
2. Use client-side checks for UI only
3. Implement proper session management
4. Regular security audits of role assignments
5. Monitor for unusual permission usage patterns

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Check if user has the required role
   - Verify role has the required permission
   - Check if role assignment is active and not expired

2. **Role Assignment Issues**
   - Ensure role exists and is active
   - Check for duplicate role assignments
   - Verify assignment expiration dates

3. **Session Problems**
   - Check JWT token validity
   - Verify session is active in database
   - Check for session expiration

### Debug Commands

```bash
# Initialize RBAC system
npm run script:initialize-rbac

# Check user permissions
npm run script:check-user-permissions --userId=1

# List all roles and permissions
npm run script:list-rbac
```

## Migration and Setup

### Initial Setup

1. Run database migrations to create RBAC tables
2. Initialize default roles and permissions
3. Assign admin role to existing admin user
4. Test permission system with different user types

### Adding New Permissions

1. Add permission to database
2. Update role-permission mappings
3. Update client-side permission checks
4. Test with affected users

### Role Updates

1. Modify role permissions as needed
2. Update affected users if necessary
3. Communicate changes to users
4. Monitor for any access issues 