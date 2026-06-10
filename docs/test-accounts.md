# Test Accounts & Access Model

This documents the two test accounts used by the Playwright e2e suite and
the authorization model they exercise. The access model is **derived from
the codebase** (`src/proxy.ts` middleware + `src/lib/api-auth.ts` API
guards), which is the source of truth.

## Identity provider

- **AWS Cognito** Hosted UI (production default since the 2026-06 migration),
  pool **`cloudless-auth`**, app client **`cloudless-app`**. Cognito
  (realm `master`, `https://auth.cloudless.gr`) remains the fallback when
  `COGNITO_ISSUER` is not set.
- The session is a **next-auth (Auth.js) v5** JWT carried in the
  `authjs.session-token` cookie (`__Secure-` prefix in production).
- The login form is served at `/{locale}/auth/login` (e.g. `/en/auth/login`).
  When `NEXT_PUBLIC_AUTH_PROVIDER=cognito`, the form renders a single
  "Continue with AWS" button that hands off to the Cognito Hosted UI
  (`src/app/[locale]/auth/login/page.tsx`).

## How "admin" is decided (group membership, not a role)

Admin status is **`admin` group membership**, surfaced into the next-auth
token as a groups claim (`cognito:groups` on Cognito, `groups` on Cognito):

- **Page routes** — `src/proxy.ts` reads the next-auth JWT and treats a user
  as admin if the groups claim includes `"admin"`.
- **API routes** — `src/lib/api-auth.ts` (`isAdmin`) checks both `groups`
  and `cognito:groups` for `"admin"`; `requireAdmin` returns **403** when
  that group is absent.

> On Cognito the `cognito:groups` claim is emitted automatically for any
> user added to the `admin` group — no protocol mapper needed (unlike
> Cognito). The provisioning script below adds the admin test user to that
> group.

## Access tiers

| Tier                   | Routes                       | Requirement                 | Enforced by                                          |
| ---------------------- | ---------------------------- | --------------------------- | ---------------------------------------------------- |
| **Public**             | everything else              | none                        | `src/proxy.ts` passes through to next-intl           |
| **Authenticated user** | `/dashboard/**`              | any valid next-auth session | `src/proxy.ts:328-338`                               |
| **Admin**              | `/admin/**`, `/api/admin/**` | session **+** `admin` group | `src/proxy.ts:331-333` (pages), `requireAdmin` (API) |

Behavior details:

- **Unauthenticated** access to `/admin/**` or `/dashboard/**` → redirect to
  `/{locale}/auth/login?redirect=<bare-path>` (`src/proxy.ts:334-337`). The
  redirect param is the **locale-stripped** path, per the rule in `CLAUDE.md`.
- **Authenticated but not admin** hitting `/admin/**` → redirected to
  `/{locale}/dashboard` (`src/proxy.ts:331-333`). API routes return **403**.
- `/portal/**` is excluded from the middleware matcher
  (`src/proxy.ts:381`) — portal access uses its own magic-link token, not
  the next-auth session.

## The two test accounts

These are exactly what `scripts/e2e-cognito-provision.sh` creates:

| Account        | Email                    | Group   | Can reach                                                               |
| -------------- | ------------------------ | ------- | ----------------------------------------------------------------------- |
| **Test user**  | `e2e-user@cloudless.gr`  | none    | `/dashboard/**`; **blocked** from `/admin` (redirected to `/dashboard`) |
| **Test admin** | `e2e-admin@cloudless.gr` | `admin` | `/admin/**`, `/api/admin/**`, plus `/dashboard/**`                      |

The plain user deliberately has **no** group — that is what proves the
`/admin` gate works: it should be bounced to `/dashboard`.

## Creating the accounts (existing tooling)

`scripts/e2e-cognito-provision.sh` provisions both users in the Cognito
`cloudless-auth` pool. It is idempotent (re-running only resets the password
and group membership), ensures the `admin` group exists, and gives each user
a **permanent** password so Playwright can drive the Hosted UI login directly
(no FORCE_CHANGE_PASSWORD step). It needs AWS creds with `cognito-idp` admin
permissions; the pool/client are discovered by name (no hard-coded IDs).

```bash
pnpm e2e:cognito:dry      # preview — no writes
pnpm e2e:cognito          # create / update both users, write .env.e2e
```

On success it writes `E2E_USER_EMAIL/PASSWORD` and
`E2E_ADMIN_EMAIL/PASSWORD` into a gitignored `.env.e2e`.

> In a cloud session without the `aws` CLI or AWS creds, run this step where
> those creds exist (or via the e2e CI job that assumes the deploy role).

## Testing the login

The Playwright `setup` project (`e2e/auth.setup.ts`) logs in at
`/auth/login`, then saves signed-in `storageState` to
`e2e/.auth/admin.json` / `user.json`, which the admin/dashboard specs reuse.
It **skips** unless the matching `E2E_*` env vars are set.

```bash
# Local suite (reads .env.e2e via scripts/e2e-with-env.sh):
pnpm e2e:setup            # bootstrap .env.e2e (CRON_SECRET + creds)
pnpm e2e:cognito          # provision the two test users
pnpm e2e:run:admin        # admin-scoped specs
pnpm e2e:run:user         # user-scoped specs

# Against production:
E2E_BASE_URL=https://cloudless.gr pnpm e2e:prod
```

What a green run proves:

- The **admin** account logs in and reaches `/admin`.
- The **user** account logs in and reaches `/dashboard` but is denied
  `/admin` (redirected) — confirming the group gate.
