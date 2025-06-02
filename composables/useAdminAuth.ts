import { onMounted, readonly, ref, computed } from '#imports';

interface AdminUser {
  id: string;
  email: string;
  role: 'admin';
  name?: string;
}

interface AdminAuthResponse {
  success: boolean;
  message: string;
  user?: AdminUser;
  token?: string;
  expiresAt?: string;
  valid?: boolean;
}

export const useAdminAuth = () => {
  // Admin state
  const adminUser = ref<AdminUser | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed properties
  const isAdminAuthenticated = computed(() => !!adminUser.value);

  // Admin sign in
  const adminSignIn = async (email: string, password: string) => {
    if (!email || !password) {
      error.value = 'Email and password are required';
      return { success: false, error: error.value };
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<AdminAuthResponse>('/api/auth/admin-login', {
        method: 'POST',
        body: {
          email,
          password,
        },
      });

      if (response.success && response.user) {
        adminUser.value = {
          id: response.user.id,
          email: response.user.email,
          role: 'admin',
          name: response.user.name,
        };

        if (process.client && response.token && response.expiresAt) {
          localStorage.setItem('admin_token', response.token);
          localStorage.setItem('admin_user', JSON.stringify(adminUser.value));
          localStorage.setItem('admin_expires_at', response.expiresAt);
        }

        return { success: true, error: null };
      }

      throw new Error(response.message || 'Admin login failed');
    } catch (err: any) {
      console.error('Admin login error:', err);
      error.value = err.message || 'Admin login failed';
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  // Admin sign out
  const adminSignOut = async () => {
    loading.value = true;
    error.value = null;

    try {
      const token = process.client ? localStorage.getItem('admin_token') : null;

      // Clear admin session first to prevent any authenticated requests
      adminUser.value = null;

      if (process.client) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_expires_at');
      }

      // Call logout API if we have a token
      if (token) {
        await $fetch<AdminAuthResponse>('/api/auth/admin-logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      await navigateTo('/admin/login');
      return { success: true, error: null };
    } catch (err: any) {
      console.error('Admin logout error:', err);
      error.value = err.message || 'Logout failed';
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  // Initialize admin session from storage
  const initializeAdminSession = () => {
    if (process.client) {
      const token = localStorage.getItem('admin_token');
      const storedUser = localStorage.getItem('admin_user');
      const expiresAt = localStorage.getItem('admin_expires_at');

      if (token && storedUser && expiresAt) {
        try {
          // Check if session has expired
          if (new Date(expiresAt) < new Date()) {
            adminSignOut();
            return;
          }

          const userData = JSON.parse(storedUser);
          if (userData && userData.role === 'admin') {
            adminUser.value = userData;
          } else {
            throw new Error('Invalid admin user data');
          }
        } catch (err) {
          console.error('Error parsing stored admin data:', err);
          if (process.client) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            localStorage.removeItem('admin_expires_at');
          }
        }
      }
    }
  };

  // Verify admin session with server
  const verifyAdminSession = async () => {
    if (!adminUser.value) return false;

    try {
      const token = process.client ? localStorage.getItem('admin_token') : null;
      if (!token) return false;

      const response = await $fetch<AdminAuthResponse>('/api/auth/verify-admin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.valid) {
        await adminSignOut();
        return false;
      }

      return true;
    } catch (err) {
      console.error('Admin session verification failed:', err);
      await adminSignOut();
      return false;
    }
  };

  // Clear error
  const clearError = () => {
    error.value = null;
  };

  // Initialize auth state when component mounts
  onMounted(async () => {
    if (process.client) {
      initializeAdminSession();
      await verifyAdminSession();
    }
  });

  return {
    // State
    adminUser: readonly(adminUser),
    loading: readonly(loading),
    error: readonly(error),

    // Computed
    isAdminAuthenticated,

    // Methods
    adminSignIn,
    adminSignOut,
    initializeAdminSession,
    verifyAdminSession,
    clearError,
  };
};
