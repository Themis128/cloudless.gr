import { defineNuxtRouteMiddleware, navigateTo } from '#imports';

interface AdminLoginRedirectQuery {
  redirect: string;
}

interface AdminLoginRoute {
  path: string;
  fullPath: string;
}

export default defineNuxtRouteMiddleware((to: AdminLoginRoute) => {
  // Redirect old admin login routes to the proper admin login page
  if (to.path === '/admin/login') {
    return navigateTo('/auth/admin-login?redirect=' + encodeURIComponent(to.fullPath));
  }
});
