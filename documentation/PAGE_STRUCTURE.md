# Page Structure and Access Control

## Overview
This document clarifies the page structure and access control for the Cloudless.gr application.

## Page Hierarchy

### 🌐 Public Pages (No Authentication Required)
- `/` - Landing page with hero section and marketing content
- `/info/*` - Information pages (about, contact, FAQ, etc.)
- `/documentation/*` - API docs, user guides, troubleshooting
- `/auth/*` - Authentication pages (login, register, reset password)

### 👤 User Pages (Authentication Required)
- `/users/*` - User dashboard and profile management
- `/projects/*` - Project creation and management
- `/storage/*` - File storage interface
- `/settings/*` - User settings and preferences

### 🛡️ Admin Pages (Admin Role Required)
- `/admin/*` - Standard admin interface (modern Vue/Vuetify design)
- `/sys/*` - System administration (advanced admin features)
- `/admin/docs/*` - **Admin-only documentation** (protected access)

## Admin Page Structure

### `/admin/*` - Primary Admin Interface
- `/admin/index.vue` - Main admin dashboard with overview stats
- `/admin/users.vue` - User management interface
- `/admin/settings.vue` - Admin settings
- `/admin/monitor.vue` - System monitoring
- `/admin/docs/*` - **Protected admin documentation**

### `/sys/*` - System Administration
- `/sys/index.vue` - Advanced system admin with full user management
- `/sys/maintenance.vue` - System maintenance tools

## Access Control Rules

### Middleware Configuration
- `auth.global.ts` - Global authentication middleware
- `admin.ts` - Admin-only access middleware

### Public Routes (No Auth Required)
```typescript
const publicRoutes = [
  '/',
  '/info/*',
  '/documentation/*',
  '/auth/*'
]
```

### Admin Routes (Admin Role Required)
```typescript
const adminRoutes = ['/admin', '/sys']
```

### Special Access Rules
- **Admin users** have access to ALL pages (both admin and user pages)
- **Regular users** can only access user pages and public pages
- **Unauthenticated users** can only access public pages

## 🔒 Admin Documentation Security

### Protected Routes
- `/admin/docs/*` - **ADMIN ONLY** - Comprehensive administrative documentation
- Includes system architecture, page structure, store documentation, and development guides
- Protected by admin middleware and component-level guards

### Public vs Admin Documentation
- **Public Documentation** (`/documentation/*`) - User guides, API reference, getting started
- **Admin Documentation** (`/admin/docs/*`) - System administration, architecture, development guides
- Clear separation ensures sensitive information is only available to administrators

### Access Control Implementation
- **Route Level**: `/admin/docs/*` protected by admin middleware
- **Component Level**: Pages check `authStore.isAdmin` and throw 403 errors for non-admin users
- **Navigation**: Admin documentation links only visible to admin users
- **Error Handling**: Non-admin access attempts result in proper 403 Forbidden responses

## Page Conflicts Resolved

### Removed Duplicate Files
- `index-backup.vue` - Removed (backup no longer needed)
- `test-navigation.vue` - Removed (test file)
- `admin/dashboard.vue` - Consolidated into `admin/index.vue`
- `admin/login.vue` - Use `auth/admin-login.vue` instead

### Consolidated Admin Structure
- **Primary admin interface**: `/admin/*` for standard admin operations
- **System admin interface**: `/sys/*` for advanced system administration
- Both interfaces use the same stores (`authStore`, `adminStore`) for consistency

## Navigation Structure

### Admin Navigation (Floating Nav Button)
When user is admin, shows:
- Dashboard link
- Admin badge
- Access to both `/admin` and `/sys` areas

### User Navigation
Standard user navigation without admin features

## Authentication Flow

1. **Login** → User authenticated via `authStore`
2. **Role Check** → Admin status checked via `authStore.isAdmin`
3. **Route Protection** → Middleware enforces access rules
4. **Success Messages** → Displayed on successful admin login

## Store Structure

### AuthStore (`authStore.ts`)
- Handles authentication state
- Provides `isAdmin` computed property
- Manages success/error messages

### AdminStore (`adminStore.ts`)
- Admin-specific functionality
- User management operations
- System health monitoring

### UserStore (`userStore.ts`)
- User-specific functionality
- Profile management
- User preferences
