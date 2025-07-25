# API Reference

Complete reference for all backend API endpoints in the application.

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

## Authentication

Most API endpoints require authentication using JWT tokens stored in HTTP-only cookies.

### Authentication Headers

```http
Content-Type: application/json
Cookie: auth-token=<jwt-token>
```

### CSRF Protection

For state-changing operations, include CSRF token:

```http
X-CSRF-Token: <csrf-token>
```

Get CSRF token from: `GET /api/csrf-token`

---

## Authentication Endpoints

### POST /api/auth/user

User registration and login endpoint.

#### Request Body (Registration)

```json
{
  "action": "register",
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "User Name"
}
```

#### Request Body (Login)

```json
{
  "action": "login",
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### Response (Success)

```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Registration successful"
}
```

#### Response (Error)

```json
{
  "success": false,
  "error": "Email already exists",
  "code": "EMAIL_EXISTS"
}
```

### POST /api/auth/logout

Logout current user session.

#### Response

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /api/auth/refresh-token

Refresh authentication token.

#### Response

```json
{
  "success": true,
  "user": { "..." },
  "expiresAt": "2024-01-01T01:00:00.000Z"
}
```

### GET /api/auth/verify

Verify current authentication status.

#### Response

```json
{
  "authenticated": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### POST /api/auth/admin-login

Admin authentication endpoint.

#### Request Body

```json
{
  "username": "admin",
  "password": "adminPassword"
}
```

---

## Contact Management

### POST /api/contact

Submit contact form.

#### Request Body

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Inquiry about services",
  "message": "I would like to know more about..."
}
```

#### Response

```json
{
  "success": true,
  "id": "submission-uuid",
  "message": "Contact form submitted successfully"
}
```

### GET /api/contact-submissions

Get all contact submissions (Admin only).

**Authentication**: Admin required

#### Query Parameters

- `status` (optional): Filter by status (`new`, `read`, `replied`, `archived`)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

#### Response

```json
{
  "submissions": [
    {
      "id": "submission-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "Inquiry",
      "message": "Message content",
      "status": "new",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "notes": null
    }
  ],
  "total": 1,
  "hasMore": false
}
```

---

## Project Management

### GET /api/projects

Get all projects.

#### Query Parameters

- `featured` (optional): Filter featured projects (`true`/`false`)
- `status` (optional): Filter by status
- `category` (optional): Filter by category
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

#### Response

```json
{
  "projects": [
    {
      "id": "project-uuid",
      "title": "Project Title",
      "description": "Project description",
      "status": "active",
      "category": "web-development",
      "featured": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

### GET /api/projects/[slug]

Get project by slug.

#### Response

```json
{
  "id": "project-uuid",
  "title": "Project Title",
  "slug": "project-title",
  "description": "Detailed description",
  "content": "Full project content",
  "status": "active",
  "category": "web-development",
  "featured": true,
  "technologies": ["Vue.js", "Nuxt.js"],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/projects

Create new project (Admin only).

**Authentication**: Admin required

#### Request Body

```json
{
  "title": "New Project",
  "description": "Project description",
  "status": "active",
  "category": "web-development",
  "featured": false,
  "technologies": ["Vue.js"]
}
```

---

## Code Generation & LLM

### POST /api/generate

Generate code using LLM.

**Authentication**: User required

#### Request Body

```json
{
  "prompt": "Create a Vue 3 component for user profile",
  "model": "codellama:34b",
  "options": {
    "temperature": 0.7,
    "max_tokens": 2048
  }
}
```

#### Response (Streaming)

Server-sent events with generated content:

```
data: {"response": "Generated code chunk 1..."}

data: {"response": "Generated code chunk 2..."}

data: {"done": true}
```

### POST /api/llm

Direct LLM API endpoint.

**Authentication**: User required

#### Request Body

```json
{
  "prompt": "Your prompt here",
  "stream": true,
  "model": "codellama:34b"
}
```

### GET /api/load-file

Load file contents.

**Authentication**: User required

#### Query Parameters

- `path`: File path to load

#### Response

```json
{
  "content": "File content here",
  "path": "components/Example.vue",
  "size": 1024
}
```

### GET /api/list-files

List available files.

**Authentication**: User required

#### Query Parameters

- `directory` (optional): Directory to list (default: root)
- `extension` (optional): Filter by file extension

#### Response

```json
{
  "files": [
    {
      "name": "example.vue",
      "path": "components/example.vue",
      "size": 1024,
      "modified": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## Utility Endpoints

### GET /api/health

Health check endpoint.

#### Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### GET /api/csrf-token

Get CSRF token for state-changing operations.

#### Response

```json
{
  "csrfToken": "csrf-token-string"
}
```

### GET /api/credly-badges

Get Credly badges for user.

#### Query Parameters

- `username`: Credly username

#### Response

```json
{
  "badges": [
    {
      "id": "badge-id",
      "name": "Badge Name",
      "description": "Badge description",
      "image_url": "https://...",
      "issued_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## Error Responses

All endpoints use consistent error response format:

```json
{
  "success": false,
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific error details"
  }
}
```

### Common Error Codes

| Code                  | Description               | HTTP Status |
| --------------------- | ------------------------- | ----------- |
| `UNAUTHORIZED`        | Authentication required   | 401         |
| `FORBIDDEN`           | Insufficient permissions  | 403         |
| `NOT_FOUND`           | Resource not found        | 404         |
| `VALIDATION_ERROR`    | Request validation failed | 400         |
| `RATE_LIMIT_EXCEEDED` | Too many requests         | 429         |
| `INTERNAL_ERROR`      | Server error              | 500         |
| `LLM_ERROR`           | LLM service error         | 502         |
| `FILE_NOT_FOUND`      | Requested file not found  | 404         |

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Anonymous requests**: 100 requests per hour
- **Authenticated users**: 1000 requests per hour
- **LLM endpoints**: 50 requests per hour per user
- **Admin endpoints**: 500 requests per hour

Rate limit headers included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## CORS Configuration

Cross-Origin Resource Sharing (CORS) is configured for:

- **Development**: `http://localhost:3000`
- **Production**: Your production domain

## API Versioning

Current API version: `v1`

Future versions will be available at:

- `/api/v2/...`
- Version specified in `Accept` header: `application/json; version=2`

## SDK and Client Libraries

Official JavaScript/TypeScript client:

```typescript
import { ApiClient } from '@/utils/api-client';

const api = new ApiClient({
  baseUrl: process.env.API_BASE_URL,
  timeout: 10000,
});

// Usage
const projects = await api.projects.list();
const user = await api.auth.login({ email, password });
```

## Testing

Test API endpoints using the included test suite:

```bash
# Run API tests
npm run test:api

# Run with coverage
npm run test:api:coverage
```

## Related Documentation

- [Authentication System](user-authentication-system.md)
- [Code Generation Feature](codegen-feature.md)
- [Rate Limiting](rate-limiting.md)
- [CSRF Protection](csrf-protection.md)

---

**Last Updated**: December 2024
**API Version**: 1.0.0
