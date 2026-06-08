# Cognito Migration — Resolved Values & Remaining Steps

Status of the values PR #730 needs before merge/deploy.

## Confirmed (from SSM + public OIDC discovery)

| Value | Source | Status |
|-------|--------|--------|
| User Pool ID | SSM `COGNITO_USER_POOL_ID` | `us-east-1_1Bq3Mpqer` ✅ |
| Issuer | OIDC discovery | `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_1Bq3Mpqer` ✅ |
| Hosted UI domain | OIDC discovery | `https://cloudless-auth.auth.us-east-1.amazoncognito.com` ✅ |
| oauth2-proxy client (gateway) | SSM `oauth2-proxy-client-id` | `63d3fu5lp057694h0t70je4jk0` ✅ |
| Supported scopes | OIDC discovery | openid, email, phone, profile ✅ |

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