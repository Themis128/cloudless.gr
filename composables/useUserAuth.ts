// Authentication composable for user management
import { ref, onMounted } from 'vue';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  role: string;
}

export const useUserAuth = () => {
  const isLoggedIn = ref(false);
  const currentUser = ref<User | null>(null);
  const loginError = ref('');
  const isLoading = ref(false);
  const authInitialized = ref(false);

  // Check authentication status on mount
  onMounted(async () => {
    if (process.client) {
      await checkAuthStatus();
      authInitialized.value = true;
    }
  });

  // Verify authentication with the server
  const checkAuthStatus = async () => {
    try {
      const { data } = await useFetch<{authenticated: boolean, user: User}>('/api/auth/verify');
      
      if (data.value && data.value.authenticated && data.value.user) {
        currentUser.value = data.value.user;
        isLoggedIn.value = true;
      } else {
        // Clear any local state if server says we're not authenticated
        currentUser.value = null;
        isLoggedIn.value = false;
      }
    } catch (err) {
      console.error('Auth check error:', err);
      // In case of error, assume not authenticated
      currentUser.value = null;
      isLoggedIn.value = false;
    }
    
    return isLoggedIn.value;
  };

  // Login function
  const login = async (email: string, password: string) => {
    isLoading.value = true;
    loginError.value = '';

    try {
      // Use the API endpoint for authentication
      const { data, error } = await useFetch('/api/auth/user', {
        method: 'POST',
        body: {
          action: 'login',
          email,
          password
        }
      });

      if (error.value) {
        loginError.value = error.value.statusMessage || 'An error occurred during login';
        return false;
      }

      if (data.value && data.value.user) {
        // Store user data
        currentUser.value = data.value.user;
        isLoggedIn.value = true;
        
        // If we receive a token in the response, store it as a backup
        if (data.value.token) {
          localStorage.setItem('auth_token', data.value.token);
        }
        
        return true;
      } else {
        loginError.value = 'Invalid credentials';
        return false;
      }
    } catch (err) {
      console.error('Login error:', err);
      loginError.value = 'An error occurred during login';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  // Signup function
  const signup = async (email: string, password: string, name: string) => {
    isLoading.value = true;
    loginError.value = '';

    try {
      // Use the API endpoint for user registration
      const { data, error } = await useFetch('/api/auth/user', {
        method: 'POST',
        body: {
          action: 'signup',
          email,
          password,
          name
        }
      });

      if (error.value) {
        loginError.value = error.value.statusMessage || 'An error occurred during signup';
        return false;
      }

      if (data.value && data.value.user) {
        // Store user data
        currentUser.value = data.value.user;
        isLoggedIn.value = true;
        
        // If we receive a token in the response, store it as a backup
        if (data.value.token) {
          localStorage.setItem('auth_token', data.value.token);
        }
        
        return true;
      } else {
        loginError.value = 'Failed to create account';
        return false;
      }
    } catch (err) {
      console.error('Signup error:', err);
      loginError.value = 'An error occurred during signup';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Call the logout API to invalidate the session/cookie
      await useFetch('/api/auth/logout', {
        method: 'POST'
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear local data regardless of server response
      localStorage.removeItem('auth_token');
      currentUser.value = null;
      isLoggedIn.value = false;
    }
  };

  return {
    isLoggedIn,
    currentUser,
    loginError,
    isLoading,
    login,
    signup,
    logout,
    checkAuthStatus,
    authInitialized
  };
};
