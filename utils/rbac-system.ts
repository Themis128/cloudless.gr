/**
 * Advanced Role & Plan-based Middleware System
 * Implements subscription tiers, role hierarchies, and feature gates
 */

export interface UserRole {
  id: string
  name: 'user' | 'admin' | 'moderator' | 'premium' | 'enterprise'
  level: number
  permissions: string[]
}

export interface SubscriptionPlan {
  id: string
  name: 'free' | 'starter' | 'pro' | 'enterprise'
  features: string[]
  limits: {
    apiCalls: number
    storage: number // in MB
    projects: number
    collaborators: number
  }
  price: {
    monthly: number
    yearly: number
  }
}

export const ROLES: Record<string, UserRole> = {
  user: {
    id: 'user',
    name: 'user',
    level: 1,
    permissions: ['read:own', 'write:own']
  },
  premium: {
    id: 'premium',
    name: 'premium',
    level: 2,
    permissions: ['read:own', 'write:own', 'advanced:features']
  },
  moderator: {
    id: 'moderator',
    name: 'moderator',
    level: 3,
    permissions: ['read:own', 'write:own', 'moderate:content', 'read:users']
  },
  admin: {
    id: 'admin',
    name: 'admin',
    level: 4,
    permissions: ['*']
  },
  enterprise: {
    id: 'enterprise',
    name: 'enterprise',
    level: 5,
    permissions: ['*', 'enterprise:features', 'custom:integrations']
  }
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'free',
    features: ['basic_dashboard', 'limited_api'],
    limits: {
      apiCalls: 100,
      storage: 50,
      projects: 1,
      collaborators: 0
    },
    price: { monthly: 0, yearly: 0 }
  },
  starter: {
    id: 'starter',
    name: 'starter',
    features: ['basic_dashboard', 'api_access', 'email_support'],
    limits: {
      apiCalls: 1000,
      storage: 500,
      projects: 3,
      collaborators: 2
    },
    price: { monthly: 9, yearly: 90 }
  },
  pro: {
    id: 'pro',
    name: 'pro',
    features: ['advanced_dashboard', 'unlimited_api', 'priority_support', 'analytics'],
    limits: {
      apiCalls: 10000,
      storage: 5000,
      projects: 10,
      collaborators: 10
    },
    price: { monthly: 29, yearly: 290 }
  },
  enterprise: {
    id: 'enterprise',
    name: 'enterprise',
    features: ['everything', 'custom_integrations', 'dedicated_support', 'sla'],
    limits: {
      apiCalls: -1, // unlimited
      storage: -1,  // unlimited
      projects: -1, // unlimited
      collaborators: -1 // unlimited
    },
    price: { monthly: 99, yearly: 990 }
  }
}

export function hasPermission(userRole: string, permission: string): boolean {
  const role = ROLES[userRole]
  if (!role) return false
  
  return role.permissions.includes('*') || role.permissions.includes(permission)
}

export function hasFeatureAccess(plan: string, feature: string): boolean {
  const subscription = SUBSCRIPTION_PLANS[plan]
  if (!subscription) return false
  
  return subscription.features.includes('everything') || subscription.features.includes(feature)
}

export function checkRateLimit(plan: string, currentUsage: number, limitType: keyof SubscriptionPlan['limits']): boolean {
  const subscription = SUBSCRIPTION_PLANS[plan]
  if (!subscription) return false
  
  const limit = subscription.limits[limitType]
  return limit === -1 || currentUsage < limit
}
