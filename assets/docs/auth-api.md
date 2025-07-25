# Authentication API Documentation

This document describes the authentication API endpoints available in the Cloudless.gr application.

## Overview

The authentication API provides endpoints for user login, registration, token verification, and account management. These endpoints implement JWT-based authentication with secure HTTP-only cookies for production environments. The API is designed to work with the `useUserAuth` composable on the client side.

## Base URL

All API endpoints are relative to the base URL of your application.

## Endpoints

### User Authentication

#### Login

**Endpoint:** `POST /api/auth/user`

**Request Body:**
```json
{
  "action": "login",
  "email": "user@example.com",
  "password": "userpassword"
}
```

**Success Response:**
```json
{
  "user": {
    "id": "1",
    "email": "user@example.com",
    "name": "User Name",
    "createdAt": "2025-05-23T12:00:00Z",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Note:** The API sets an HTTP-only cookie containing the JWT token for secure authentication. The token is also returned in the response if client-side storage is needed.

**Error Response:**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials"
}
```

#### Signup

**Endpoint:** `POST /api/auth/user`

**Request Body:**
```json
{
  "action": "signup",
  "email": "newuser@example.com",
  "password": "newuserpassword",
  "name": "New User"
}
```

**Success Response:**
```json
{
  "user": {
    "id": "2",
    "email": "newuser@example.com",
    "name": "New User",
    "createdAt": "2025-05-24T14:30:00Z",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Note:** The API sets an HTTP-only cookie containing the JWT token for secure authentication. The token is also returned in the response if client-side storage is needed.

**Error Responses:**
```json
{
  "statusCode": 409,
  "message": "Email already exists"
}
```

```json
{
  "statusCode": 400,
  "message": "Password must be at least 6 characters"
}
```

### Token Verification

**Endpoint:** `GET /api/auth/verify`

**Success Response:**
```json
{
  "authenticated": true,
  "user": {
    "id": "1",
    "email": "user@example.com",
    "name": "User Name",
    "createdAt": "2025-05-23T12:00:00Z",
    "role": "user"
  }
}
```

**Error Response:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized - Invalid token"
}
```

### Logout

**Endpoint:** `POST /api/auth/logout`

**Success Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Admin Login

**Endpoint:** `POST /api/auth/admin-login`

**Request Body:**
```json
{
  "username": "admin",
  "password": "cloudless2025"
}
```

**Success Response:**
```json
{
  "user": {
    "id": "admin-1",
    "email": "admin@cloudless.gr",
    "username": "admin",
    "name": "Admin User",
    "createdAt": "2025-01-01T00:00:00Z",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response:**
```json
{
  "statusCode": 401,
  "message": "Invalid admin credentials"
}
```

## Implementation

In the current implementation, user data is stored in memory for demonstration purposes. In a production environment, this would be replaced by a proper database solution.

### Security Features

1. **Password Hashing**: Passwords are hashed using SHA-256 before storage
2. **JWT Tokens**: JSON Web Tokens are used for secure authentication
3. **HTTP-only Cookies**: Tokens are stored in secure HTTP-only cookies
4. **Token Expiration**: Tokens have a configurable expiration time (default 7 days)
5. **Role-Based Access**: Admin routes require admin role verification
6. **CSRF Protection**: Same-site cookie policy helps prevent cross-site request forgery

### Token Refresh

**Endpoint:** `POST /api/auth/refresh-token`

**Success Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "email": "user@example.com",
    "name": "User Name",
    "createdAt": "2025-05-23T12:00:00Z",
    "role": "user"
  }
}
```

**Error Response:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized - Invalid or expired token"
}
```

### CSRF Token

**Endpoint:** `POST /api/auth/csrf`

**Success Response:**
```json
{
  "token": "6f8b53d8f9e3a4b7c1d2e5f8a7c9b3d6e1f8a7c9b3d6e1f8a7c9b3d6e1f8a7c9",
  "message": "CSRF token generated"
}
```

**Usage Note:** 
When making requests to mutation endpoints, include this token in the `x-csrf-token` header.

## Security Features

### Rate Limiting

The authentication API implements rate limiting to prevent brute force attacks:

- Maximum 5 failed login attempts within a 15-minute window
- After exceeding the limit, IP is blocked for 30 minutes
- Applies to all `/api/auth/*` endpoints except verification and token refresh

### CSRF Protection

CSRF protection is implemented to prevent cross-site request forgery:

1. Get a CSRF token from `/api/auth/csrf`
2. Include the token in the `x-csrf-token` header for all mutation requests
3. Requests without a valid token will be rejected with a 403 error

### Server-Side Code

The authentication API is implemented across multiple files:

1. `server/api/auth/user.ts` - User login and signup
2. `server/api/auth/verify.ts` - Token verification
3. `server/api/auth/logout.ts` - User logout
4. `server/api/auth/admin-login.ts` - Admin authentication
5. `server/api/auth/refresh-token.ts` - JWT token refresh
6. `server/api/auth/csrf.ts` - CSRF token generation
7. `server/middleware/rate-limit.ts` - Login attempt rate limiting
8. `server/middleware/csrf.ts` - CSRF token validation

```typescript
// API endpoint for handling user authentication
import { createError, defineEventHandler, readBody } from 'h3'

// Simple in-memory storage for demo purposes
// In a real app, you would use a database
const users = [
  {
    id: '1',
    email: 'demo@example.com',
    password: 'password', // In a real app, this would be hashed
    name: 'Demo User',
    createdAt: '2025-05-23T12:00:00Z'
  }
]

// Handler implementation...
```

## Client Integration

The client uses the `useUserAuth` composable to interact with these endpoints:

```typescript
const login = async (email: string, password: string) => {
  // Use the API endpoint for authentication
  const { data, error } = await useFetch('/api/auth/user', {
    method: 'POST',
    body: {
      action: 'login',
      email,
      password
    }
  });
  
  // Process response...
};

const signup = async (email: string, password: string, name: string) => {
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
  
  // Process response...
};
```

## Production Considerations

For a production environment, consider these enhancements:

1. **Password Security**:
   - Hash passwords using bcrypt or Argon2
   - Implement password complexity requirements

2. **Authentication**:
   - Use JWT or session-based authentication
   - Implement HTTP-only cookies for token storage

3. **Security**:
   - Add rate limiting for login attempts
   - Implement CSRF protection
   - Add input validation and sanitization

4. **Additional Features**:
   - Password reset functionality
   - Email verification
   - OAuth integration for social logins

## Error Handling

The API returns appropriate HTTP status codes for different error scenarios:

- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid credentials
- `409 Conflict`: Resource already exists (e.g., email already registered)
- `500 Internal Server Error`: Server-side issues
