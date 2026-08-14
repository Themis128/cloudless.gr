# Test Accounts & Access Model (D1)

Playwright e2e accounts and how local login/signup/admin work. Source of truth:
`src/lib/auth-d1.ts`, `src/lib/api-auth.ts`, `src/proxy.ts`, `e2e/auth.setup.mts`.

## Identity provider

- **Cloudflare D1** (`user-auth-db`) — email/password (PBKDF2) + opaque
  `session_token` cookie. Cognito is retired.
- Login UI: `/{locale}/auth/login` · Signup: `/{locale}/auth/signup`
- APIs: `POST /api/auth/register-d1`, `POST /api/auth/login`, `POST /api/auth/logout`

## How "admin" is decided

- D1 `roles` table (or equivalent admin flag) → session `groups: ["admin"]`.
- Pages: `src/proxy.ts` + client `AuthContext` (also honors `e2e_admin=1` when
  `NEXT_PUBLIC_E2E=1`).
- APIs: `requireAdmin` in `src/lib/api-auth.ts`. In E2E, Bearer
  `E2E_ADMIN_TOKEN` (env) synthesizes an admin when `NEXT_PUBLIC_E2E=1`.

## Access tiers

| Tier | Routes | Requirement |
|------|--------|-------------|
| Public | marketing, store, public APIs | none |
| Authenticated user | `/dashboard/**` | valid D1 session |
| Admin | `/admin/**`, `/api/admin/**` | session + admin role (or E2E bypass) |

Unauthenticated `/admin` → redirect to login. Unauthenticated `/api/admin/**`
→ **401/403** (never treat transient **404** as success in security tests).

## Local / CI bootstrap

Interactive `pnpm dev`, Playwright, and CI use **live** Cloudflare D1
`user-auth-db` (same database as https://cloudless.gr) via `AUTH_DB_USE_HTTP=1`.
Login/signup from tests mutate production auth data.

Required env:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (D1 `Edit` on `user-auth-db`)
- `SESSION_SECRET` **identical to production** (password hashes mix this secret)

CI reads those from GitHub secrets (`CF_ACCOUNT_ID` / `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_API_TOKEN`, `SESSION_SECRET`). Isolated sqlite: `pnpm dev:local-auth`
or `AUTH_DB_PREFER_LOCAL=1`.

```bash
# Live auth (default): same users as cloudless.gr
pnpm dev

# Isolated local sqlite instead
pnpm dev:local-auth
# 1) Create / migrate local D1 sqlite
pnpm exec wrangler d1 migrations apply user-auth-db --local

# Seed only the local sqlite (does not touch production)
NEXT_PUBLIC_E2E=1 E2E_ADMIN_TOKEN=e2e-admin-token-do-not-use-in-prod pnpm dev:local-auth

curl -X POST http://localhost:4000/api/auth/register-d1 \
  -H 'Content-Type: application/json' \
  -d '{"email":"testadmin@cloudless.gr","password":"AdminPass123!","name":"Test Admin"}'
```

Confirm which DB `next-dev` is using:

```bash
curl -sS http://127.0.0.1:4000/api/health
# "authDb":"d1-http" → live user-auth-db
# "authDb":"local-or-binding" → sqlite / OpenNext bind
```

If signup returns `{"error":"Failed to create user"}` on **local sqlite**, re-apply
migrations (`0015-fix-user-role-fk.sql` rebuilds a broken `user_role` FK that still
referenced `user_old`). `auth-db-local` also auto-repairs `user_role` and `session`
FKs that still point at `user_old`.

Env for Playwright (`playwright.config.mts` webServer + CI):

| Var | Default / CI value |
|-----|--------------------|
| `NEXT_PUBLIC_E2E` | `1` |
| `NEXT_PUBLIC_AUTH_PROVIDER` | `d1` |
| `E2E_ADMIN_TOKEN` | `e2e-admin-token-do-not-use-in-prod` |
| `E2E_USER_EMAIL` | `testuser@cloudless.gr` |
| `E2E_USER_PASSWORD` | `TestPass123!` |
| `E2E_ADMIN_EMAIL` | `testadmin@cloudless.gr` |
| `E2E_ADMIN_PASSWORD` | `AdminPass123!` |

**Port 4000:** free any foreign `pnpm dev` before the suite. Playwright sets
`NEXT_PUBLIC_E2E=1` on its own webServer; a reused server without that env
will 401 the E2E Bearer token (admin API sweeps / datalake gold test).

If login fails, `e2e/auth.setup.mts` falls back to empty user state / `e2e_admin`
cookie so admin **page** sweeps still run. API sweeps use Bearer
`E2E_ADMIN_TOKEN`.

## Datalake gold serving (admin analytics)

`/api/admin/analytics/datalake` is snapshot-first (R2 gold + D1 hot overlay).
Unauth → 401/403. With E2E admin token → JSON `{ cache, source, sections }`
including `stripe_revenue`, `freshness`, etc. See `docs/data/datalake.md`.

## Playwright commands

```bash
pnpm exec wrangler d1 migrations apply user-auth-db --local
pnpm exec playwright test --config=playwright.config.mts \
  --project=chromium --workers=2 e2e/migrated/admin-api.spec.ts
```

CI workflow `.github/workflows/e2e-full-coverage.yml` applies local D1
migrations, seeds users, then runs the suite.
