# Cloudless.gr Middleware Flow Architecture

## Complete Middleware Flow Diagram

```mermaid
flowchart TD
    A[👤 User Request] --> B[🔍 Static Assets Check]
    
    B --> C{📁 Static Asset?}
    C -->|✅ Yes| D[⚡ Skip Middleware<br/>Continue to Asset]
    C -->|❌ No| E[🌐 Auth Unified Middleware]
    
    E --> F{🏠 Public Route?}
    F -->|✅ Yes| G[🔓 Allow Access<br/>Continue to Route]
    F -->|❌ No| H[🔍 Session Check]
    
    H --> I{🖥️ Client Side?}
    I -->|✅ Yes| J[💾 Check localStorage]
    I -->|❌ No| K[🍪 Check Cookies]
    
    J --> L{📋 Valid Tokens?}
    K --> M{🔐 Valid Session?}
    
    L -->|❌ No| N[🚪 Redirect to Login]
    M -->|❌ No| N
    
    L -->|✅ Yes| O[👑 Check Role Requirements]
    M -->|✅ Yes| O
    
    O --> P{🔒 Admin Required?}
    P -->|✅ Yes| Q{👨‍💼 Is Admin?}
    P -->|❌ No| R{🔐 Auth Required?}
    
    Q -->|❌ No| S[🚪 Redirect to Admin Login]
    Q -->|✅ Yes| T[✅ Continue to Admin Route]
    
    R -->|✅ Yes| U{👤 Authenticated?}
    R -->|❌ No| G
    
    U -->|❌ No| N
    U -->|✅ Yes| V[🎯 Smart Redirects]
    
    V --> W{🏠 Home Page?}
    W -->|✅ Yes & Admin| X[📊 Redirect to Admin Dashboard]
    W -->|✅ Yes & User| Y[📈 Redirect to User Dashboard]
    W -->|❌ No| Z[✅ Continue to Route]
    
    N --> AA[🔐 Login Page]
    S --> BB[👨‍💼 Admin Login Page]
    
    style A fill:#e1f5fe
    style D fill:#c8e6c9
    style G fill:#c8e6c9
    style T fill:#c8e6c9
    style Z fill:#c8e6c9
    style N fill:#ffcdd2
    style S fill:#ffcdd2
    style AA fill:#fff3e0
    style BB fill:#fff3e0
```

## Detailed Middleware Priority Order

```mermaid
gantt
    title Middleware Execution Order
    dateFormat X
    axisFormat %L
    
    section Priority 1
    Static Assets     :1, 5
    
    section Priority 2
    Auth Unified      :6, 25
    
    section Priority 3
    Admin Redirect    :26, 30
    
    section Priority 4
    Admin Required    :31, 35
    
    section Priority 5
    Auth Required     :36, 40
```

## Route Classification Matrix

```mermaid
graph LR
    A[All Routes] --> B[🌐 Public Routes]
    A --> C[🔐 Protected Routes]
    A --> D[👑 Admin Routes]
    A --> E[📁 Static Assets]
    
    B --> B1[/ - Home]
    B --> B2[/about]
    B --> B3[/contact]
    B --> B4[/docs]
    B --> B5[/auth/*]
    
    C --> C1[/dashboard]
    C --> C2[/agents]
    C --> C3[/deploy]
    C --> C4[/builder]
    C --> C5[/workflows]
    
    D --> D1[/admin/*]
    
    E --> E1[/_nuxt/*]
    E --> E2[/api/*]
    E --> E3[/*.js,css,png...]
    
    style B fill:#c8e6c9
    style C fill:#fff3e0
    style D fill:#ffcdd2
    style E fill:#e3f2fd
```

## Authentication State Flow

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    
    Unauthenticated --> CheckingAuth: Request Protected Route
    CheckingAuth --> User: Valid User Token
    CheckingAuth --> Admin: Valid Admin Token
    CheckingAuth --> LoginRedirect: Invalid/Missing Token
    
    User --> Dashboard: Access User Routes
    User --> Unauthorized: Try Access Admin Routes
    
    Admin --> AdminDashboard: Access Admin Routes
    Admin --> Dashboard: Access User Routes
    
    LoginRedirect --> UserLogin: User Route
    LoginRedirect --> AdminLogin: Admin Route
    Unauthorized --> AdminLogin: Admin Access Needed
    
    UserLogin --> User: Successful Auth
    AdminLogin --> Admin: Successful Auth
    
    User --> Unauthenticated: Logout
    Admin --> Unauthenticated: Logout
