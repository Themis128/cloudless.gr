# Test Accounts & Access Model

This documents the two test accounts used by the e2e suite and the
authorization model they exercise. The access model is **derived from the
codebase** (middleware + server-side guards), which is the source of truth.

## Identity provider

- **Keycloak**, realm `cloudless`, at `https://auth.cloudless.gr`
  (`KEYCLOAK_URL` / `KEYCLOAK_REALM` override).
- Session is carried in the **`kc_access_token`** cookie (a JWT).
- Roles live at **`realm_access.roles`** in the token.
- The login form is served at `/{locale}/auth/login` (e.g. `/en/auth/login`).

## Access tiers (the only role that matters in code is `admin`)

| Tier | Routes | Requirement | Enforced by |
| --- | --- | --- | --- |
| **Public** | everything outside the prefixes below | none | `src/middleware.ts` (passes through to next-intl) |
| **Authenticated user** | `/dashboard/**`, `/portal/**` | any valid `kc_access_token` | `src/middleware.ts` (token presence), `requireAuth` in `src/lib/auth-guard.ts` |
| **Admin** | `/admin/**`, `/api/admin/**` | `realm_access.roles` includes **`admin`** | `src/middleware.ts` (`roles.includes("admin")`), `requireAdmin` in `src/lib/auth-guard.ts` |

Behavior details:

- **Unauthenticated** access to a protected route → redirect to
  `/{locale}/auth/login?redirect=<bare-path>` (`src/middleware.ts:53-59`).
- **Authenticated but not admin** hitting `/admin/**` → redirected to
  `/{locale}/dashboard` in the UI (`src/middleware.ts:65-71`); API routes
  return **403** via `requireAdmin` (`src/lib/auth-guard.ts:47-52`).
- API tokens are verified against Keycloak's JWKS, not just decoded
  (`src/lib/auth-guard.ts:13-29`). The Edge middleware only base64-decodes
  the JWT payload for the role check (it does not verify the signature) —
  the authoritative verification happens server-side in the route guards.
- Any authenticated user can self-enroll in the portal; admins can enroll
  others (`src/app/api/portal/enroll/route.ts:33-35`).

## The two test accounts

| Account | Default email | Realm roles | Can reach |
| --- | --- | --- | --- |
| **Test admin** | `test-admin@cloudless.gr` | `["admin"]` | `/admin/**`, `/api/admin/**`, plus everything below |
| **Test user** | `test-user@cloudless.gr` | `[]` (plain) | `/dashboard/**`, `/portal/**`; **blocked** from `/admin` (redirected to `/dashboard`) |

The plain user deliberately has **no** privileged role — that is exactly
what proves the `/admin` gate works: it should be bounced to `/dashboard`.

## Creating the accounts

Accounts are minted through the Keycloak admin API helpers in
`src/lib/keycloak-admin.ts` (`createUser`, `setPassword`,
`assignRealmRoles`). The script is **idempotent** — re-running updates the
existing user (password reset + role re-assert) instead of erroring on the
409 conflict.

```bash
# Requires Keycloak admin creds in env (or SSM on Lambda/Pi):
#   KEYCLOAK_ADMIN_USER, KEYCLOAK_ADMIN_PASSWORD
pnpm test-users:create --dry-run     # preview
pnpm test-users:create               # create / update both
pnpm test-users:create --admin-only  # just the admin
pnpm test-users:create --user-only   # just the plain user
```

If `E2E_ADMIN_PASSWORD` / `E2E_USER_PASSWORD` are not provided, the script
generates strong passwords and prints them. Capture the printed
`E2E_*` values as env vars (ideally **session secrets**, not pasted into
chat) for the test step.

> Note: `getIntegrationsAsync()` (`src/lib/ssm-config.ts:237-254`) tries
> SSM first and falls back to env vars, so this script runs anywhere the
> two `KEYCLOAK_ADMIN_*` vars are set — no AWS access required.

## Testing the login

The Playwright `setup` project (`e2e/auth.setup.ts`) logs in at
`/auth/login`, then saves a signed-in `storageState` to
`e2e/.auth/admin.json` / `user.json`, which the admin/dashboard specs reuse.
It **skips** unless the matching `E2E_*` env vars are set.

```bash
# Drive the real login flow against production:
E2E_BASE_URL=https://cloudless.gr \
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
E2E_USER_EMAIL=...  E2E_USER_PASSWORD=...  \
pnpm e2e:prod
```

What a green run proves:

- The **admin** account logs in and reaches `/admin` (admin specs run
  against `e2e/.auth/admin.json`).
- The **user** account logs in and reaches `/dashboard` but is denied
  `/admin` (redirected) — confirming the role gate.
