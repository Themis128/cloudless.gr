# RBAC Authentication System - Debugging Guide

## Overview

This guide covers the comprehensive debugging, testing, and logging system for the RBAC (Role-Based Access Control) authentication system in the Cloudless.gr application.

## Components Created

### 1. Core RBAC System
- **`composables/useAuth.ts`** - Main authentication composable
- **`stores/authStore.ts`** - Pinia store for auth state management
- **`composables/useRBAC.ts`** - RBAC permission checking composable
- **`utils/rbac-debugger.ts`** - Comprehensive debugging utility

### 2. UI Components
- **`components/auth/LoginForm.vue`** - Login form with validation
- **`components/auth/RegisterForm.vue`** - Registration form with password strength
- **`components/auth/UserProfile.vue`** - User profile management
- **`components/auth/PermissionGuard.vue`** - Conditional rendering based on permissions
- **`components/auth/RoleBasedNav.vue`** - Role-based navigation menu
- **`components/debug/RBACDebugDashboard.vue`** - Real-time debug dashboard

### 3. Pages and Layouts
- **`pages/login.vue`** - Login page
- **`pages/register.vue`** - Registration page
- **`pages/profile.vue`** - User profile page
- **`pages/debug/rbac.vue`** - Debug dashboard page
- **`layouts/auth.vue`** - Authentication layout

### 4. Middleware and API
- **`middleware/auth.ts`** - Route protection middleware
- **`server/middleware/rbac.ts`** - Server-side RBAC middleware

### 5. Testing and Debugging
- **`tests/rbac-auth-comprehensive.spec.js`** - Comprehensive Playwright tests
- **`scripts/run-rbac-tests.ps1`** - PowerShell test runner

## Debugging Features

### 1. Real-time Logging
The RBAC debugger provides comprehensive logging for:
- Authentication events (login, logout, register)
- Permission checks
- Role assignments
- Token refresh operations
- Error tracking

### 2. Debug Dashboard
Access the debug dashboard at `/debug/rbac` to view:
- Real-time system statistics
- Permission analytics
- Recent activity logs
- Performance metrics
- Error tracking

### 3. Console Logging
In development mode, all RBAC operations are logged to the console with:
- Timestamp
- Component name
- Operation type
- Success/failure status
- Detailed error information

## Testing Framework

### 1. Playwright Tests
The comprehensive test suite covers:
- Authentication flow testing
- User registration and login
- Permission-based access control
- Role-based navigation
- API endpoint testing
- Error handling
- Performance testing
- Accessibility testing

### 2. Test Categories
- **Authentication Flow Tests** - Login/register form validation
- **User Registration Tests** - New user creation
- **User Login Tests** - Authentication validation
- **RBAC Permission Tests** - Role-based access control
- **User Profile Tests** - Profile management
- **API Endpoint Tests** - Backend API validation
- **Error Handling Tests** - Network and token errors
- **Performance Tests** - Load time and concurrent access
- **Accessibility Tests** - ARIA labels and keyboard navigation

## Usage Examples

### 1. Using RBAC in Components
```vue
<script setup>
import { useRBAC } from '~/composables/useRBAC'

const { isAdmin, canManageUsers, hasPermission } = useRBAC()
</script>

<template>
  <div v-if="isAdmin">
    <AdminPanel />
  </div>
  
  <PermissionGuard resource="users" action="manage">
    <UserManagement />
  </PermissionGuard>
</template>
```

### 2. Using the Debug Dashboard
```javascript
// Enable debug mode
const { enable, logLogin } = useRBACDebugger()

// Log authentication events
logLogin(userId, email, success, error)

// View real-time logs
const { logs, permissionChecks, authEvents } = useRBACDebugger()
```

### 3. Running Tests
```powershell
# Run all RBAC tests
.\scripts\run-rbac-tests.ps1

# Run specific test types
.\scripts\run-rbac-tests.ps1 -TestType auth
.\scripts\run-rbac-tests.ps1 -TestType permissions
.\scripts\run-rbac-tests.ps1 -TestType api

# Run with verbose logging
.\scripts\run-rbac-tests.ps1 -Verbose
```

## Debugging Common Issues

### 1. Authentication Failures
- Check browser console for detailed error messages
- Verify server is running and accessible
- Check network tab for failed API requests
- Review debug dashboard for authentication events

### 2. Permission Denied Errors
- Verify user has correct roles assigned
- Check permission assignments in database
- Review debug dashboard for permission checks
- Ensure middleware is properly configured

### 3. Performance Issues
- Monitor debug dashboard for slow operations
- Check network requests in browser dev tools
- Review test results for performance metrics
- Verify database query optimization

### 4. Test Failures
- Check server logs for 500 errors
- Verify test data is properly seeded
- Review test screenshots for UI issues
- Check browser console for JavaScript errors

## Environment Configuration

### 1. Development Environment
```bash
# Enable RBAC debugging
export RBAC_DEBUG=true

# Enable verbose logging
export NODE_ENV=development

# Start development server
npm run dev
```

### 2. Test Environment
```bash
# Set testing environment
export TESTING=true

# Enable debug mode for tests
export RBAC_DEBUG=true

# Run tests
npm run test:rbac
```

## Database Schema

The RBAC system uses the following database tables:
- `users` - User accounts
- `roles` - Available roles
- `permissions` - Available permissions
- `user_roles` - User role assignments
- `role_permissions` - Role permission assignments

## Security Considerations

### 1. Token Management
- JWT tokens are stored securely in localStorage
- Automatic token refresh on expiration
- Secure token validation on server-side

### 2. Permission Validation
- Server-side permission checking for all protected routes
- Client-side permission checking for UI rendering
- Comprehensive audit logging of all permission checks

### 3. Role-Based Access
- Hierarchical role system (admin > developer > user)
- Granular permission assignments
- Principle of least privilege enforcement

## Monitoring and Analytics

### 1. Real-time Metrics
- Authentication success/failure rates
- Permission grant/denial rates
- User activity patterns
- System performance metrics

### 2. Audit Trail
- Complete log of all authentication events
- Permission check history
- Role assignment tracking
- Error occurrence patterns

### 3. Performance Monitoring
- Page load times
- API response times
- Database query performance
- Concurrent user handling

## Troubleshooting Checklist

- [ ] Server is running and accessible
- [ ] Database is properly seeded with roles and permissions
- [ ] User accounts have correct role assignments
- [ ] RBAC debug mode is enabled
- [ ] Browser console shows no JavaScript errors
- [ ] Network requests are successful
- [ ] Debug dashboard shows expected activity
- [ ] Tests are passing
- [ ] Permissions are correctly configured
- [ ] Middleware is properly applied

## Support and Maintenance

### 1. Regular Maintenance
- Monitor debug dashboard for anomalies
- Review test results regularly
- Update permission assignments as needed
- Clean up old logs periodically

### 2. Performance Optimization
- Monitor slow queries in debug logs
- Optimize database indexes
- Review API response times
- Implement caching where appropriate

### 3. Security Updates
- Regular security audits
- Update dependencies
- Review permission assignments
- Monitor for suspicious activity

This comprehensive debugging system provides full visibility into the RBAC authentication system, making it easy to identify and resolve issues quickly. 