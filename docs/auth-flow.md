# Authentication Flow — cloudless.gr

Complete reference for the user/admin auth process and all post-login redirects.

## Stack

| Layer | Technology |
|-------|-----------|
| Identity provider | AWS Cognito (OIDC) |
| Auth framework | Auth.js v5 (next-auth) |
| Session strategy | JWT cookie (short claims) + DynamoDB (tokens) |
| Admin gate | `cognito:groups` claim — membership in the `admin` group |

---

## Flow 1 — Initial login (browser)

```
User hits protected page  OR  clicks "Log in"
         │
         ▼
/[locale]/auth/login?next=/admin/...     ← redirect param set by middleware
         │
         │  Already logged in?
         ├─yes─► router.push(normalizeRedirectPath(next))
         │        or /admin (admin) / /dashboard (user)
         │
         ▼ no
  User clicks "Continue with AWS"
         │
         ▼
  signIn("cognito", { callbackUrl })
         │  callbackUrl = normalizeRedirectPath(next) ?? "/auth/post-login"
         │
         ▼
  Cognito Hosted UI  (OAuth 2.0 PKCE)
         │
         ▼
  POST /api/auth/callback/cognito  (Auth.js)
         │
         ├─ jwt callback ──► handleSignIn()
         │                    • extract cognito:groups from idToken
         │                    • putTokens(userId, {idToken, refreshToken}) → DynamoDB
         │                    • cookie carries: sub, groups, expiresAt only
         │
         └─ session callback ► fetchTokens(userId) ← DynamoDB
                               • populate session.user.groups / .roles
         │
         ▼
  Cognito redirects browser to callbackUrl
         │
         ├─ callbackUrl = /auth/post-login  (default)
         │          │
         │          ▼  (server component, force-dynamic)
         │   reads session → checks groups
         │          ├─ admin  ──► redirect /{locale}/admin
         │          └─ user   ──► redirect /{locale}/dashboard
         │
         └─ callbackUrl = /admin/some/page  (preserved redirect)
                    ▼
            lands directly on requested page
```

### Redirect parameter rules

| Source | Param name | Where it's set | Who reads it |
|--------|-----------|----------------|-------------|
| Middleware (unauthenticated access to `/admin/*` or `/dashboard/*`) | `?redirect=` | `proxy.ts` line 371 | `login/page.tsx` |
| Login page form submit | `?next=` | caller | `login/page.tsx` |

**Security validation** (`isSafeRedirectPath`):

- Blocks `//` and `/\` (open redirect via protocol-relative or backslash)
- Blocks CR/LF (header injection)
- Blocks paths longer than 2048 chars
- Must start with `/`

**Locale normalization** (`normalizeRedirectPath`): strips the leading locale segment (e.g. `/en/admin` → `/admin`) so `router.push` doesn't double-prefix it.

---

## Flow 2 — Self-service signup (Cognito Hosted UI path)

```
/[locale]/auth/signup?plan=starter
         │
         ▼
  signIn("cognito", { callbackUrl: "/auth/post-login" })
         │
         ▼
  Cognito Hosted UI handles account creation + email verification
         │
         ▼
  Same callback flow as Flow 1
         │
         ▼
  /auth/post-login → /dashboard  (new user has no admin group)
```

### Self-service signup (custom registration fallback)

Only active when `NEXT_PUBLIC_AUTH_PROVIDER !== "cognito"`:

```
POST /api/auth/register
  • AdminCreateUser (SUPPRESS email, set permanent password)
  • Generate nonce.exp.hmac token + 6-digit OTP
  • Send branded SES email
  • Return { ok: true, token }
         │
         ▼
POST /api/auth/activate  (OTP typed)
  OR
GET  /api/auth/activate?email=...&token=...  (email link)
  • Verify HMAC + expiry
  • AdminConfirmSignUp → Cognito marks email_verified
         │
         ▼
Redirect to /auth/login?activated=1
```

---

## Flow 3 — API / server-side auth (Bearer token)

```
Client (cron, Slack, external)
         │
         │  Authorization: Bearer <Cognito access-token or id-token>
         ▼
requireAuth() / requireAdmin()  ←  src/lib/api-auth.ts
         │
         ├─ verifyJwt()
         │   • fetch JWKS from ${COGNITO_DOMAIN}/.well-known/jwks.json (cached)
         │   • RS256 signature + issuer + audience check
         │   • extract cognito:groups
         │
         ├─ isAdmin() check (for requireAdmin)
         │   • groups.includes("admin")
         │   OR realm_access.roles includes "admin" / "realm:admin"
         │
         └─ return { ok, user }  or  NextResponse 401/403
