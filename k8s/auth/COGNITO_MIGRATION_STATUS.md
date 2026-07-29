# Cognito Migration — Resolved Values & Remaining Steps

Status of the values PR #730 needs before merge/deploy.

## Live verification (2026-06-08, against deployed `main` image ba22858)

Probed production to confirm the breakage before the pipeline fix lands:

- `GET https://cloudless.gr/api/auth/providers` returns **HTML, not JSON** →
  next-auth Cognito provider is not resolving server-side on the deployed app.
- `GET /en/auth/login` bundle mentions `Cognito` but contains **no** `us-east-1_…`
  pool ID, no `amazoncognito.com` domain → `NEXT_PUBLIC_COGNITO_*` are **empty in the
  shipped client bundle**. Confirms the Keycloak-build-arg root cause; fixed in the
  pipeline commit on `chore/keycloak-to-cognito` (redeploy required to take effect).

### Open contradiction to resolve (needs AWS)

GitHub repo secrets `NEXT_PUBLIC_COGNITO_CLIENT_ID` and `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
**already exist** (set 2026-05-09) — yet the table below says the app client "does NOT
exist in SSM." Before trusting the handoff, verify the secret values:

- `NEXT_PUBLIC_COGNITO_USER_POOL_ID` should equal `us-east-1_1Bq3Mpqer`.
- `NEXT_PUBLIC_COGNITO_CLIENT_ID` should be a real app client in that pool whose callback
  list includes `https://cloudless.gr/api/auth/callback/cognito`.
Secret values can't be read via `gh`; check the Cognito console or re-`gh secret set` with
known-good values.

## Confirmed (from SSM + public OIDC discovery)

| Value | Source | Status |
|-------|--------|--------|
| User Pool ID | SSM `COGNITO_USER_POOL_ID` | `us-east-1_1Bq3Mpqer` ✅ |
| Issuer | OIDC discovery | `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_1Bq3Mpqer` ✅ |
| Hosted UI domain | OIDC discovery | `https://cloudless-auth.auth.us-east-1.amazoncognito.com` ✅ |
| oauth2-proxy client (gateway) | SSM `oauth2-proxy-client-id` | `63d3fu5lp057694h0t70je4jk0` ✅ |
| Supported scopes | OIDC discovery | openid, email, phone, profile ✅ |

## Code/pipeline status (done in branch chore/keycloak-to-cognito)

The deploy pipeline previously still baked **Keycloak** `NEXT_PUBLIC_*` build-args,
so the shipped client bundle had empty `NEXT_PUBLIC_COGNITO_*` and login fell back to
a broken path. Fixed:

- `Dockerfile` — ARG/ENV now `NEXT_PUBLIC_COGNITO_USER_POOL_ID` / `_CLIENT_ID` / `_DOMAIN`.
- `.github/workflows/deploy-pi.yml` (Pi/k3s) — build-args now pass the Cognito vars
  from GitHub secrets (`NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`)
  - the inline domain.
- `sst.config.ts` (Lambda) — env now sets `NEXT_PUBLIC_COGNITO_USER_POOL_ID`,
  `NEXT_PUBLIC_COGNITO_DOMAIN`, `COGNITO_USER_POOL_ID` inline; `NEXT_PUBLIC_COGNITO_CLIENT_ID`
  from `process.env`; `COGNITO_CLIENT_ID` / `COGNITO_CLIENT_SECRET` from SSM at runtime.
- `scripts/lambda-env-audit.sh`, `scripts/dev-server-restart.sh` — Cognito keys.

**Still blocked on infra below** — the pipeline now wires the values, but the values
(GitHub secrets + SSM params) must exist for login to actually work.

## Still required (need Cognito console / API write — not available to omv-main-cli)

1. **App client for the Next.js app** — does NOT exist in SSM. Either:
   - Create a Cognito app client for the app (callback URLs:
     `https://cloudless.gr/api/auth/callback/cognito`, plus `https://www.cloudless.gr/...`
     and any locale-prefixed variants if used; sign-out URL `https://cloudless.gr/`),
     then store its ID as SSM `/cloudless/production/COGNITO_CLIENT_ID` (+ secret if
     "Generate a client secret" was enabled → `COGNITO_CLIENT_SECRET`), and the public
     copy `NEXT_PUBLIC_COGNITO_CLIENT_ID` / `NEXT_PUBLIC_COGNITO_DOMAIN`.
   - OR reuse `63d3fu5lp057694h0t70je4jk0` if its callback list also includes the app's
     `/api/auth/callback/cognito` URLs (verify in console first).

2. **Admin group** — confirm a group named `admin` exists in pool `us-east-1_1Bq3Mpqer`
   and is emitted in the `cognito:groups` claim. `proxy.ts` and `admin/users` route gate
   admin access on `cognito:groups` containing `admin`. If the group has a different name,
   set `COGNITO_ADMIN_GROUP` accordingly.

3. **oauth2-proxy** — before `kubectl apply -f k8s/auth/oauth2-proxy.yaml`, confirm client
   `63d3fu5lp057694h0t70je4jk0` has `https://manage.cloudless.gr/oauth2/callback` registered.

## SSM commands to set the app client (once created)

    aws ssm put-parameter --name /cloudless/production/COGNITO_CLIENT_ID --type String --value <APP_CLIENT_ID> --overwrite --region us-east-1
    aws ssm put-parameter --name /cloudless/production/NEXT_PUBLIC_COGNITO_CLIENT_ID --type String --value <APP_CLIENT_ID> --overwrite --region us-east-1
    aws ssm put-parameter --name /cloudless/production/NEXT_PUBLIC_COGNITO_DOMAIN --type String --value https://cloudless-auth.auth.us-east-1.amazoncognito.com --overwrite --region us-east-1
    # only if the client has a secret:
    aws ssm put-parameter --name /cloudless/production/COGNITO_CLIENT_SECRET --type SecureString --value <SECRET> --overwrite --region us-east-1

## GitHub repo secrets to set (Pi/k3s deploy reads these as build-args)

The `deploy-pi.yml` build bakes the public Cognito vars from repo secrets — they must
be set or the Pi image ships with an empty client config (login broken):

    gh secret set NEXT_PUBLIC_COGNITO_USER_POOL_ID --body us-east-1_1Bq3Mpqer
    gh secret set NEXT_PUBLIC_COGNITO_CLIENT_ID    --body <APP_CLIENT_ID>
    # NEXT_PUBLIC_COGNITO_DOMAIN is inlined in Dockerfile + workflow (no secret needed).

For the **Lambda** deploy, `NEXT_PUBLIC_COGNITO_CLIENT_ID` is read from the deploy
environment (`process.env`) by `sst.config.ts`; `COGNITO_CLIENT_ID` / `COGNITO_CLIENT_SECRET`
are loaded from SSM at runtime by `src/lib/ssm-config.ts` + `src/instrumentation.ts`.

## Public client (PKCE) vs confidential client

`auth.ts` / `cognito-auth.ts` use Authorization Code + PKCE. If the app client is created
**without** a secret (recommended for browser-redirect OIDC), leave `COGNITO_CLIENT_SECRET`
unset — next-auth handles PKCE without it. Only set the secret if "Generate a client secret"
was enabled when creating the app client.
