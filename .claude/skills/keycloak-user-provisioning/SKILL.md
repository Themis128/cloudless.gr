---
name: keycloak-user-provisioning
description: Create / manage cloudless.gr Keycloak users when self-service signup is disabled. Use when the user says "create a user", "add an account", "sign me up", "make an admin user", "register a user", "the signup button doesn't work", or wants to verify login/registration on the live site. Covers admin-provisioning via kcadm in-pod, the admin-group gate, and enabling self-registration.
argument-hint: "email, e.g. someone@cloudless.gr [--admin]"
---

# Keycloak User Provisioning — cloudless.gr

## The key fact: self-service registration is DISABLED

On the **master** realm, `registrationAllowed` is **off** — the hosted
`/realms/master/protocol/openid-connect/registrations` page returns the login
screen (HTTP 400), and the website's "Create Account" button cannot self-enrol
users. **Users are admin-provisioned.** (Verify the realm flag with
`pnpm keycloak:smoke` — check 4.)

Two ways to act on this:
1. **Provision a user yourself** (default, supported) — `keycloak:create-user`.
2. **Enable public self-signup** (only if the user explicitly wants the signup
   button to work) — `pnpm keycloak:enable-signup`
   (`scripts/keycloak-enable-signup.sh`) sets `registrationAllowed=true` plus
   `resetPasswordAllowed`/`loginWithEmailAllowed` on the realm via kcadm in-pod.
   `ENABLE=false` reverts it. From a cloud session use
   `.github/workflows/keycloak-full-verify.yml` (enables signup + provisions +
   verifies, posts to #382). This is a product/security decision (anyone can
   then create an account) — confirm before flipping it.

## Provisioning a user

`pnpm keycloak:create-user` (`scripts/keycloak-create-user.sh`) runs `kcadm.sh`
**inside the keycloak pod**, so the admin password never leaves the cluster. It
is idempotent (an existing username is reused; only password / group are reset)
and verifies the new password authenticates via an `admin-cli` direct grant.

```bash
EMAIL=user@cloudless.gr  bash scripts/keycloak-create-user.sh           # regular user
EMAIL=admin@cloudless.gr ADMIN=1 bash scripts/keycloak-create-user.sh    # app admin
EMAIL=x@y TEMPORARY=1 bash scripts/keycloak-create-user.sh               # must reset on first login
```

Env: `EMAIL` (required), `PASSWORD` (generated if unset — printed on a
`CREDENTIAL ...` line that the workflow strips before posting), `ADMIN=1`
(add to the `admin` group), `TEMPORARY=1`, `NAMESPACE`/`DEPLOYMENT`/`REALM`.

### From a cloud session (no kubectl)

Use the **`.github/workflows/keycloak-create-user.yml`** workflow — hosted runner
+ Tailscale + `KUBECONFIG_B64`, posts a redacted result (no password) to issue
**#382**. `workflow_dispatch` takes `email`/`admin`/`temporary` inputs; a
path-filtered push (editing the workflow or the script) runs it with the default
idempotent email `signup-verify@cloudless.gr`. (The GitHub MCP here cannot
`workflow_dispatch` — trigger via a push, or have the user click Run.) See the
**cluster-incident-response** skill for the general workflow→#382 pattern.

## Bootstrapping the sole admin when you cannot deliver a password

You often can't get the admin's chosen password into CI: this session has no
GitHub `Secrets: write` token, the `gh:secrets` script only lists/deletes, and
the Actions "Run workflow" input doesn't render in the GitHub mobile app. Do NOT
commit the password.

Instead use **`pnpm keycloak:bootstrap-admin`** (`scripts/keycloak-bootstrap-admin.sh`
→ `keycloak-bootstrap-admin.yml`): it generates a **one-time TEMPORARY password
inside the cluster**, ensures the full admin chain (group + groups mapper on
`cloudless-app` + membership), enforces single-admin (removes every other
admin-group member — safe, since the sole admin now has a working temp login),
and posts the temp login to issue #382. The human signs in once at `/auth/login`
and Keycloak forces UPDATE_PASSWORD, so they set their own final password. The
real password is never committed, never a secret, never typed into CI.

> A temporary password fails a direct-grant check (`Account is not fully set
> up`), so the bootstrap tool does NOT run `LOGIN_VERIFIED` — that is expected.

The alternative paths (a `ADMIN_BOOTSTRAP_PASSWORD` repo secret, or the
`workflow_dispatch` password input on a desktop browser) feed
`keycloak:configure-admin`, which sets the password directly and verifies login.

## How "admin" is decided

App admin = membership of the Keycloak **`admin` group** (surfaced as the
`groups` claim). `src/lib/api-auth.ts` `isAdmin()` and `src/proxy.ts` gate on it;
`ADMIN=1` adds the user to that group. A plain user reaches `/dashboard` only.

## Verifying login actually works

Keycloak's `cloudless-app` client **enforces PKCE** and **disallows direct
access grants**, so you cannot password-grant against `cloudless-app`. Verify a
provisioned user with a direct grant against **`admin-cli`** (the script does
this → `LOGIN_VERIFIED=yes`). The real website login is the auth-code+PKCE flow:
`POST /api/auth/signin/keycloak` (with CSRF) → `302` to
`auth.cloudless.gr/.../openid-connect/auth?...code_challenge_method=S256`. A bare
**GET** to that endpoint returns `error=Configuration` — that is a test artifact,
not a bug (next-auth POSTs with PKCE).

## Reference

- Realm `master`, IdP `https://auth.cloudless.gr`, app client `cloudless-app`
  (public, PKCE), manager client `cloudless-manager`. Admin creds in SSM
  `/cloudless/production/KEYCLOAK_ADMIN_{USER,PASSWORD}` and in the keycloak pod
  env (used in-pod by the script). Never print or commit them.
- Existing e2e provisioning: `scripts/e2e-keycloak-provision.sh`
  (`pnpm e2e:keycloak`) creates `e2e-user@` / `e2e-admin@` and writes `.env.e2e`.
- Companion: `tools/keycloak-cli/keycloak.sh` and the `keycloak-ops` skill.
