---
name: selfhosted-admin-bootstrap
description: |
  Add the unified admin account (tbaltzakis@cloudless.gr / TH!123789th!) to
  any self-hosted app on the cloudless.gr k3s cluster. Triggered by phrases
  like "add admin to <app>", "give me admin on <app>", "create my account
  on the new self-hosted app", "bootstrap admin on <app>", "rotate the
  admin password across all apps", "I can't log into <app>", or any setup of
  a freshly deployed self-hosted service.
---

# Unified admin bootstrap toolkit

cloudless.gr's self-hosted stack runs **one** admin identity across every
app: **`tbaltzakis@cloudless.gr`** (or username `tbaltzakis` where email
isn't supported) with password **`TH!123789th!`**. Rotating the password
on all apps is a single sweep.

This skill captures the per-app bootstrap recipe so future-you doesn't have
to re-derive the right table / API call / CLI command each time. Every
recipe is **idempotent** — re-running it sets the password without
breaking existing data.

## Inventory at time of writing (2026-06-21)

| App | URL | Username | How admin is marked |
| --- | --- | --- | --- |
| AppFlowy | https://appflowy.cloudless.gr/console | `tbaltzakis@cloudless.gr` | `auth.users.is_super_admin=true` + `af_user`/`af_workspace`/`af_workspace_member` rows |
| EspoCRM | https://espocrm.cloudless.gr/ | `tbaltzakis` | `user.type='admin'` + email link in `entity_email_address` |
| Postiz | https://postiz.cloudless.gr/ | `tbaltzakis@cloudless.gr` | `User.isSuperAdmin=true` + `UserOrganization.role='SUPERADMIN'` |
| Grafana | https://grafana.cloudless.gr/ | `tbaltzakis` | `isGrafanaAdmin=true` via REST API |
| n8n | https://n8n.cloudless.gr/ | `tbaltzakis@cloudless.gr` | `user.role='global:admin'` |
| ntfy | (internal) | `tbaltzakis` | `ntfy user add --role=admin` |

The full per-app bootstrap commands live in
[`project_unified_admin_creds`](../../) memory entry.

## The five patterns by storage type

Every new app falls into one of these:

1. **Postgres with bcrypt** (AppFlowy/GoTrue, Postiz, EspoCRM) →
   `crypt(pw, gen_salt('bf', 10))` via pgcrypto.
2. **SQLite with bcrypt** (n8n) → spawn an Alpine sidecar pod mounting the
   PVC, install python3+bcrypt, write the hash directly.
3. **MariaDB** (EspoCRM) → use the app's own CLI (`php command.php
   create-admin-user`) rather than direct insert; passwords are hashed via
   app-specific algorithms that change between versions.
4. **REST API with admin bootstrap key** (Grafana) → `POST /api/admin/users`
   with basic auth from the cluster's admin Secret, then PUT permissions +
   PATCH org role.
5. **CLI tool with auth.db** (ntfy) → `ntfy user add --role=admin` with
   `NTFY_PASSWORD` env. If user already exists, `ntfy user del` first.

## Tool selection — pick the most specific that fits

1. **App has a documented bootstrap CLI?** Use it. EspoCRM
   (`php command.php create-admin-user`) + ntfy (`ntfy user add`) are the
   gold standard — no DB knowledge required, version-resilient.

2. **App has an admin REST API + a known admin password?** Use that.
   Grafana's `POST /api/admin/users` with `GF_SECURITY_ADMIN_PASSWORD`
   from the deployment env is the canonical example.

3. **App stores users in Postgres + you have direct access?** Use the
   pgcrypto recipe. Critical: GoTrue/Postiz schemas are partial-indexed on
   `(email, providerName)` so you can't use `ON CONFLICT (email)`.

4. **App stores users in SQLite inside a PVC?** Spawn an alpine sidecar
   pod with the PVC mounted. The container running the app usually doesn't
   have python or sqlite3 installed (and isn't root); a sidecar bypasses
   both problems.

## Common quirks (cost real time the first round)

### AppFlowy: `aud` field must be empty for password grant

GoTrue's password grant matches user by `(instance_id, aud, email)`. If
you set `aud='supabase_admin'` to mark the user as super-admin, the
password grant returns `invalid_credentials` — even though the bcrypt hash
validates. Set `aud=''` (empty) + `role='authenticated'` + the actual
super-admin marker is `is_super_admin=true`.

### AppFlowy: bootstrap trigger doesn't fire

AppFlowy Cloud's auth.users → public.af_user mirror runs ONLY on auth.users
INSERT. The user GoTrue auto-creates from the env `GOTRUE_ADMIN_EMAIL` does
NOT trigger the mirror (race condition: GoTrue's admin bootstrap runs
before AppFlowy Cloud finishes its migrations). Always backfill
`af_user` + `af_workspace` + `af_workspace_member` after creating an
auth.users row.

### EspoCRM: `set-password` writes to stdin

`php command.php set-password <user>` reads the new password from stdin
TWICE (new + confirm). Pipe with `yes 'pw' | php command.php set-password`
or use the create-admin-user CLI's `--password=` flag in one shot.

### EspoCRM: email is in a separate table

`user.email_address` doesn't exist as a column — emails live in
`email_address` + `entity_email_address` (column is `` `primary` ``, a
reserved word, requires backticks). Without the link, the user can't
receive notifications but CAN still log in by username.

### Postiz: composite unique index

The unique constraint is `(email, providerName)` not `email` alone. Use
`WHERE NOT EXISTS` patterns instead of `ON CONFLICT (email)`.

### n8n: container is non-root + no sqlite3

The n8n image runs as uid 1000 with no apk/sudo. Don't try to install
sqlite3 in-pod — spawn an Alpine sidecar mounting the PVC instead.

### ntfy: `user add` doesn't accept passwords as flag

Pass `NTFY_PASSWORD` as env. The CLI rejects passwords passed via `-p`.

## When you need to add admin to a brand-new self-hosted app

The pattern from this skill applies, but you'll also want to:

1. Add the app's host to the unified Cloudflare tunnel — see
   `skills/cloudflare-tunnel-ops/SKILL.md`.
2. Add an integration health-check entry in
   `src/app/api/admin/integrations/status/route.ts` (pattern: ping a public
   health endpoint, return `configured`/`degraded`/`error`).
3. If the app has an admin REST API worth automating, write a client lib
   at `src/lib/<app>.ts` mirroring `src/lib/n8n.ts` (X-API-KEY pattern) or
   `src/lib/appflowy.ts` (JWT-signing pattern).
4. If the app produces data worth analytics on, write
   `scripts/etl/<app>-to-lake.mjs` and add it to
   `.github/workflows/etl-selfhosted-to-lake.yml`.
5. Update the unified admin table in
   `project_unified_admin_creds.md` memory entry.

## Rotation runbook (rotate password across all apps)

Run each per-app block from
[`project_unified_admin_creds`](../../) with the new password. The five
patterns above all support idempotent overwrite — no user data is lost.

After rotation, verify each app with:

```bash
curl -X POST 'https://appflowy.cloudless.gr/gotrue/token?grant_type=password' \
  -H 'Content-Type: application/json' \
  --data '{"email":"tbaltzakis@cloudless.gr","password":"NEW_PW"}' | jq -r '.access_token | length'
# expect: token length > 0

curl -sI -H "X-Api-Key: $NEW_ESPOCRM_KEY" https://espocrm.cloudless.gr/api/v1/App/user
# expect: 200

curl -X POST https://slack.com/api/auth.test -H "Authorization: Bearer $NEW_SLACK_TOKEN"
# expect: ok=true
```

## See also

- `skills/appflowy-operator/SKILL.md`
- `skills/espocrm-operator/SKILL.md`
- `skills/cloudflare-tunnel-ops/SKILL.md`
- Memory: `project_unified_admin_creds`, `feedback_slack_use_slackclient`
