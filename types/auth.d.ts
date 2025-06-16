// Auth system type definitions

export interface UserProfile {
  id: string
  full_name?: string
  avatar_url?: string
  role: 'admin' | 'user'
  email: string
  created_at?: string
  updated_at?: string
}

export interface UserInfo {
  id: string
  full_name?: string
  avatar_url?: string
  created_at?: string
  updated_at?: string
}

export interface AuthUser {
  id: string
  email?: string
  created_at?: string
  last_sign_in_at?: string
}

export interface AuthResponse {
  user: AuthUser | null
  session: any | null
  error?: Error | null
}

export interface AuthContextType {
  user: AuthUser | null
  profile: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  signIn: (email: string, password: string, requireAdminRole?: boolean) => Promise<AuthResponse>
  signOut: () => Promise<void>
  getUserRole: () => Promise<string | null>
  refreshProfile: () => Promise<void>
}

export interface AuthMiddlewareContext {
  to: {
    path: string
    fullPath: string
    query: Record<string, string | string[]>
  }
  isAdminRoute: boolean
  isPublicRoute: boolean
}

export interface AuthError extends Error {
  code?: string
  status?: number
  details?: string
}

// Utility types for better type safety
export type UserRole = 'admin' | 'user'

export interface RoleCheckResult {
  hasRole: boolean
  role: UserRole | null
  error?: AuthError
}

export interface SessionData {
  user: AuthUser | null
  session: any | null
  isValid: boolean
}

// Database table types
export interface ProfilesTable {
  id: string
  role: UserRole
  created_at?: string
  updated_at?: string
}

export interface UserInfoTable {
  id: string
  full_name?: string
  avatar_url?: string
  created_at?: string
  updated_at?: string
}

// Auth system configuration
export interface AuthConfig {
  publicRoutes: string[]
  adminRoutes: string[]
  defaultRedirectAfterLogin: string
  defaultRedirectAfterAdminLogin: string
  sessionTimeout?: number
  requireEmailVerification?: boolean
}

// Auth system diagnostics
export interface AuthDiagnosticResult {
  dbConnection: boolean
  authTables: boolean
  userRoles: boolean
  middlewareFiles: boolean
  composableFiles: boolean
  overallHealth: boolean
  issues: string[]
  fixes: string[]
}

export interface AuthSystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  issues: string[]
  recommendations: string[]
  lastChecked: Date
}