```

## Middleware Implementation Details

### 1. Static Assets Middleware (Priority 1)
```typescript
// 05.static-assets.global.ts
export default defineNuxtRouteMiddleware((to) => {
  if (isStaticAsset(to.path)) {
    return // Skip all other middleware
  }
})
```

### 2. Unified Auth Middleware (Priority 2)
```typescript
// 02.auth-unified.global.ts
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip static assets (already handled)
  if (isStaticAsset(to.path)) return
  
  // Allow public routes
  if (isPublicRoute(to.path)) return
  
  // Session validation & route protection
  const session = await validateSession()
  
  if (requiresAdmin(to.path) && !isAdmin(session)) {
    return navigateTo('/auth/admin-login')
  }
  
  if (requiresAuth(to.path) && !isAuthenticated(session)) {
    return navigateTo('/auth/login')
  }
})
```

### 3. Smart Redirect Logic
```typescript
// Auto-redirect authenticated users
if (to.path === '/' && session.authenticated) {
  return navigateTo(session.role === 'admin' ? '/admin/dashboard' : '/dashboard')
}

// Prevent authenticated users from accessing auth pages
if (to.path.startsWith('/auth/') && session.authenticated) {
  return navigateTo(getDefaultDashboard(session.role))
}
```

## Performance Optimizations

### Session Caching Strategy
```mermaid
graph TD
    A[Session Request] --> B{In Cache?}
    B -->|✅ Yes| C[Return Cached Session]
    B -->|❌ No| D[Validate with Server]
    D --> E[Cache Result]
    E --> F[Return Session]
    
    G[Cache Cleanup] --> H[Remove Expired]
    
    style C fill:#c8e6c9
    style F fill:#c8e6c9
```

### Token Validation Flow
```mermaid
sequenceDiagram
    participant C as Client
    participant M as Middleware
    participant S as Server
    participant DB as Database
    
    C->>M: Request Protected Route
    M->>M: Check Local Cache
    alt Cache Hit
        M->>C: Allow/Deny Access
    else Cache Miss
        M->>S: Validate Token
        S->>DB: Check Session
        DB->>S: Session Status
        S->>M: Validation Result
        M->>M: Cache Result
        M->>C: Allow/Deny Access
    end
```

## Error Handling & Fallbacks

```mermaid
graph TD
    A[Middleware Error] --> B{Error Type?}
    
    B -->|Network Error| C[Use Cached Session]
    B -->|Invalid Token| D[Clear Session & Redirect]
    B -->|Server Error| E[Allow Access with Warning]
    B -->|Unknown Error| F[Redirect to Safe Route]
    
    C --> G{Cache Available?}
    G -->|✅ Yes| H[Continue with Cache]
    G -->|❌ No| F
    
    style D fill:#ffcdd2
    style F fill:#ffcdd2
    style H fill:#fff3e0
```

## Security Considerations

### 1. **Server-Side Protection**
- HTTP-only cookies for sensitive tokens
- CSRF protection
- Rate limiting on auth endpoints

### 2. **Client-Side Resilience**
- Graceful fallbacks for network errors
- Secure token storage patterns
- Automatic session refresh

### 3. **Route Protection Layers**
```mermaid
graph LR
    A[Route Request] --> B[Middleware Check]
    B --> C[Server Validation]
    C --> D[Component Guard]
    D --> E[API Protection]
    
    style A fill:#e3f2fd
    style B fill:#fff3e0
    style C fill:#fff3e0
    style D fill:#fff3e0
    style E fill:#c8e6c9
```

## Migration Benefits

### Before vs After Comparison
```mermaid
graph TD
    subgraph "❌ Current Issues"
        A1[Multiple Auth Checks]
        A2[Client-Only Security]
        A3[Redundant Code]
        A4[Poor Performance]
    end
    
    subgraph "✅ Optimized Solution"
        B1[Unified Auth System]
        B2[Server-Side Validation]
        B3[Single Source of Truth]
        B4[Cached Sessions]
    end
    
    A1 -.->|Consolidate| B1
    A2 -.->|Enhance| B2
    A3 -.->|Simplify| B3
    A4 -.->|Optimize| B4
```

## Implementation Checklist

- [x] **Static assets middleware** - Skip processing for assets
- [x] **Unified auth middleware** - Single authentication logic
- [x] **Route protection utilities** - Centralized route classification
- [x] **Session caching** - Performance optimization
- [ ] **Server-side session API** - HTTP-only cookie validation
- [ ] **Enhanced error handling** - Graceful fallbacks
- [ ] **Performance monitoring** - Middleware timing metrics
- [ ] **Security audit** - Penetration testing

This architecture provides a robust, scalable, and secure middleware system that follows Nuxt 3 best practices while maintaining excellent performance and user experience.
