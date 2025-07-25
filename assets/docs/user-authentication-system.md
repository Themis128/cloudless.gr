# User Authentication System Documentation

This document provides detailed information about the user authentication system implemented in the Cloudless.gr application.

## Overview

The authentication system enables users to create accounts, log in, access protected content, and manage their profiles. It implements a secure JWT-based authentication system with HTTP-only cookies for production environments, ensuring that only registered users who sign up can access the app content.

## Key Components

### Composables

The core authentication logic is encapsulated in the `useUserAuth` composable:

```ts
// composables/useUserAuth.ts
import { ref, computed } from 'vue';

export const useUserAuth = () => {
  const isLoggedIn = ref(false);
  const currentUser = ref(null);
  const loginError = ref('');
  const isLoading = ref(false);
  const authInitialized = ref(false);

  // Checks authentication status with the server
  const checkAuthStatus = async () => {
    try {
      const { data } = await useFetch('/api/auth/verify');
      if (data.value && data.value.authenticated) {
        isLoggedIn.value = true;
        currentUser.value = data.value.user;
      } else {
        isLoggedIn.value = false;
        currentUser.value = null;
      }
    } catch (error) {
      isLoggedIn.value = false;
      currentUser.value = null;
    } finally {
      authInitialized.value = true;
    }
  };

  // Login, signup, and logout functions...

  return {
    isLoggedIn,
    currentUser,
    loginError,
    isLoading,
    authInitialized,
    login,
    signup,
    logout,
    checkAuthStatus
  };
};
```

### API Endpoints

Multiple server API endpoints handle authentication requests:

```ts
// server/api/auth/user.ts - Handles user login/signup
import { createError, defineEventHandler, readBody, setCookie } from 'h3'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// User authentication logic with JWT token generation and password hashing

// server/api/auth/verify.ts - Verifies authentication tokens
import { createError, defineEventHandler, getCookie } from 'h3'
import jwt from 'jsonwebtoken'

// Token verification logic

// server/api/auth/logout.ts - Handles user logout
import { defineEventHandler, setCookie } from 'h3'

// Logout logic with cookie clearing

// server/api/auth/admin-login.ts - Handles admin authentication
import { createError, defineEventHandler, readBody, setCookie } from 'h3'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// Admin authentication logic with role verification
```

### Middleware

Route protection is implemented via multiple middleware files:

```ts
// middleware/user-auth.global.ts - Protects user routes
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware if in server side rendering context
  if (!process.client) return;
  
  // Get auth state from useUserAuth
  const { isLoggedIn, checkAuthStatus, authInitialized } = useUserAuth();
  
  // Force check authentication status if not initialized
  if (!authInitialized.value) {
    await checkAuthStatus();
  }
  
  // Public routes that don't require authentication
  const publicRoutes = ['/', '/auth/login', '/auth/signup', '/contact', '/about', '/projects'];
  
  // Allow access to public routes regardless of auth status
  if (publicRoutes.some(route => to.path === route || to.path.startsWith(route + '/'))) {
    return;
  }
  
  // Redirect authenticated users away from auth pages
  if (isLoggedIn.value && to.path.startsWith('/auth/')) {
    return navigateTo('/dashboard');
  }
  
  // Redirect unauthenticated users to login
  if (!isLoggedIn.value) {
    return navigateTo({
      path: '/auth/login',
      query: { redirect: to.fullPath }
    });
  }
});

// middleware/admin-auth.global.ts - Protects admin routes
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip if not in client context or not an admin route
  if (!process.client || !to.path.startsWith('/admin')) {
    return;
  }

  // If we're on the login page, no need to check further
  if (to.path === '/admin/login') {
    return;
  }
  
  // Verify authentication and admin role
  const { currentUser, isLoggedIn, checkAuthStatus, authInitialized } = useUserAuth();
  
  // If auth isn't initialized yet, force a check
  if (!authInitialized.value) {
    await checkAuthStatus();
  }
  
  // Check authentication and admin role
  const isAuthenticated = isLoggedIn.value;
  const isAdmin = currentUser.value?.role === 'admin';
  
  // If not authenticated or not an admin, redirect to login
  if (!isAuthenticated || !isAdmin) {
    return navigateTo({
      path: '/admin/login', 
      query: { redirect: to.fullPath }
    });
  }
});
```

