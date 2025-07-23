import { ref, computed } from 'vue'

interface DebugLog {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  component: string
  message: string
  data?: any
  userId?: number
  sessionId?: string
}

interface PermissionCheck {
  resource: string
  action: string
  result: boolean
  timestamp: string
  userId?: number
  context?: string
}

interface AuthEvent {
  type: 'login' | 'logout' | 'register' | 'token_refresh' | 'permission_check' | 'role_assignment'
  timestamp: string
  userId?: number
  data?: any
  success: boolean
  error?: string
}

class RBACDebugger {
  private logs = ref<DebugLog[]>([])
  private permissionChecks = ref<PermissionCheck[]>([])
  private authEvents = ref<AuthEvent[]>([])
  private sessionId = ref<string>('')
  private isEnabled = ref<boolean>(false)
  private maxLogs = 1000

  constructor() {
    this.sessionId.value = this.generateSessionId()
    this.isEnabled.value = process.env.NODE_ENV === 'development' || process.env.RBAC_DEBUG === 'true'
    
    if (this.isEnabled.value) {
      this.log('info', 'RBACDebugger', 'RBAC Debugger initialized', { sessionId: this.sessionId.value })
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private log(level: DebugLog['level'], component: string, message: string, data?: any, userId?: number) {
    if (!this.isEnabled.value) return

    const logEntry: DebugLog = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      userId,
      sessionId: this.sessionId.value
    }

    this.logs.value.push(logEntry)

    // Keep only the last maxLogs entries
    if (this.logs.value.length > this.maxLogs) {
      this.logs.value = this.logs.value.slice(-this.maxLogs)
    }

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      const prefix = `[RBAC Debug] [${component}]`
      switch (level) {
        case 'error':
          console.error(prefix, message, data)
          break
        case 'warn':
          console.warn(prefix, message, data)
          break
        case 'debug':
          console.debug(prefix, message, data)
          break
        default:
          console.log(prefix, message, data)
      }
    }
  }

  // Public methods
  enable() {
    this.isEnabled.value = true
    this.log('info', 'RBACDebugger', 'Debug mode enabled')
  }

  disable() {
    this.isEnabled.value = false
    this.log('info', 'RBACDebugger', 'Debug mode disabled')
  }

  isDebugEnabled() {
    return this.isEnabled.value
  }

  // Authentication logging
  logLogin(userId: number, email: string, success: boolean, error?: string) {
    const event: AuthEvent = {
      type: 'login',
      timestamp: new Date().toISOString(),
      userId,
      data: { email },
      success,
      error
    }
    
    this.authEvents.value.push(event)
    this.log('info', 'Auth', `Login attempt for ${email}`, { success, error }, userId)
  }

  logLogout(userId: number) {
    const event: AuthEvent = {
      type: 'logout',
      timestamp: new Date().toISOString(),
      userId,
      success: true
    }
    
    this.authEvents.value.push(event)
    this.log('info', 'Auth', 'User logged out', {}, userId)
  }

  logRegister(userId: number, email: string, success: boolean, error?: string) {
    const event: AuthEvent = {
      type: 'register',
      timestamp: new Date().toISOString(),
      userId,
      data: { email },
      success,
      error
    }
    
    this.authEvents.value.push(event)
    this.log('info', 'Auth', `Registration attempt for ${email}`, { success, error }, userId)
  }

  logTokenRefresh(userId: number, success: boolean, error?: string) {
    const event: AuthEvent = {
      type: 'token_refresh',
      timestamp: new Date().toISOString(),
      userId,
      success,
      error
    }
    
    this.authEvents.value.push(event)
    this.log('info', 'Auth', 'Token refresh attempt', { success, error }, userId)
  }

  // Permission logging
  logPermissionCheck(userId: number, resource: string, action: string, result: boolean, context?: string) {
    const check: PermissionCheck = {
      resource,
      action,
      result,
      timestamp: new Date().toISOString(),
      userId,
      context
    }
    
    this.permissionChecks.value.push(check)
    
    const event: AuthEvent = {
      type: 'permission_check',
      timestamp: new Date().toISOString(),
      userId,
      data: { resource, action, result, context },
      success: result
    }
    
    this.authEvents.value.push(event)
    this.log('debug', 'RBAC', `Permission check: ${resource}:${action}`, { result, context }, userId)
  }

  logRoleAssignment(userId: number, roleId: number, roleName: string, success: boolean, error?: string) {
    const event: AuthEvent = {
      type: 'role_assignment',
      timestamp: new Date().toISOString(),
      userId,
      data: { roleId, roleName },
      success,
      error
    }
    
    this.authEvents.value.push(event)
    this.log('info', 'RBAC', `Role assignment: ${roleName}`, { success, error }, userId)
  }

  // General logging
  info(component: string, message: string, data?: any, userId?: number) {
    this.log('info', component, message, data, userId)
  }

  warn(component: string, message: string, data?: any, userId?: number) {
    this.log('warn', component, message, data, userId)
  }

  error(component: string, message: string, data?: any, userId?: number) {
    this.log('error', component, message, data, userId)
  }

  debug(component: string, message: string, data?: any, userId?: number) {
    this.log('debug', component, message, data, userId)
  }

