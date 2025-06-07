/**
 * Advanced Middleware for Role & Plan-based Access Control
 * Integrates with Supabase auth and subscription management
 */

import { ROLES, SUBSCRIPTION_PLANS, hasPermission, hasFeatureAccess, checkRateLimit } from '~/utils/rbac-system'

interface UserProfile {
  role: string
  subscription_plan: string
  usage_stats: {
    apiCalls: number
    storage: number
    projects: number
  }
}

interface UsageStats {
  apiCalls: number
  storage: number
  projects: number
}

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware for public routes
  if (to.meta.public) return

  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  // Redirect to login if not authenticated
  if (!user.value) {
    return navigateTo('/auth/login')
  }
  // Get user metadata from Supabase
  const { data: profileData, error } = await supabase
    .from('user_profiles')
    .select('role, subscription_plan, usage_stats')
    .eq('user_id', user.value.id)
    .single()

  let profile: UserProfile | null = profileData
  if (error) {
    console.error('Error fetching user profile:', error)
    // Default to basic user if profile not found
    profile = {
      role: 'user',
      subscription_plan: 'free',
      usage_stats: { apiCalls: 0, storage: 0, projects: 0 }
    }
  }
  const userRole = profile?.role || 'user'
  const userPlan = profile?.subscription_plan || 'free'
  const usage: UsageStats = profile?.usage_stats || {
    apiCalls: 0,
    storage: 0,
    projects: 0
  }

  // Check route-specific requirements
  const requiredRole = to.meta.requiresRole as string
  const requiredPlan = to.meta.requiresPlan as string
  const requiredPermission = to.meta.requiresPermission as string
  const requiredFeature = to.meta.requiresFeature as string

  // Role-based access control
  if (requiredRole) {
    const userRoleLevel = ROLES[userRole]?.level || 0
    const requiredRoleLevel = ROLES[requiredRole]?.level || 999
    
    if (userRoleLevel < requiredRoleLevel) {
      throw createError({
        statusCode: 403,
        statusMessage: `Access denied. ${requiredRole} role required.`
      })
    }
  }

  // Permission-based access control
  if (requiredPermission && !hasPermission(userRole, requiredPermission)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Access denied. Permission '${requiredPermission}' required.`
    })
  }

  // Plan-based access control
  if (requiredPlan) {
    const userPlanLevel = Object.keys(SUBSCRIPTION_PLANS).indexOf(userPlan)
    const requiredPlanLevel = Object.keys(SUBSCRIPTION_PLANS).indexOf(requiredPlan)
    
    if (userPlanLevel < requiredPlanLevel) {
      return navigateTo(`/upgrade?plan=${requiredPlan}&reason=access`)
    }
  }

  // Feature-based access control
  if (requiredFeature && !hasFeatureAccess(userPlan, requiredFeature)) {
    return navigateTo(`/upgrade?feature=${requiredFeature}&reason=feature`)
  }

  // Rate limiting based on plan
  if (to.path.startsWith('/api/')) {
    if (!checkRateLimit(userPlan, usage.apiCalls || 0, 'apiCalls')) {
      throw createError({
        statusCode: 429,
        statusMessage: 'API rate limit exceeded. Please upgrade your plan.'
      })
    }
  }

  // Storage limit check for file uploads
  if (to.path.includes('upload') || to.path.includes('files')) {
    if (!checkRateLimit(userPlan, usage.storage || 0, 'storage')) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Storage limit exceeded. Please upgrade your plan.'
      })
    }
  }

  // Set user context for use in pages/components
  useState('userRole', () => userRole)
  useState('userPlan', () => userPlan)
  useState('userUsage', () => usage)
  useState('userLimits', () => SUBSCRIPTION_PLANS[userPlan]?.limits)
})