Additionally, server middleware protects API routes:

```ts
// server/middleware/auth.ts - API route protection
import { defineEventHandler, createError, getCookie, getHeader } from 'h3';
import jwt from 'jsonwebtoken';

export default defineEventHandler((event) => {
  // JWT verification logic for API endpoints
  // Role-based access control for admin routes
});
```

## User Flow

### Registration

1. User visits `/auth/signup`
2. Enters name, email, and password
3. Form validation checks for valid email and password (min 6 characters)
4. On successful signup, user data is stored and user is redirected to dashboard

### Login

1. User visits `/auth/login`
2. Enters email and password
3. Credentials are validated
4. On successful login, user data is stored and user is redirected to dashboard

### Protected Content Access

1. User attempts to access protected route (e.g., `/profile`)
2. Middleware checks authentication status
3. If authenticated, access is granted
4. If not authenticated, user is redirected to login page

### Profile Management

1. User accesses `/profile` to view account details
2. Can navigate to `/settings` for more detailed account management
3. Can update profile information and password
4. Can log out or delete account

## Authentication State

The authentication state is maintained using:

1. `isLoggedIn` reactive reference tracking login status from server-side verification
2. `currentUser` object containing user details including role
3. JWT tokens stored in HTTP-only cookies for security
4. Server-side verification of tokens for protected routes
2. `currentUser` reactive reference containing user data
3. localStorage persistence for session maintenance between page reloads

## Navigation Integration

The authentication status affects navigation display:

1. Large Navigation Component:
   ```vue
   <li v-if="!isLoggedIn" class="auth-links">
     <a href="/auth/login" class="login-btn">Login</a>
     <a href="/auth/signup" class="signup-btn">Sign Up</a>
   </li>
   <li v-else class="auth-links">
     <a href="/dashboard" class="dashboard-btn">My Dashboard</a>
     <a href="/profile" class="profile-btn">My Profile</a>
     <button @click="handleLogout" class="logout-btn">Logout</button>
   </li>
   ```

2. Small Navigation Component (Mobile):
   ```vue
   <template v-if="!isLoggedIn">
     <NuxtLink to="/auth/login">Login</NuxtLink>
     <NuxtLink to="/auth/signup">Sign Up</NuxtLink>
   </template>
   <template v-else>
     <NuxtLink to="/dashboard">My Dashboard</NuxtLink>
     <NuxtLink to="/profile">My Profile</NuxtLink>
     <button @click="handleLogout">Logout</button>
   </template>
   ```

## Protected Pages

The following pages are protected and require authentication:

1. `/profile` - User profile information
2. `/dashboard` - User dashboard with activity overview
3. `/settings` - Account management options
4. `/account` - (Reserved for future use)

## Security Considerations

This implementation uses client-side storage (localStorage) which is suitable for prototyping but has security limitations:

1. **Production Enhancements Needed:**
   - Replace localStorage with HTTP-only cookies
   - Implement proper token-based authentication (JWT, etc.)
   - Add CSRF protection
   - Implement proper password hashing on the server
   - Add rate limiting for login attempts

2. **Current Limitations:**
   - Client-side authentication is vulnerable to XSS attacks
   - localStorage persistence can be manipulated by users
   - No true server-side validation in the demo implementation

## Extending the System

To extend this authentication system:

1. **Backend Integration:**
   - Update the API endpoint to communicate with a proper authentication server
   - Implement secure token handling
   - Add session management

2. **Additional Features:**
   - Email verification
   - Password reset functionality
   - Two-factor authentication
   - Social login options

3. **User Roles:**
   - Implement role-based access control
   - Define permission levels
   - Enhance middleware to check permissions

## Conclusion

This authentication system provides a solid foundation for user account management in the Cloudless.gr application. While the current implementation uses client-side storage for demonstration purposes, it is designed with the appropriate hooks to be easily upgraded to a production-ready authentication system with proper backend integration.
