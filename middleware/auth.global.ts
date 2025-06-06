/**
 * Global Authentication Middleware
 * 
 * Centralized access control for:
 * ✅ Public pages (no auth required)
 * 🔐 Auth-only pages
 * 💳 Plan-based restrictions (Pro, Business)
 * 🧑‍💼 Admin-only routes
 * 
 * Flow:
 * 1. Check if route is public
 * 2. Verify user authentication
 * 3. Validate user plan requirements
 * 4. Check admin role requirements
 */

export default defineNuxtRouteMiddleware((to, from) => {
  // Skip middleware on server-side rendering for performance
  if (process.server) return

  const user = useSupabaseUser()
  const router = useRouter()

  // 1️⃣ Allow access to public routes
  if (to.meta.public) {
    return
  }

  // 2️⃣ Check if user is authenticated
  if (!user.value) {
    console.log(`🔐 Auth required for ${to.path}, redirecting to login`)
    
    // Store the intended destination for post-login redirect
    const redirectTo = to.fullPath
    return navigateTo(`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`)
  }

  // Get user metadata
  const metadata = user.value.user_metadata || {}
  const appMetadata = user.value.app_metadata || {}
  
  // Extract user plan and role
  const userPlan = metadata.plan || appMetadata.plan || 'free'
  const userRole = metadata.role || appMetadata.role || 'user'

  console.log(`👤 User: ${user.value.email}, Plan: ${userPlan}, Role: ${userRole}`)

  // 3️⃣ Plan-based access control
  if (to.meta.requiresPro) {
    const validPlans = ['pro', 'business', 'enterprise']
    
    if (!validPlans.includes(userPlan.toLowerCase())) {
      console.log(`💳 Pro plan required for ${to.path}, user has: ${userPlan}`)
      return navigateTo('/upgrade?reason=pro-required')
    }
  }

  // 4️⃣ Business plan requirement
  if (to.meta.requiresBusiness) {
    const validPlans = ['business', 'enterprise']
    
    if (!validPlans.includes(userPlan.toLowerCase())) {
      console.log(`🏢 Business plan required for ${to.path}, user has: ${userPlan}`)
      return navigateTo('/upgrade?reason=business-required')
    }
  }

  // 5️⃣ Admin role requirement
  if (to.meta.requiresAdmin) {
    if (userRole !== 'admin') {
      console.log(`🧑‍💼 Admin access required for ${to.path}, user role: ${userRole}`)
      return navigateTo('/unauthorized?reason=admin-required')
    }
  }

  // 6️⃣ Specific role requirement
  if (to.meta.requiresRole) {
    const requiredRoles = Array.isArray(to.meta.requiresRole) 
      ? to.meta.requiresRole 
      : [to.meta.requiresRole]
    
    if (!requiredRoles.includes(userRole)) {
      console.log(`👮 Role ${requiredRoles.join(' or ')} required for ${to.path}, user role: ${userRole}`)
      return navigateTo('/unauthorized?reason=role-required')
    }
  }

  // 7️⃣ Organization requirement (for future multi-tenant features)
  if (to.meta.requiresOrg && !metadata.organization_id) {
    console.log(`🏢 Organization membership required for ${to.path}`)
    return navigateTo('/setup/organization')
  }

  // ✅ All checks passed, allow access
  console.log(`✅ Access granted to ${to.path}`)
})