```

---

## Flow 4 — Token refresh (transparent, during session)

```
Any page load / API call
         │
         ▼
Auth.js jwt callback
         │
         ├─ token still valid (expiresAt > now + 30s)?  ──► return token as-is
         │
         └─ token expiring soon
                    │
                    ▼
             fetchTokens(userId)  ← DynamoDB
                    │
                    ▼
             POST ${COGNITO_DOMAIN}/oauth2/token
               grant_type=refresh_token
                    │
                    ├─ success ──► putTokens() → DynamoDB, update cookie expiresAt
                    │
                    └─ failure ──► token.error = "RefreshTokenError"
                                        │
                                        ▼
                              AuthContext detects error
                                        │
                                        ▼
                              signOut() → redirect /
```

---

## Flow 5 — Sign-out

```
User clicks "Log out"  (or RefreshTokenError detected)
         │
         ▼
AuthContext.handleSignOut()
         │
         ├─ clearSessionCache()
         ├─ nextAuthSignOut({ callbackUrl: "/" })
         │          │
         │          ▼
         │   Auth.js signOut event handler
         │   • deleteTokens(userId) → DynamoDB cleanup
         │   • fetch ${COGNITO_DOMAIN}/logout (SSO session teardown)
         │
         ▼
Redirect to /
```

---

## Admin vs user routing decision tree

```
Authenticated session available?
  │
  no ──► middleware redirect to /auth/login?redirect=<bare-path>
  │
  yes
  │
  └─ groups.includes("admin")?
       │
       yes ──► /admin/* access allowed
       │         API routes: requireAdmin() → 200
       │
       no  ──► /admin/* blocked (middleware → redirect /dashboard)
                 API routes: requireAdmin() → 403
                 /dashboard/* accessible
```

### Where group membership is checked

| Layer | File | How |
|-------|------|-----|
| Middleware (edge, no DB) | `src/proxy.ts` | `token.groups` from JWT cookie |
| Server page | `src/app/[locale]/auth/post-login/page.tsx` | `session.user.groups` via `auth()` |
| API routes | `src/lib/api-auth.ts` | `cognito:groups` from verified JWT |
| Client UI | `src/context/AuthContext.tsx` | `session.user.groups` via `/api/auth/session` |

---

## Session token architecture (avoids 4 KB CloudFront header limit)

```
Browser cookie (≤ 4 KB)
  sub         (userId)
  groups      (["admin"] or [])
  expiresAt   (Unix timestamp)
  tokensPersisted  (bool)

DynamoDB — SessionTokenStore table
  userId (PK)   → idToken, refreshToken, updatedAt, expiresAt (TTL 30d)
```

The sensitive tokens (idToken, refreshToken) never travel in cookies or CloudFront headers — they are fetched server-side from DynamoDB inside the jwt/session callbacks.

---

## Key source files

| File | Role |
|------|------|
| [src/lib/auth.ts](../src/lib/auth.ts) | Auth.js config, JWT/session callbacks, token refresh |
| [src/lib/api-auth.ts](../src/lib/api-auth.ts) | `requireAuth`, `requireAdmin`, JWKS verification |
| [src/lib/session-token-store.ts](../src/lib/session-token-store.ts) | DynamoDB token persistence |
| [src/proxy.ts](../src/proxy.ts) | Middleware: route protection, redirect injection, rate limiting |
| [src/context/AuthContext.tsx](../src/context/AuthContext.tsx) | Client auth state, profile enrichment |
| [src/app/[locale]/auth/login/page.tsx](../src/app/[locale]/auth/login/page.tsx) | Login page, redirect param handling |
| [src/app/[locale]/auth/signup/page.tsx](../src/app/[locale]/auth/signup/page.tsx) | Signup page, OTP confirmation |
| [src/app/[locale]/auth/post-login/page.tsx](../src/app/[locale]/auth/post-login/page.tsx) | Admin/user routing decision |
| [src/app/api/auth/[...nextauth]/route.ts](../src/app/api/auth/[...nextauth]/route.ts) | NextAuth route handler |
| [src/app/api/auth/register/route.ts](../src/app/api/auth/register/route.ts) | Custom registration (fallback) |
| [src/app/api/auth/activate/route.ts](../src/app/api/auth/activate/route.ts) | Email activation (link + OTP) |
