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

import type { Database } from '~/utils/supabase';

// type _UserProfile = Database['public']['Tables']['user_profiles']['Row'];

interface RouteMetaWithAuth {
  requiresRole?: string | string[];
  requiresPermission?: string;
}

export default defineNuxtRouteMiddleware(async (to, _from) => {
  // Skip middleware on server-side rendering for performance
  if (process.server) return;
  const client = useSupabaseClient<Database>();
  const user = useSupabaseUser();

  // 1️⃣ Allow access to auth-related and public routes
  const publicRoutes = ['/', '/about', '/contact', '/projects'];
  const authRoutes = [
    '/auth/login',
    '/auth/signup',
    '/auth/callback',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify',
  ];

  if (publicRoutes.includes(to.path) || authRoutes.includes(to.path)) {
    // If user is already logged in and tries to access login/signup, redirect to home
    if (user.value && authRoutes.includes(to.path) && !to.path.includes('reset-password')) {
      return navigateTo('/');
    }
    return;
  }

  // 2️⃣ Check if user is authenticated
  if (!user.value && !authRoutes.includes(to.path) && !publicRoutes.includes(to.path)) {
    console.log(`🔐 Auth required for ${to.path}, redirecting to login`);
    return navigateTo({
      path: '/auth/login',
      query: {
        redirectTo: to.fullPath,
      },
    });
  }

  // 3️⃣ Check user session and profile
  if (user.value) {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session && !authRoutes.includes(to.path) && !publicRoutes.includes(to.path)) {
      console.log('🔑 Invalid session, redirecting to login');
      return navigateTo('/auth/login');
    }

    // 4️⃣ Get user role and profile for protected routes
    if (!authRoutes.includes(to.path) && !publicRoutes.includes(to.path)) {
      // Check user profile and permissions
      const {
        data: { user: profile },
      } = await client.from('user_profiles').select('*').eq('user_id', user.value?.id).single();

      if (!profile) {
        console.error('User profile not found');
        return navigateTo('/auth/login');
      }

      const userRole = profile?.role || 'user';
      const userPlan = profile?.subscription_plan || 'free';
      const userPermissions = profile.permissions || [];

      // Role-based access control
      if (to.path.startsWith('/admin') && userRole !== 'admin') {
        console.log('🚫 Admin access denied');
        return navigateTo('/unauthorized?reason=admin-required');
      }

      // Pro plan routes
      const proRoutes = ['/dashboard/pro', '/api-access', '/advanced-features'];
      if (proRoutes.some(route => to.path.startsWith(route))) {
        const validPlans = ['pro', 'business', 'enterprise'];
        if (!validPlans.includes(userPlan.toLowerCase())) {
          console.log(`💳 Pro plan required for ${to.path}, user has: ${userPlan}`);
          return navigateTo('/upgrade?reason=pro-required');
        }
      }

      // Business/Enterprise routes
      const businessRoutes = ['/dashboard/enterprise', '/team-management', '/audit-logs'];
      if (businessRoutes.some(route => to.path.startsWith(route))) {
        const validPlans = ['business', 'enterprise'];
        if (!validPlans.includes(userPlan.toLowerCase())) {
          console.log(`🏢 Business plan required for ${to.path}, user has: ${userPlan}`);
          return navigateTo('/upgrade?reason=business-required');
        }
      }

      // 5️⃣ Role-based page requirements
      const meta = to.meta as RouteMetaWithAuth;
      if (meta.requiresRole) {
        const requiredRoles = Array.isArray(meta.requiresRole)
          ? meta.requiresRole
          : [meta.requiresRole];

        if (!requiredRoles.includes(userRole)) {
          console.log(
            `👮 Role ${requiredRoles.join(' or ')} required for ${to.path}, user role: ${userRole}`
          );
          return navigateTo('/unauthorized?reason=role-required');
        }
      }

      // 6️⃣ Action-based permissions (for API endpoints and sensitive operations)
      if (meta.requiresPermission && typeof meta.requiresPermission === 'string') {
        if (!userPermissions.includes(meta.requiresPermission)) {
          console.log(`🔐 Permission ${meta.requiresPermission} required for ${to.path}`);
          return navigateTo('/unauthorized?reason=permission-required');
        }
      }

      // ✅ All checks passed, allow access
      console.log(`✅ Access granted to ${to.path} for ${userRole} with plan ${userPlan}`);
    }
  }
});
