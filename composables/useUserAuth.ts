// Authentication composable for user management
import { ref, onMounted } from 'vue';
import type { User, UserAuth, LoginCredentials, SignupCredentials, AuthError } from '~/types/user';

// API response types
interface AuthApiResponse {
  user: User;
  token: string;
}

interface VerifyApiResponse {
  authenticated: boolean;
  user: User;
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
      const data = await $fetch<VerifyApiResponse>('/api/auth/verify');
      
      if (data && data.authenticated && data.user) {
        currentUser.value = data.user;
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
      const data = await $fetch<AuthApiResponse>('/api/auth/user', {
        method: 'POST',
        body: {
          action: 'login',
          email,
          password
        }
      });

      if (data && data.user) {
        // Store user data
        currentUser.value = data.user;
        isLoggedIn.value = true;
        
        // If we receive a token in the response, store it as a backup
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
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
      const data = await $fetch<AuthApiResponse>('/api/auth/user', {
        method: 'POST',
        body: {
          action: 'signup',
          email,
          password,
          name
        }
      });

      if (data && data.user) {
        // Store user data
        currentUser.value = data.user;
        isLoggedIn.value = true;
        
        // If we receive a token in the response, store it as a backup
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
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
      await $fetch('/api/auth/logout', {
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
