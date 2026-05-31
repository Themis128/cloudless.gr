# Test Accounts & Access Model

This documents the two test accounts used by the Playwright e2e suite and
the authorization model they exercise. The access model is **derived from
the codebase** (`src/proxy.ts` middleware + `src/lib/api-auth.ts` API
guards), which is the source of truth.

## Identity provider

- **Keycloak**, realm **`master`**, at `https://auth.cloudless.gr`
  (issuer `https://auth.cloudless.gr/realms/master`, client `cloudless`).
- The session is a **next-auth (Auth.js) v5** JWT carried in the
  `authjs.session-token` cookie (`__Secure-` prefix in production).
- The login form is served at `/{locale}/auth/login` (e.g. `/en/auth/login`).
  When `NEXT_PUBLIC_KEYCLOAK_ISSUER` is set, the form renders a single
  "Continue with Keycloak" button that hands off to Keycloak's hosted login
  (`src/app/[locale]/auth/login/page.tsx:155-166`).

## How "admin" is decided (group membership, not a realm role)

Admin status is **Keycloak `admin` group membership**, surfaced into the
next-auth token as a `groups` claim:

- **Page routes** — `src/proxy.ts:42-48` reads the next-auth JWT and treats
  a user as admin if `groups` includes `"admin"` (it also accepts a
  `roles` containing `admin`/`realm:admin` as a fallback).
- **API routes** — `src/lib/api-auth.ts:108-109` (`isAdmin`) checks the
  decoded token's `cognito:groups` for `"admin"`; `requireAdmin`
  (`:140-155`) returns **403** when that group is absent.

> The `groups` claim only appears in the token if the Keycloak `cloudless`
> client has the **Group Membership** protocol mapper. The provisioning
> script below installs that mapper automatically.

## Access tiers

| Tier | Routes | Requirement | Enforced by |
| --- | --- | --- | --- |
| **Public** | everything else | none | `src/proxy.ts` passes through to next-intl |
| **Authenticated user** | `/dashboard/**` | any valid next-auth session | `src/proxy.ts:328-338` |
| **Admin** | `/admin/**`, `/api/admin/**` | session **+** `admin` group | `src/proxy.ts:331-333` (pages), `requireAdmin` (API) |

Behavior details:

- **Unauthenticated** access to `/admin/**` or `/dashboard/**` → redirect to
  `/{locale}/auth/login?redirect=<bare-path>` (`src/proxy.ts:334-337`). The
  redirect param is the **locale-stripped** path, per the rule in `CLAUDE.md`.
- **Authenticated but not admin** hitting `/admin/**` → redirected to
  `/{locale}/dashboard` (`src/proxy.ts:331-333`). API routes return **403**.
- `/portal/**` is excluded from the middleware matcher
  (`src/proxy.ts:381`) — portal access uses its own magic-link token, not
  the Keycloak session.

## The two test accounts

These are exactly what `scripts/e2e-keycloak-provision.sh` creates:

| Account | Email | Group | Can reach |
| --- | --- | --- | --- |
| **Test user** | `e2e-user@cloudless.gr` | none | `/dashboard/**`; **blocked** from `/admin` (redirected to `/dashboard`) |
| **Test admin** | `e2e-admin@cloudless.gr` | `admin` | `/admin/**`, `/api/admin/**`, plus `/dashboard/**` |

The plain user deliberately has **no** group — that is what proves the
`/admin` gate works: it should be bounced to `/dashboard`.

## Creating the accounts (existing tooling)

There is already a provisioning script. It is idempotent (re-running only
resets the password + group membership), ensures the `admin` group exists,
and installs the `groups` protocol mapper on the `cloudless` client. It
needs a Keycloak admin password — pulled from SSM
(`/cloudless/production/KEYCLOAK_ADMIN_PASSWORD`) when AWS creds + `aws`
CLI are present, otherwise prompted / read from `KEYCLOAK_ADMIN_PASSWORD`.

```bash
pnpm e2e:keycloak:dry     # preview — no writes
pnpm e2e:keycloak         # create / update both users, write .env.e2e
```

On success it writes `E2E_USER_EMAIL/PASSWORD` and
`E2E_ADMIN_EMAIL/PASSWORD` into a gitignored `.env.e2e`.

> In a cloud session without the `aws` CLI or Keycloak admin password,
> export `KEYCLOAK_ADMIN_PASSWORD` first (ideally as a session secret), or
> run this step where those creds exist.

## Testing the login

The Playwright `setup` project (`e2e/auth.setup.ts`) logs in at
`/auth/login`, then saves signed-in `storageState` to
`e2e/.auth/admin.json` / `user.json`, which the admin/dashboard specs reuse.
It **skips** unless the matching `E2E_*` env vars are set.

```bash
# Local suite (reads .env.e2e via scripts/e2e-with-env.sh):
pnpm e2e:setup            # bootstrap .env.e2e (CRON_SECRET + creds)
pnpm e2e:keycloak         # provision the two test users
pnpm e2e:run:admin        # admin-scoped specs
pnpm e2e:run:user         # user-scoped specs

# Against production:
E2E_BASE_URL=https://cloudless.gr pnpm e2e:prod
```

What a green run proves:

- The **admin** account logs in and reaches `/admin`.
- The **user** account logs in and reaches `/dashboard` but is denied
  `/admin` (redirected) — confirming the group gate.
