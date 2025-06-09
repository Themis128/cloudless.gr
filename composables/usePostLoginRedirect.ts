// composables/usePostLoginRedirect.ts
import { useCookie } from 'nuxt/app';
import { useRouter } from 'vue-router';
import { useUserSession } from '~/composables/useUserSession';

/**
 * Composable for robust, SSR-safe post-login redirects based on user role and intended destination.
 * Ensures type safety and prevents navigation errors.
 */
export const usePostLoginRedirect = () => {
  const router = useRouter();
  const redirectTo = useCookie<string | null>('redirectTo') as any;
  const { user } = useUserSession();

  /**
   * Type guard for user object with a role property.
   */
  function hasRole(u: any): u is { role: string } {
    return u && typeof u === 'object' && typeof u.role === 'string';
  }

  /**
   * Type guard for a non-empty string value.
   */
  function isString(val: any): val is string {
    return typeof val === 'string' && val.length > 0;
  }

  /**
   * Gets the redirect destination and clears the stored value.
   * Returns default path if no destination is stored.
   */
  const getRedirectTo = () => {
    const destination = redirectTo.value;
    redirectTo.value = null;

    if (isString(destination)) {
      return destination;
    }

    if (!hasRole(user.value)) {
      return '/';
    }

    switch (user.value.role) {
      case 'admin':
        return '/admin/dashboard';
      case 'user':
        return '/user/home';
      default:
        return '/';
    }
  };

  /**
   * Redirects the user after login based on intended destination or user role.
   * Throws if user role is missing or invalid.
   */
  const redirect = async () => {
    const destination = getRedirectTo();
    return await router.push(destination);
  };

  /**
   * Sets the redirect destination.
   */
  const setRedirectTo = (path: string) => {
    redirectTo.value = path;
  };

  return {
    redirect,
    getRedirectTo,
    setRedirectTo,
  };
};
