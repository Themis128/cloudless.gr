# Authentication & Authorization Service Documentation

![Auth Status](https://img.shields.io/badge/auth-supabase-green?style=flat-square&logo=supabase)
![RBAC](https://img.shields.io/badge/RBAC-enabled-blue?style=flat-square&logo=shield)
![TypeScript](https://img.shields.io/badge/typescript-ready-blue?style=flat-square&logo=typescript)
![Security](https://img.shields.io/badge/security-RLS-red?style=flat-square&logo=security)
![Middleware](https://img.shields.io/badge/middleware-protected-orange?style=flat-square&logo=nuxtdotjs)

This document consolidates all authentication and authorization related documentation for the CloudlessGR application.

## Overview

The authentication system uses Supabase Auth with role-based access control (RBAC). It includes comprehensive error handling, type safety, and role-based access control.

## Architecture

### System Overview

```mermaid
graph TB
    subgraph "Frontend - Nuxt 3"
        A[Pages] --> B[Middleware]
        B --> C[Composables]
        C --> D[Store]
        D --> E[Components]
    end
    
    subgraph "Authentication Layer"
        F[auth.global.ts] --> G[admin.ts]
        G --> H[auth.ts]
        I[useSupabaseAuth] --> J[useAuthGuard]
        J --> K[useUserProfile]
    end
    
    subgraph "Backend - Supabase"
        L[Auth Service] --> M[Database]
        M --> N[RLS Policies]
        N --> O[profiles Table]
    end
    
    B --> F
    C --> I
    I --> L
    L --> M
    
    style A fill:#e1f5fe
    style L fill:#e8f5e8
    style M fill:#fff3e0
```

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

## Authentication System Recovery

### Role-Based Access Control

```mermaid
erDiagram
    USER ||--|| PROFILE : has
    PROFILE {
        uuid id PK
        string email
        string full_name
        enum role
        string avatar_url
        timestamp created_at
        timestamp updated_at
    }
    
    USER {
        uuid id PK
        string email
        timestamp created_at
        json raw_user_meta_data
    }
    
    ROLE_PERMISSIONS ||--o{ PROFILE : defines
    ROLE_PERMISSIONS {
        string role PK
        json permissions
        string description
    }
```

### Permission Matrix

```mermaid
graph LR
    subgraph "Roles & Permissions"
        A[admin] --> A1[Full System Access]
        A --> A2[User Management]
        A --> A3[Database Admin]
        A --> A4[System Configuration]
        
        B[moderator] --> B1[Content Management]
        B --> B2[User Moderation]
        B --> B3[Reports Access]
        
        C[user] --> C1[Profile Management]
        C --> C2[Standard Features]
        C --> C3[Read Access]
    end
    
    style A fill:#ffcdd2
    style B fill:#fff3e0
    style C fill:#e8f5e8
```

The system supports multiple user roles:
- **admin**: Full system access
- **user**: Standard user access
- **moderator**: Enhanced user access (optional)

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Middleware
    participant Supabase
    participant Database
    
    User->>Frontend: Navigate to protected route
    Frontend->>Middleware: Check authentication
    
    alt User not authenticated
        Middleware->>Frontend: Redirect to login
        Frontend->>User: Show login form
        User->>Frontend: Submit credentials
        Frontend->>Supabase: signIn(email, password)
        Supabase->>Database: Validate credentials
        Database->>Supabase: Return user data
        Supabase->>Frontend: Authentication token
        Frontend->>Database: Get user profile
        Database->>Frontend: Return profile with role
        Frontend->>User: Access granted
    else User authenticated
        Middleware->>Database: Get user role
        Database->>Middleware: Return role
        
        alt Has required role
            Middleware->>Frontend: Allow access
            Frontend->>User: Show protected content
        else Insufficient permissions
            Middleware->>Frontend: Access denied
            Frontend->>User: Show permission error
        end
    end
```

### Role-Based Access Control Flow

```mermaid
flowchart TD
    A[User Request] --> B{Authenticated?}
    B -->|No| C[Redirect to Login]
    B -->|Yes| D[Get User Role]
    
    D --> E{Check Route Permissions}
    E -->|Public| F[Allow Access]
    E -->|User Required| G{Is User Role?}
    E -->|Admin Required| H{Is Admin Role?}
    E -->|Moderator Required| I{Is Moderator Role?}
    
    G -->|Yes| F
    G -->|No| J[Access Denied]
    
    H -->|Yes| F
    H -->|No| J
    
    I -->|Yes| F
    I -->|No| J
    
    C --> K[Login Form]
    K --> L[Supabase Auth]
    L --> M{Valid Credentials?}
    M -->|Yes| N[Create/Update Profile]
    M -->|No| O[Show Error]
    N --> P[Set Default Role]
    P --> D
    
    style F fill:#e8f5e8
    style J fill:#ffebee
    style L fill:#e3f2fd
```

1. **User Registration/Login**
   - Users authenticate through Supabase Auth
   - Profile is automatically created in `profiles` table
   - Default role is assigned based on configuration

2. **Role Assignment**
   - Roles are stored in the `profiles.role` field
   - Admin users can modify roles through admin interface
   - Role changes are immediately reflected in the application

3. **Access Control**
   - Middleware checks user roles before page access
   - Composables provide role-checking utilities
   - API routes validate user permissions

## Authentication Validation Checklist

### Pre-Setup Validation
- [ ] Supabase project is created and accessible
- [ ] Environment variables are properly configured
- [ ] Database tables exist and are properly structured
- [ ] RLS policies are correctly implemented

### Post-Setup Validation
- [ ] User registration works correctly
- [ ] User login/logout functions properly
- [ ] Role-based access control is enforced
- [ ] Admin functions are restricted to admin users
- [ ] Session persistence works across page reloads

### Common Issues and Solutions

#### "Failed to fetch" Errors
**Symptoms:**
- Browser console shows `Failed to fetch` errors
- Authentication requests fail

**Solutions:**
1. Check Supabase service status
2. Verify environment variables
3. Restart Supabase containers
4. Check network connectivity

#### Role Assignment Issues
**Symptoms:**
- Users don't have correct roles
- Permission denied errors

**Solutions:**
1. Verify profile creation triggers
2. Check RLS policies
3. Validate role assignment logic
4. Review database constraints

## Admin Setup Guide

### Setup Process Flow

```mermaid
flowchart TD
    A[Start Setup] --> B[Create .env File]
    B --> C[Get Supabase Credentials]
    C --> D[Configure Environment Variables]
    D --> E[Run Setup Scripts]
    
    E --> F{Database Tables Exist?}
    F -->|No| G[Create Tables]
    F -->|Yes| H[Setup User Accounts]
    
    G --> H
    H --> I[Create Admin User]
    I --> J[Assign Admin Role]
    J --> K[Verify Setup]
    
    K --> L{Setup Successful?}
    L -->|Yes| M[Setup Complete]
    L -->|No| N[Troubleshoot Issues]
    N --> O[Check Logs]
    O --> P[Fix Configuration]
    P --> E
    
    style M fill:#e8f5e8
    style N fill:#ffebee
    style A fill:#e3f2fd
```

### Environment Configuration Steps

```mermaid
graph TB
    subgraph "Step 1: Environment Setup"
        A1[Create .env file] --> A2[Add SUPABASE_URL]
        A2 --> A3[Add SUPABASE_ANON_KEY]
        A3 --> A4[Add SUPABASE_SERVICE_ROLE_KEY]
    end
    
    subgraph "Step 2: Supabase Dashboard"
        B1[Login to Supabase] --> B2[Select Project]
        B2 --> B3[Go to Settings → API]
        B3 --> B4[Copy Project URL]
        B4 --> B5[Copy anon public key]
        B5 --> B6[Copy service_role key]
    end
    
    subgraph "Step 3: Script Execution"
        C1[Run setup script] --> C2[node scripts/04-setup-user-accounts.js]
        C1 --> C3[.\scripts\04-setup-user-accounts.ps1]
    end
    
    A4 --> B1
    B6 --> C1
    
    style A1 fill:#e8f5e8
    style B1 fill:#e3f2fd
    style C1 fill:#fff3e0
```

### Step 1: Environment Configuration

Create a `.env` file in the root directory:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Step 2: Get Supabase Credentials

1. Go to your Supabase dashboard (https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy the following:
   - Project URL → SUPABASE_URL
   - Project API keys → anon public → SUPABASE_ANON_KEY
   - Project API keys → service_role (secret) → SUPABASE_SERVICE_ROLE_KEY

### Step 3: Admin User Creation

Run the admin setup script:
```bash
node scripts/04-setup-user-accounts.js
```

Or use the PowerShell version:
```powershell
.\scripts\04-setup-user-accounts.ps1
```

## Security Best Practices

### Environment Variables
- Never commit `.env` files to version control
- Use different keys for development and production
- Rotate service role keys regularly

### Role-Based Access Control
- Implement principle of least privilege
- Regularly audit user roles and permissions
- Use middleware for consistent access control

### Authentication Flow
- Implement proper session management
- Use secure password policies
- Enable multi-factor authentication where appropriate

## API Reference

### Authentication Composables

#### useSupabaseAuth()
```typescript
const { user, signIn, signOut, signUp, updateProfile } = useSupabaseAuth()
```

#### useAuthGuard()
```typescript
const { requireAuth, requireRole, hasPermission } = useAuthGuard()
```

### Middleware Usage

#### Global Auth Middleware
```typescript
// auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  // Global authentication logic
})
```

#### Admin Middleware
```typescript
// admin.ts
export default defineNuxtRouteMiddleware(() => {
  // Admin-only access logic
})
```

## Troubleshooting

### Common Issues Flowchart

```mermaid
flowchart TD
    A[Authentication Issue] --> B{Type of Issue?}
    
    B -->|Session Problems| C[Session Not Persisting]
    B -->|Role Problems| D[Role Permissions Not Working]
    B -->|Redirect Problems| E[Login Redirects Not Working]
    B -->|Fetch Errors| F[Failed to Fetch Errors]
    
    C --> C1[Check localStorage/sessionStorage]
    C1 --> C2[Verify cookie settings]
    C2 --> C3[Review session timeout]
    
    D --> D1[Validate RLS policies]
    D1 --> D2[Check role assignment logic]
    D2 --> D3[Review middleware implementation]
    
    E --> E1[Verify redirect URLs in Supabase]
    E1 --> E2[Check route middleware config]
    E2 --> E3[Review auth flow logic]
    
    F --> F1[Check Supabase service status]
    F1 --> F2[Verify environment variables]
    F2 --> F3[Restart Supabase containers]
    F3 --> F4[Check network connectivity]
    
    C3 --> G[Test Fix]
    D3 --> G
    E3 --> G
    F4 --> G
    
    G --> H{Issue Resolved?}
    H -->|Yes| I[Success]
    H -->|No| J[Check Debug Tools]
    
    J --> K[node scripts/11-test-authentication.js]
    K --> L[node scripts/05-verify-setup.js]
    L --> M[Review Logs]
    M --> N[Contact Support]
    
    style I fill:#e8f5e8
    style N fill:#ffebee
    style A fill:#e3f2fd
```

### Debugging Workflow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Tools as Debug Tools
    participant Scripts as Test Scripts
    participant Logs as System Logs
    participant Fix as Solution
    
    Dev->>Tools: Run diagnostic
    Tools->>Scripts: Execute test scripts
    Scripts->>Logs: Generate detailed logs
    Logs->>Dev: Show error details
    
    Dev->>Fix: Apply solution
    Fix->>Scripts: Re-run tests
    Scripts->>Dev: Confirm resolution
    
    Note over Dev,Fix: Iterative debugging process
```

### Common Authentication Issues

1. **Session not persisting**
   - Check localStorage/sessionStorage
   - Verify cookie settings
   - Review session timeout configuration

2. **Role permissions not working**
   - Validate RLS policies
   - Check role assignment logic
   - Review middleware implementation

3. **Login redirects not working**
   - Verify redirect URLs in Supabase dashboard
   - Check route middleware configuration
   - Review authentication flow logic

### Debug Tools

Use the built-in debugging tools:
```bash
# Test authentication status
node scripts/11-test-authentication.js

# Verify user setup
node scripts/05-verify-setup.js
```

## Related Files

- `AUTH_SYSTEM_RECOVERY.md` (source)
- `AUTH_VALIDATION_CHECKLIST.md` (source)
- `ADMIN_SETUP.md` (source)
- `admin-keys-report.md` (source)
