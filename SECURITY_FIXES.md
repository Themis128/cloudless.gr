# Security Fixes Applied - Backend/Frontend Sync

## Overview
Fixed critical security vulnerabilities in user and admin API endpoints by adding JWT authentication and updating frontend to send authentication headers.

## Issues Fixed

### 🔴 ISSUE #1: User Data Privacy - FIXED ✅

**Problem:** User purchase and consultation endpoints were accessible by anyone using an email query parameter.
- `/api/user/purchases?email=victim@example.com` → No auth required
- `/api/user/consultations?email=victim@example.com` → No auth required

**Solution:**
- Added `requireAuth()` check to both endpoints
- Removed email query parameter; now uses authenticated user's email from JWT
- Frontend updated to send JWT token in `Authorization: Bearer <token>` header

**Files Modified:**
- `src/app/api/user/purchases/route.ts` - Added JWT auth
- `src/app/api/user/consultations/route.ts` - Added JWT auth
- `src/app/[locale]/dashboard/purchases/page.tsx` - Uses fetchWithAuth()
- `src/app/[locale]/dashboard/consultations/page.tsx` - Uses fetchWithAuth()
- `src/app/[locale]/dashboard/page.tsx` - Uses fetchWithAuth()

### 🔴 ISSUE #2: Admin Endpoints - Authorization - FIXED ✅

**Problem:** 7 admin endpoints had no authentication checks (client-side only).
- `/api/admin/users` - Manage users
- `/api/admin/orders` - View all orders
- `/api/admin/crm/contacts` - View CRM
- `/api/admin/analytics/seo` - SEO analytics
- `/api/admin/analytics/web` - Web analytics
- `/api/admin/ops/errors` - Error tracking
- `/api/admin/notifications/test` - Send test notifications

**Solution:**
- Added `requireAdmin()` check to verify:
  1. User has valid JWT token
  2. User is in `admin` group (via `cognito:groups` claim)
- Returns 401 if no token, 403 if not admin
- Frontend updated to send JWT tokens

**Files Modified:**
- All 7 admin route files now include JWT auth checks
- `src/app/[locale]/admin/page.tsx` - Uses fetchWithAuth()
- `src/app/[locale]/admin/users/page.tsx` - Uses fetchWithAuth()

### 🟡 ISSUE #3: Unused Calendar Endpoints - DOCUMENTED

**Routes:**
- `/api/calendar/availability`
- `/api/calendar/book`

**Status:** Documented as future features. No action needed currently.

## New Files Created

### `src/lib/api-auth.ts`
Server-side authentication helper with utilities:
- `getTokenFromHeader()` - Extract JWT from Authorization header
- `decodeToken()` - Decode and validate JWT expiry
- `isAdmin()` - Check if user has admin role
- `requireAuth()` - Middleware for protected routes
- `requireAdmin()` - Middleware for admin-only routes

### `src/lib/fetch-with-auth.ts`
Client-side fetch helper:
- `fetchWithAuth()` - Automatically adds JWT to requests
- Retrieves token from Amplify session
- Falls back to unauthenticated request if needed

## Frontend Changes

All protected API calls updated to use `fetchWithAuth()`:
- Dashboard components now send JWT automatically
- No manual email parameter needed
- Cleaner API contracts

## Testing Checklist

- [ ] Test login/auth flow works
- [ ] Dashboard purchases page loads with JWT
- [ ] Dashboard consultations page loads with JWT
- [ ] Admin users page requires admin role
- [ ] Admin orders page requires admin role
- [ ] Unauthenticated requests get 401/403
- [ ] Non-admin users get 403 on admin routes

## Migration Notes

**For frontend consumers of these APIs:**

Old pattern:
```typescript
const res = await fetch(`/api/user/purchases?email=${email}`);
```

New pattern:
```typescript
import { fetchWithAuth } from "@/lib/fetch-with-auth";
const res = await fetchWithAuth("/api/user/purchases");
```

The JWT token is automatically included in the Authorization header.

## Security Best Practices Applied

1. **Server-side validation** - JWT verified on backend, not client
2. **User ownership** - Can only access own data (email from JWT)
3. **Admin verification** - Cognito groups checked for admin role
4. **Token expiry** - Expired tokens rejected
5. **Consistent headers** - Authorization header pattern (Bearer scheme)
6. **Fallback handling** - Graceful degradation if auth fails