  // Analytics and reporting
  getPermissionCheckStats() {
    const total = this.permissionChecks.value.length
    const granted = this.permissionChecks.value.filter(check => check.result).length
    const denied = total - granted
    
    const resourceStats = this.permissionChecks.value.reduce((acc, check) => {
      if (!acc[check.resource]) {
        acc[check.resource] = { total: 0, granted: 0, denied: 0 }
      }
      acc[check.resource].total++
      if (check.result) {
        acc[check.resource].granted++
      } else {
        acc[check.resource].denied++
      }
      return acc
    }, {} as Record<string, { total: number; granted: number; denied: number }>)

    return {
      total,
      granted,
      denied,
      grantRate: total > 0 ? (granted / total) * 100 : 0,
      resourceStats
    }
  }

  getAuthEventStats() {
    const events = this.authEvents.value
    const stats = {
      total: events.length,
      login: events.filter(e => e.type === 'login').length,
      logout: events.filter(e => e.type === 'logout').length,
      register: events.filter(e => e.type === 'register').length,
      tokenRefresh: events.filter(e => e.type === 'token_refresh').length,
      permissionChecks: events.filter(e => e.type === 'permission_check').length,
      roleAssignments: events.filter(e => e.type === 'role_assignment').length,
      successRate: events.length > 0 ? (events.filter(e => e.success).length / events.length) * 100 : 0
    }

    return stats
  }

  getUserActivity(userId: number) {
    return {
      authEvents: this.authEvents.value.filter(e => e.userId === userId),
      permissionChecks: this.permissionChecks.value.filter(c => c.userId === userId),
      logs: this.logs.value.filter(l => l.userId === userId)
    }
  }

  getRecentActivity(limit: number = 50) {
    return {
      logs: this.logs.value.slice(-limit),
      authEvents: this.authEvents.value.slice(-limit),
      permissionChecks: this.permissionChecks.value.slice(-limit)
    }
  }

  // Export functionality
  exportLogs() {
    return {
      sessionId: this.sessionId.value,
      timestamp: new Date().toISOString(),
      logs: this.logs.value,
      permissionChecks: this.permissionChecks.value,
      authEvents: this.authEvents.value,
      stats: {
        permissions: this.getPermissionCheckStats(),
        auth: this.getAuthEventStats()
      }
    }
  }

  // Clear logs
  clearLogs() {
    this.logs.value = []
    this.permissionChecks.value = []
    this.authEvents.value = []
    this.log('info', 'RBACDebugger', 'All logs cleared')
  }

  // Reactive getters
  getLogs() {
    return this.logs
  }

  getPermissionChecks() {
    return this.permissionChecks
  }

  getAuthEvents() {
    return this.authEvents
  }

  getSessionId() {
    return this.sessionId
  }
}

// Create singleton instance
const rbacDebugger = new RBACDebugger()

// Export for use in components
export const useRBACDebugger = () => {
  return {
    // Core functionality
    enable: () => rbacDebugger.enable(),
    disable: () => rbacDebugger.disable(),
    isEnabled: computed(() => rbacDebugger.isDebugEnabled()),
    
    // Logging methods
    info: (component: string, message: string, data?: any, userId?: number) => 
      rbacDebugger.info(component, message, data, userId),
    warn: (component: string, message: string, data?: any, userId?: number) => 
      rbacDebugger.warn(component, message, data, userId),
    error: (component: string, message: string, data?: any, userId?: number) => 
      rbacDebugger.error(component, message, data, userId),
    debug: (component: string, message: string, data?: any, userId?: number) => 
      rbacDebugger.debug(component, message, data, userId),
    
    // Auth logging
    logLogin: (userId: number, email: string, success: boolean, error?: string) => 
      rbacDebugger.logLogin(userId, email, success, error),
    logLogout: (userId: number) => rbacDebugger.logLogout(userId),
    logRegister: (userId: number, email: string, success: boolean, error?: string) => 
      rbacDebugger.logRegister(userId, email, success, error),
    logTokenRefresh: (userId: number, success: boolean, error?: string) => 
      rbacDebugger.logTokenRefresh(userId, success, error),
    
    // RBAC logging
    logPermissionCheck: (userId: number, resource: string, action: string, result: boolean, context?: string) => 
      rbacDebugger.logPermissionCheck(userId, resource, action, result, context),
    logRoleAssignment: (userId: number, roleId: number, roleName: string, success: boolean, error?: string) => 
      rbacDebugger.logRoleAssignment(userId, roleId, roleName, success, error),
    
    // Analytics
    getPermissionStats: () => rbacDebugger.getPermissionCheckStats(),
    getAuthStats: () => rbacDebugger.getAuthEventStats(),
    getUserActivity: (userId: number) => rbacDebugger.getUserActivity(userId),
    getRecentActivity: (limit?: number) => rbacDebugger.getRecentActivity(limit),
    
    // Data access
    logs: computed(() => rbacDebugger.getLogs().value),
    permissionChecks: computed(() => rbacDebugger.getPermissionChecks().value),
    authEvents: computed(() => rbacDebugger.getAuthEvents().value),
    sessionId: computed(() => rbacDebugger.getSessionId().value),
    
    // Export and clear
    exportLogs: () => rbacDebugger.exportLogs(),
    clearLogs: () => rbacDebugger.clearLogs()
  }
}

// Export for direct use
export { rbacDebugger } 