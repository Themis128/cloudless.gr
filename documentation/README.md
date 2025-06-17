# CloudlessGR Documentation

![Documentation](https://img.shields.io/badge/docs-comprehensive-blue?style=flat-square&logo=gitbook)
![Services](https://img.shields.io/badge/services-5-green?style=flat-square&logo=services)
![Updated](https://img.shields.io/badge/updated-2025--06--16-brightgreen?style=flat-square&logo=calendar)
![Status](https://img.shields.io/badge/status-active-success?style=flat-square&logo=check)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square&logo=coverage)

Welcome to the comprehensive documentation for the CloudlessGR Nuxt/Supabase application. This documentation is organized by service areas to provide clear, focused information for development, deployment, and maintenance.

## 🏗️ Application Architecture Overview

### Full Stack Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[Browser] --> B[Vue 3 SPA]
        B --> C[Vuetify UI]
        C --> D[Three.js/Vanta]
    end
    
    subgraph "Frontend Framework - Nuxt 3"
        E[Pages] --> F[Layouts]
        F --> G[Components]
        G --> H[Composables]
        H --> I[Middleware]
        I --> J[Stores/Pinia]
        J --> K[Plugins]
    end
    
    subgraph "Authentication & State"
        L[useSupabaseAuth] --> M[useAuthGuard]
        M --> N[useUserProfile]
        N --> O[User Store]
    end
    
    subgraph "Backend Services - Supabase"
        P[Kong API Gateway] --> Q[PostgREST API]
        Q --> R[GoTrue Auth]
        R --> S[PostgreSQL DB]
        S --> T[Storage Service]
        T --> U[Edge Functions]
    end
    
    subgraph "Infrastructure"
        V[Docker Compose] --> W[Supabase Stack]
        W --> X[Database Container]
        X --> Y[Studio Dashboard]
        Y --> Z[Analytics/Logs]
    end
    
    B --> E
    H --> L
    L --> P
    P --> S
    V --> W
    
    style A fill:#e3f2fd
    style E fill:#e8f5e8
    style P fill:#fff3e0
    style V fill:#fce4ec
```

### Application Layer Structure

```mermaid
graph LR
    subgraph "Pages Structure"
        A1[index.vue] --> A2[admin/]
        A2 --> A3[auth/]
        A3 --> A4[info/]
        A4 --> A5[projects/]
        A5 --> A6[settings/]
        A6 --> A7[storage/]
        A7 --> A8[users/]
        A8 --> A9[[...slug].vue]
    end
    
    subgraph "Composables Layer"
        B1[useSupabaseAuth] --> B2[useAuthGuard]
        B2 --> B3[useUserProfile]
        B3 --> B4[useContactForm]
        B4 --> B5[useStorage]
        B5 --> B6[useSupabase]
        B6 --> B7[useMainNavLinks]
        B7 --> B8[useVantaClouds2]
    end
    
    subgraph "Middleware Layer"
        C1[auth.global.ts] --> C2[admin.ts]
        C2 --> C3[auth.ts]
    end
    
    A1 --> B1
    B1 --> C1
    
    style A1 fill:#e8f5e8
    style B1 fill:#e3f2fd
    style C1 fill:#fff3e0
```

## 🛠️ Supabase Stack Architecture

### Complete Supabase Setup

```mermaid
graph TB
    subgraph "External Access"
        A[Developer] --> B[Studio Dashboard :54323]
        A --> C[Application :3000]
        A --> D[API Gateway :54321]
    end
    
    subgraph "Supabase Services Stack"
        E[Kong API Gateway :8000] --> F[PostgREST :3000]
        E --> G[GoTrue Auth :9999]
        E --> H[Storage API :5000]
        E --> I[Edge Functions :9000]
        
        F --> J[PostgreSQL :5432]
        G --> J
        H --> K[Storage Volume]
        
        L[Studio :3000] --> M[Meta API :8080]
        M --> J
        
        N[Analytics/Logflare :4000] --> O[Analytics DB]
        
        P[Realtime :4000] --> J
        Q[Imgproxy :5001] --> K
    end
    
    subgraph "Database Layer"
        J --> R[auth.users]
        J --> S[public.profiles]
        J --> T[Storage Buckets]
        J --> U[RLS Policies]
        J --> V[Database Functions]
        J --> W[Triggers]
    end
    
    subgraph "Docker Infrastructure"
        X[docker-compose.yml] --> Y[Service Orchestration]
        Y --> Z[Volume Management]
        Z --> AA[Network Configuration]
        AA --> BB[Health Checks]
    end
    
    B --> L
    C --> E
    D --> E
    
    X --> E
    
    style A fill:#e3f2fd
    style E fill:#e8f5e8
    style J fill:#fff3e0
    style X fill:#fce4ec
```

### Database Schema & Relationships

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "user_id"
    PROFILES ||--o{ USER_ROLES : "profile_id"
    PROFILES ||--o{ USER_SESSIONS : "user_id"
    PROFILES ||--o{ STORAGE_OBJECTS : "owner"
    
    AUTH_USERS {
        uuid id PK
        string email
        string encrypted_password
        timestamp email_confirmed_at
        timestamp created_at
        timestamp updated_at
        json raw_user_meta_data
        json raw_app_meta_data
    }
    
    PROFILES {
        uuid id PK "references auth.users"
        string email
        string full_name
        enum role "admin|user|moderator"
        string avatar_url
        timestamp created_at
        timestamp updated_at
    }
    
    USER_ROLES {
        uuid id PK
        uuid profile_id FK
        string role_name
        json permissions
        timestamp assigned_at
        uuid assigned_by
    }
    
    USER_SESSIONS {
        uuid id PK
        uuid user_id FK
        string session_token
        timestamp expires_at
        timestamp created_at
        string ip_address
        string user_agent
    }
    
    STORAGE_OBJECTS {
        uuid id PK
        string bucket_id
        string name
        uuid owner FK
        timestamp created_at
        timestamp updated_at
        json metadata
    }
```

### Service Communication Flow

```mermaid
sequenceDiagram
    participant Client as Nuxt App
    participant Kong as Kong Gateway
    participant Auth as GoTrue
    participant API as PostgREST
    participant DB as PostgreSQL
    participant Storage as Storage API
    participant Studio as Studio Dashboard
    
    Note over Client,Studio: Application Startup
    Client->>Kong: Initialize connection
    Kong->>Auth: Validate JWT token
    Kong->>API: Route API requests
    
    Note over Client,Studio: User Authentication
    Client->>Kong: POST /auth/v1/token
    Kong->>Auth: Forward auth request
    Auth->>DB: Validate credentials
    DB->>Auth: Return user data
    Auth->>Kong: Return JWT token
    Kong->>Client: Authentication response
    
    Note over Client,Studio: Data Operations
    Client->>Kong: GET/POST /rest/v1/*
    Kong->>API: Forward with JWT
    API->>DB: Execute SQL with RLS
    DB->>API: Return filtered data
    API->>Kong: JSON response
    Kong->>Client: API response
    
    Note over Client,Studio: File Operations
    Client->>Kong: POST /storage/v1/*
    Kong->>Storage: Forward file request
    Storage->>DB: Check permissions
    Storage->>Storage: Store/retrieve file
    Storage->>Kong: File response
    Kong->>Client: File URL/data
    
    Note over Client,Studio: Admin Operations
    Studio->>Kong: Admin API calls
    Kong->>API: Forward admin request
    API->>DB: Execute with elevated permissions
    DB->>API: Return admin data
    API->>Kong: Admin response    Kong->>Studio: Update dashboard
```

## 🐳 Docker Infrastructure

### Container Architecture

```mermaid
graph TB
    subgraph "Docker Host"
        subgraph "Supabase Network"
            A[Kong Gateway :8000] --> B[PostgREST :3000]
            A --> C[GoTrue Auth :9999]
            A --> D[Storage API :5000]
            A --> E[Realtime :4000]
            
            F[Studio :3000] --> G[Meta API :8080]
            H[Analytics :4000] --> I[Vector :9001]
            
            J[PostgreSQL :5432] --> K[DB Volume]
            L[Imgproxy :5001] --> M[Storage Volume]
        end
        
        subgraph "External Ports"
            N[":54321 → Kong"]
            O[":54323 → Studio"]
            P[":54324 → Analytics"]
        end
        
        subgraph "Development Tools"
            Q[Nuxt Dev Server :3000]
            R[Hot Reload]
            S[DevTools]
        end
    end
    
    A --> J
    B --> J
    C --> J
    F --> G
    G --> J
    
    N --> A
    O --> F
    P --> H
    
    style A fill:#e3f2fd
    style J fill:#e8f5e8
    style Q fill:#fff3e0
```

### Development vs Production Setup

```mermaid
graph LR
    subgraph "Development Environment"
        A1[Local Docker] --> A2[Supabase Stack]
        A2 --> A3[Local DB]
        A3 --> A4[File Storage]
        A4 --> A5[Studio Dashboard]
        
        A6[Nuxt Dev] --> A7[Hot Reload]
        A7 --> A8[Source Maps]
        A8 --> A9[DevTools]
    end
    
    subgraph "Production Environment"
        B1[Supabase Cloud] --> B2[Managed DB]
        B2 --> B3[CDN Storage]
        B3 --> B4[Edge Functions]
        B4 --> B5[Global Distribution]
        
        B6[Nuxt Build] --> B7[Static Generation]
        B7 --> B8[Optimized Assets]
        B8 --> B9[Performance Monitoring]
    end
    
    A1 --> B1
    A6 --> B6
    
    style A1 fill:#e8f5e8
    style B1 fill:#e3f2fd
```

### Service Dependencies

```mermaid
graph TD
    A[Database] --> B[Auth Service]
    A --> C[PostgREST API]
    A --> D[Storage Service]
    
    B --> E[Kong Gateway]
    C --> E
    D --> E
    
    E --> F[Studio Dashboard]
    E --> G[Nuxt Application]
    
    H[Analytics] --> I[Logflare]
    I --> A
    
    J[Realtime] --> A
    K[Meta API] --> A
    
    F --> K
    G --> E
    
    style A fill:#ffcdd2
    style E fill:#e8f5e8
    style G fill:#e3f2fd
```

## � Detailed Supabase Setup Architecture

### Supabase Service Configuration

```mermaid
graph TB
    subgraph "Environment Configuration"
        A[.env Variables] --> B[SUPABASE_URL]
        A --> C[SUPABASE_ANON_KEY]
        A --> D[SUPABASE_SERVICE_ROLE_KEY]
        A --> E[DATABASE_URL]
        A --> F[JWT_SECRET]
    end
    
    subgraph "Docker Service Configuration"
        G[docker-compose.yml] --> H[Service Definitions]
        H --> I[kong: API Gateway]
        H --> J[auth: GoTrue]
        H --> K[rest: PostgREST]
        H --> L[realtime: WebSocket]
        H --> M[storage: File Storage]
        H --> N[imgproxy: Image Processing]
        H --> O[meta: Metadata API]
        H --> P[studio: Dashboard]
        H --> Q[analytics: Logging]
        H --> R[db: PostgreSQL]
        H --> S[vector: Log Processing]
    end
    
    subgraph "Service Dependencies"
        I --> R
        J --> R
        K --> R
        L --> R
        M --> R
        O --> R
        P --> O
        Q --> S
        N --> M
    end
    
    subgraph "Port Mapping"
        T[Host Ports] --> U[:54321 → kong:8000]
        T --> V[:54323 → studio:3000]
        T --> W[:54324 → analytics:4000]
    end
    
    B --> I
    C --> K
    D --> K
    E --> R
    F --> J
    
    G --> I
    U --> I
    V --> P
    W --> Q
    
    style A fill:#e3f2fd
    style G fill:#e8f5e8
    style T fill:#fff3e0
    style R fill:#ffcdd2
```

### Database Setup & Migration Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Script as Setup Script
    participant Docker as Docker Compose
    participant DB as PostgreSQL
    participant Supabase as Supabase Services
    participant Studio as Studio Dashboard
    
    Note over Dev,Studio: Initial Setup
    Dev->>Script: Run 01-setup-environment.ps1
    Script->>Docker: docker-compose up -d
    Docker->>DB: Start PostgreSQL container
    Docker->>Supabase: Start all services
    
    Note over Dev,Studio: Database Initialization
    Script->>DB: Wait for DB ready
    Script->>DB: Create initial schemas
    DB->>DB: auth, public, storage schemas
    
    Note over Dev,Studio: Service Configuration
    Supabase->>DB: Configure auth tables
    Supabase->>DB: Setup RLS policies
    Supabase->>DB: Create storage buckets
    
    Note over Dev,Studio: Data Seeding
    Dev->>Script: Run 02-reset-and-seed.ps1
    Script->>DB: Run migration scripts
    Script->>DB: Insert seed data
    Script->>DB: Create test users
    
    Note over Dev,Studio: Verification
    Dev->>Script: Run 05-verify-setup.js
    Script->>DB: Test database connection
    Script->>Supabase: Test API endpoints
    Script->>Studio: Verify dashboard access
    
    Studio->>Dev: Setup complete ✅
```

### Advanced Application Architecture

```mermaid
graph TB
    subgraph "Frontend Components"
        A[App.vue] --> B[NuxtLayout]
        B --> C[NuxtPage]
        C --> D[Component Tree]
        
        D --> E[BaseLoginForm]
        D --> F[ContactUs]
        D --> G[BaseContactCard]
        D --> H[UI Components]
    end
    
    subgraph "Composition Layer"
        I[useSupabaseAuth] --> J[User Authentication]
        K[useAuthGuard] --> L[Route Protection]
        M[useUserProfile] --> N[Profile Management]
        O[useContactForm] --> P[Form Handling]
        Q[useStorage] --> R[File Operations]
        S[useVantaClouds2] --> T[3D Background]
    end
    
    subgraph "Middleware Chain"
        U[auth.global.ts] --> V[Global Auth Check]
        W[admin.ts] --> X[Admin Protection]
        Y[auth.ts] --> Z[Route-specific Auth]
    end
    
    subgraph "Store Management"
        AA[Pinia Stores] --> BB[User Store]
        AA --> CC[Auth Store]
        AA --> DD[UI Store]
        AA --> EE[Contact Store]
    end
    
    subgraph "Plugin Integration"
        FF[Supabase Plugin] --> GG[Client Configuration]
        HH[Vuetify Plugin] --> II[UI Framework]
        JJ[FontAwesome Plugin] --> KK[Icon System]
        LL[Pinia Plugin] --> MM[State Management]
    end
    
    A --> I
    C --> U
    I --> AA
    U --> AA
    FF --> I
    
    style A fill:#e3f2fd
    style I fill:#e8f5e8
    style U fill:#fff3e0
    style AA fill:#f3e5f5
    style FF fill:#e0f2f1
```

### Page Structure & Routing

```mermaid
graph TB
    subgraph "Public Pages"
        A[index.vue] --> B[Landing Page]
        C[info/about.vue] --> D[About Page]
        C[info/contact.vue] --> E[Contact Page]
        F[[...slug].vue] --> G[Dynamic Routes]
    end
    
    subgraph "Authentication Pages"
        H[auth/login.vue] --> I[Login Form]
        J[auth/register.vue] --> K[Registration]
        L[auth/forgot.vue] --> M[Password Reset]
        N[auth/callback.vue] --> O[OAuth Callback]
    end
    
    subgraph "User Dashboard"
        P[settings/profile.vue] --> Q[Profile Management]
        R[settings/security.vue] --> S[Security Settings]
        T[storage/index.vue] --> U[File Manager]
        V[projects/index.vue] --> W[Project List]
    end
    
    subgraph "Admin Panel"
        X[admin/dashboard.vue] --> Y[Admin Overview]
        Z[admin/users.vue] --> AA[User Management]
        BB[admin/logs.vue] --> CC[System Logs]
        DD[admin/settings.vue] --> EE[System Config]
    end
    
    subgraph "Layout Assignment"
        FF[default.vue] --> A
        FF --> C
        GG[auth.vue] --> H
        GG --> J
        HH[user.vue] --> P
        HH --> T
        II[admin.vue] --> X
        II --> Z
    end
    
    A --> H
    H --> P
    P --> X
    
    style A fill:#e8f5e8
    style H fill:#e3f2fd
    style P fill:#fff3e0
    style X fill:#ffebee
```

### Authentication & Authorization Flow

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    
    Unauthenticated --> Authenticating: Login Attempt
    Authenticating --> Authenticated: Success
    Authenticating --> Unauthenticated: Failure
    
    Authenticated --> UserRole: Role Check
    UserRole --> RegularUser: role = 'user'
    UserRole --> Moderator: role = 'moderator'
    UserRole --> Administrator: role = 'admin'
    
    RegularUser --> UserDashboard: Access Granted
    Moderator --> ModeratorPanel: Access Granted
    Administrator --> AdminPanel: Access Granted
    
    UserDashboard --> ProfileManagement
    UserDashboard --> FileStorage
    UserDashboard --> ProjectAccess
    
    ModeratorPanel --> UserModeration
    ModeratorPanel --> ContentModeration
    ModeratorPanel --> ReportHandling
    
    AdminPanel --> SystemConfiguration
    AdminPanel --> UserManagement
    AdminPanel --> SystemMonitoring
    AdminPanel --> DatabaseAccess
    
    ProfileManagement --> Authenticated: Session Refresh
    UserModeration --> Authenticated: Session Refresh
    SystemConfiguration --> Authenticated: Session Refresh
    
    Authenticated --> TokenExpired: JWT Expires
    TokenExpired --> Unauthenticated: Auto Logout
    
    Authenticated --> LogoutRequest: Manual Logout
    LogoutRequest --> Unauthenticated: Session Cleared
```

### Data Flow & State Management

```mermaid
graph LR
    subgraph "Client State"
        A[Vue Components] --> B[Pinia Store]
        B --> C[Reactive State]
        C --> D[Computed Properties]
        D --> E[Watchers]
    end
    
    subgraph "API Communication"
        F[Supabase Client] --> G[HTTP Requests]
        G --> H[WebSocket Connection]
        H --> I[Real-time Updates]
    end
    
    subgraph "Server State"
        J[PostgreSQL] --> K[Row Level Security]
        K --> L[Data Filtering]
        L --> M[Response Data]
    end
    
    subgraph "Authentication Layer"
        N[JWT Token] --> O[Request Headers]
        O --> P[Auth Middleware]
        P --> Q[Permission Check]
    end
    
    A --> F
    F --> N
    N --> J
    J --> M
    M --> I
    I --> C
    
    B --> F
    Q --> K
    
    style A fill:#e3f2fd
    style F fill:#e8f5e8
    style J fill:#fff3e0
    style N fill:#f3e5f5
```

### Performance & Optimization Architecture

```mermaid
graph TD
    subgraph "Frontend Optimization"
        A[Nuxt 3 SSR] --> B[Static Generation]
        B --> C[Code Splitting]
        C --> D[Lazy Loading]
        D --> E[Image Optimization]
    end
    
    subgraph "Caching Strategy"
        F[Browser Cache] --> G[Service Worker]
        G --> H[IndexedDB]
        H --> I[Memory Cache]
    end
    
    subgraph "Database Optimization"
        J[Connection Pooling] --> K[Query Optimization]
        K --> L[Index Strategy]
        L --> M[RLS Performance]
    end
    
    subgraph "Asset Delivery"
        N[CDN Distribution] --> O[Image Compression]
        O --> P[Bundle Splitting]
        P --> Q[Tree Shaking]
    end
    
    subgraph "Monitoring & Analytics"
        R[Performance Metrics] --> S[Error Tracking]
        S --> T[User Analytics]
        T --> U[System Health]
    end
    
    A --> F
    B --> N
    J --> K
    R --> U
    
    style A fill:#e8f5e8
    style F fill:#e3f2fd
    style J fill:#fff3e0
    style N fill:#f3e5f5
    style R fill:#ffebee
```

## �📚 Documentation Structure

### Services Documentation

The documentation is organized into the following service areas:

#### 🔐 [Authentication & Authorization](./services/authentication.md)
- Authentication system architecture
- Role-based access control (RBAC)
- Security best practices
- Auth recovery procedures
- Admin setup and management

#### 👥 [User Management](./services/user-management.md)
- User registration and profiles
- Role assignment and management
- User management scripts
- Login resolution procedures
- Security and permissions

#### 🗄️ [Database Service](./services/database.md)
- Database architecture and setup
- Database seeding and migration
- Recovery and emergency procedures
- Performance optimization
- Backup and restore procedures

#### 🛠️ [Development & Scripts](./services/development-scripts.md)
- Development workflow automation
- Script architecture and organization
- Fast development procedures
- Testing and validation
- Maintenance and cleanup

#### 🏗️ [Infrastructure & Docker](./services/infrastructure.md)
- Docker containerization
- Environment configuration
- Deployment strategies
- Monitoring and logging
- Performance optimization

## 🚀 Quick Start Guide

### Complete Setup Flow

```mermaid
flowchart TD
    A[Prerequisites Check] --> B{Docker Installed?}
    B -->|No| B1[Install Docker]
    B -->|Yes| C{Node.js 18+?}
    C -->|No| C1[Install Node.js]
    C -->|Yes| D{PowerShell 7+?}
    D -->|No| D1[Install PowerShell]
    D -->|Yes| E[Clone Repository]
    
    B1 --> C
    C1 --> D
    D1 --> E
    
    E --> F[Environment Setup]
    F --> G[.\scripts\01-setup-environment.ps1]
    G --> H{Setup Successful?}
    
    H -->|No| I[Check Error Logs]
    H -->|Yes| J[Database Setup]
    
    I --> K[Fix Issues]
    K --> G
    
    J --> L[.\scripts\02-reset-and-seed.ps1]
    L --> M{Database Ready?}
    
    M -->|No| N[Check DB Connection]
    M -->|Yes| O[Verification]
    
    N --> P[Fix DB Issues]
    P --> L
    
    O --> Q[node scripts\05-verify-setup.js]
    Q --> R{All Tests Pass?}
    
    R -->|No| S[Review Failures]
    R -->|Yes| T[🎉 Setup Complete]
    
    S --> U[Fix Specific Issues]
    U --> Q
    
    T --> V[Access Application]
    V --> W[http://localhost:3000]
    V --> X[http://localhost:54323 - Studio]
    V --> Y[http://localhost:54321 - API]
    
    style T fill:#e8f5e8
    style A fill:#e3f2fd
    style I fill:#ffebee
    style N fill:#ffebee
    style S fill:#ffebee
```

### New Developer Setup

1. **Environment Setup**
   ```bash
   # Complete environment setup
   .\scripts\01-setup-environment.ps1
   ```

2. **Database Setup**
   ```bash
   # Reset and seed database
   .\scripts\02-reset-and-seed.ps1
   ```

3. **Verification**
   ```bash
   # Verify setup
   node scripts\05-verify-setup.js
   ```

### Daily Development Workflow

```mermaid
flowchart LR
    A[Start Work] --> B[Quick Status Check]
    B --> C[.\scripts\instant-supabase.ps1 -Seed]
    C --> D{Services Healthy?}
    
    D -->|Yes| E[Start Development]
    D -->|No| F[Run Full Reset]
    
    F --> G[.\scripts\02-reset-and-seed.ps1]
    G --> E
    
    E --> H[Code Changes]
    H --> I[Test Changes]
    I --> J{Tests Pass?}
    
    J -->|Yes| K[Commit Changes]
    J -->|No| L[Debug Issues]
    
    L --> M[Check Logs]
    M --> N[Fix Issues]
    N --> H
    
    K --> O[End Work Day]
    O --> P[Optional: Stop Services]
    P --> Q[docker-compose down]
    
    style E fill:#e8f5e8
    style K fill:#e3f2fd
    style L fill:#fff3e0
```

1. **Start Development Environment**
   ```bash
   # Quick start (10-20 seconds)
   .\scripts\instant-supabase.ps1 -Seed
   ```

2. **Check System Status**
   ```bash
   # Database health check
   node scripts\06-check-database.js
   
   # Connectivity test
   node scripts\12-test-connectivity.ps1
   ```

3. **Development Tools**
   - Access Supabase Studio: http://localhost:54323
   - Application: http://localhost:3000
   - API Gateway: http://localhost:54321

## 🆘 Emergency Procedures

### Emergency Recovery Decision Tree

```mermaid
flowchart TD
    A[🚨 System Issue Detected] --> B{What's the Problem?}
    
    B -->|Authentication Issues| C[Auth Problems]
    B -->|Database Connection| D[DB Problems]
    B -->|Container Issues| E[Docker Problems]
    B -->|Port Conflicts| F[Network Problems]
    B -->|Complete Failure| G[Nuclear Option]
    
    C --> C1[node scripts/11-test-authentication.js]
    C1 --> C2{Auth Working?}
    C2 -->|Yes| C3[Check User Roles]
    C2 -->|No| C4[Restart Auth Service]
    C3 --> C5[Fix Role Assignment]
    C4 --> C6[Check Environment Variables]
    
    D --> D1[node scripts/06-check-database.js]
    D1 --> D2{DB Connected?}
    D2 -->|Yes| D3[Check RLS Policies]
    D2 -->|No| D4[Restart DB Container]
    D3 --> D5[Fix Data Issues]
    D4 --> D6[Check Docker Network]
    
    E --> E1[docker-compose ps]
    E1 --> E2{Containers Running?}
    E2 -->|Some Down| E3[docker-compose restart]
    E2 -->|All Down| E4[docker-compose up -d]
    E3 --> E5[Check Service Health]
    E4 --> E6[Check Port Conflicts]
    
    F --> F1[netstat -an | findstr :54321]
    F1 --> F2{Ports Available?}
    F2 -->|No| F3[Kill Conflicting Process]
    F2 -->|Yes| F4[Check Firewall]
    F3 --> F5[Restart Services]
    F4 --> F6[Configure Network]
    
    G --> G1[.\scripts\18-emergency-restore.ps1]
    G1 --> G2[Complete System Reset]
    G2 --> G3[Verify All Services]
    
    C5 --> H[✅ Issue Resolved]
    C6 --> H
    D5 --> H
    D6 --> H
    E5 --> H
    E6 --> H
    F5 --> H
    F6 --> H
    G3 --> H
    
    H --> I[Test Application]
    I --> J{Working Properly?}
    J -->|Yes| K[🎉 Success]
    J -->|No| L[Escalate to Nuclear Option]
    L --> G1
    
    style A fill:#ffebee
    style K fill:#e8f5e8
    style G1 fill:#ffcdd2
    style H fill:#fff3e0
```

### Recovery Severity Levels

```mermaid
graph LR
    subgraph "Level 1: Quick Fixes"
        A1[Service Restart] --> A2[Config Refresh]
        A2 --> A3[Cache Clear]
    end
    
    subgraph "Level 2: Component Reset"
        B1[Database Reset] --> B2[Auth Service Reset]
        B2 --> B3[Container Restart]
    end
    
    subgraph "Level 3: System Reset"
        C1[Full Stack Reset] --> C2[Volume Cleanup]
        C2 --> C3[Network Reset]
    end
    
    subgraph "Level 4: Nuclear Option"
        D1[Complete Rebuild] --> D2[Fresh Installation]
        D2 --> D3[Data Recovery]
    end
    
    A3 --> B1
    B3 --> C1
    C3 --> D1
    
    style A1 fill:#e8f5e8
    style B1 fill:#fff3e0
    style C1 fill:#ffecb3
    style D1 fill:#ffcdd2
```

### Quick Recovery

For immediate issues:
```bash
# Quick fixes for common issues
.\scripts\quick-fix.ps1
```

### Complete Recovery

For severe issues:
```bash
# Nuclear option - complete restore
.\scripts\18-emergency-restore.ps1
```

### Service-Specific Recovery

- **Authentication Issues**: See [Authentication Service](./services/authentication.md#troubleshooting)
- **Database Issues**: See [Database Service](./services/database.md#database-recovery--emergency-procedures)
- **Container Issues**: See [Infrastructure Service](./services/infrastructure.md#troubleshooting)

## 📖 Documentation Navigation

### By Use Case

#### Setting Up New Environment
1. [Infrastructure Setup](./services/infrastructure.md#environment-setup)
2. [Database Configuration](./services/database.md#seeding-guide)
3. [Authentication Setup](./services/authentication.md#admin-setup-guide)
4. [User Management](./services/user-management.md#usage-examples)

#### Daily Development
1. [Development Scripts](./services/development-scripts.md#fast-development-scripts)
2. [Database Operations](./services/database.md#fast-database-operations)
3. [Testing Procedures](./services/development-scripts.md#testing--validation)

#### Troubleshooting
1. [Emergency Recovery](./services/database.md#emergency-scenarios)
2. [Authentication Issues](./services/authentication.md#troubleshooting)
3. [Infrastructure Problems](./services/infrastructure.md#common-issues)
4. [User Management Issues](./services/user-management.md#troubleshooting)

#### Production Deployment
1. [Infrastructure Deployment](./services/infrastructure.md#production-deployment)
2. [Database Migration](./services/database.md#database-maintenance)
3. [Security Configuration](./services/authentication.md#security-best-practices)

### By Service Area

Each service documentation includes:
- **Overview**: Service purpose and architecture
- **Setup**: Installation and configuration procedures
- **Usage**: Common operations and examples
- **API Reference**: Technical specifications
- **Troubleshooting**: Common issues and solutions
- **Best Practices**: Recommended approaches

## 🔧 Available Scripts

### Core Scripts (Sequential)
- **01-05**: Setup and initialization
- **06-10**: Maintenance and operations
- **11-15**: Testing and validation
- **16-20**: Utilities and cleanup

### Fast Scripts
- **instant-supabase.ps1**: 10-20 second startup
- **quick-reset.ps1**: 5-10 second data reset
- **reset-and-seed-v2.ps1**: 30-60 second optimized reset

### Emergency Scripts
- **18-emergency-restore.ps1**: Complete system recovery
- **quick-fix.ps1**: Common issue fixes

## 📊 Service Overview

| Service | Purpose | Key Files | Quick Access |
|---------|---------|-----------|--------------|
| Authentication | User auth & RBAC | `auth.global.ts`, `useSupabaseAuth.ts` | [Docs](./services/authentication.md) |
| User Management | User operations | `10-manage-users.js`, `profiles` table | [Docs](./services/user-management.md) |
| Database | Data management | `06-check-database.js`, `07-seed-database.js` | [Docs](./services/database.md) |
| Development | Build & deploy | `01-setup-environment.ps1`, `scripts/` | [Docs](./services/development-scripts.md) |
| Infrastructure | Docker & hosting | `docker-compose.yml`, `Dockerfile` | [Docs](./services/infrastructure.md) |

## 🔗 External Resources

### Supabase Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Nuxt.js Documentation
- [Nuxt 3 Docs](https://nuxt.com/docs)
- [Nuxt Supabase Module](https://supabase.nuxtjs.org/)
- [Nuxt Deployment](https://nuxt.com/docs/getting-started/deployment)

### Docker Documentation
- [Docker Compose](https://docs.docker.com/compose/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

## 🤝 Contributing

### Documentation Updates

When updating documentation:
1. Update the relevant service documentation
2. Update this index if adding new sections
3. Maintain consistent formatting and structure
4. Include practical examples and code snippets

### Script Documentation

When adding new scripts:
1. Follow the numbered naming convention
2. Include inline documentation
3. Update the [Development Scripts](./services/development-scripts.md) documentation
4. Add usage examples

## 📝 Recent Updates

This documentation was last reorganized on **June 16, 2025** to consolidate scattered documentation files into a coherent service-based structure.

### Consolidated Files
- `AUTH_SYSTEM_RECOVERY.md` → [Authentication Service](./services/authentication.md)
- `USER_MANAGEMENT.md` → [User Management Service](./services/user-management.md)
- `SEEDING_GUIDE.md` → [Database Service](./services/database.md)
- `SCRIPTS_REFERENCE.md` → [Development Scripts Service](./services/development-scripts.md)
- `docker/README.md` → [Infrastructure Service](./services/infrastructure.md)
- And many more...

The original files have been moved to maintain version history while providing a cleaner, more organized documentation structure.
