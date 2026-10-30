# Authentik — self-hosted IdP (replaces CF Access for internal GUIs)

Deployed on omv k3s, namespace `authentik`. Admin portal: https://auth.cloudless.gr/if/admin/

## Architecture

```
browser → <host>.cloudless.gr → tunnel → authentik outpost → backend service
                                          (SSO gate: akadmin users + MFA)
```

- **Embedded outpost** (inside `authentik-server` pod, NodePort :30910) gates
  omv-side services: `omv`, `files`
- **Remote outpost** (`authentik-outpost` container on cu130, network
  `cu130-backend`) gates cu130 docker services: metabase, portainer, env,
  grafanadev, flower, jupyter, n8n-sandbox, prometheus, alertmanager,
  cadvisor, novnc, engage, comfy
- Tunnel ingress for gated hosts points at the outpost, never the service
- The outpost token lives in cu130 `.env` as `AUTHENTIK_OUTPOST_TOKEN`

## Deploy

`kubectl apply -f k3s-authentik.yaml` — creates ns, secret, postgres(4Gi PVC),
redis, server+worker, NodePort :30910. Rotate the secret values first.

## Adding a gated host

1. authentik admin → Applications → Providers → new Proxy provider
   (external_host = https://x.cloudless.gr, internal_host = http://target:port)
2. Create Application bound to it; assign provider to the right outpost
   (embedded = omv services, cu130 = docker services)
3. Tunnel: hostname → `http://192.168.1.128:30910` (omv) or
   `http://authentik-outpost:9000` (cu130)
4. DNS CNAME → the tunnel's cfargotunnel record

Bootstrap password lives in the `authentik-secret` k8s secret
(`bootstrap-password` key); ops API token identifier `ops-api`.

## OIDC login for SocialAuto (added 2026-10-30)

SocialAuto's own user login now goes through authentik — its accounts live in
the IdP, not just its JWT store.

- Provider `social-oidc` (client_id `social_client`) →
  `auth.cloudless.gr/application/o/social-oidc`
- social-api endpoints: `GET /api/v1/auth/oidc/authorize` →
  `/oidc/callback` — exchanges the code, pulls userinfo, upserts the user by
  email, mints the app's JWT
- Flow: SocialAuto login → `auth.cloudless.gr` → sign in → back to SocialAuto
  as an authenticated user. Platform OAuth connections (X/Meta/…) stay in
  `social_accounts` — OIDC only replaces the *user* login.

## Full auth map (2026-10-30)

```
                      ┌─────────────────────────────────┐
   browser ──────────►│ auth.cloudless.gr (authentik)   │
                      │  IdP: users, groups, MFA, TOTP  │
                      └───────┬───────────────┬─────────┘
              proxy outposts  │               │ OIDC
        ┌─────────────────────┘               └──────────┐
        ▼                                                ▼
┌───────────────┐                              ┌──────────────────┐
│ 15 gated GUIs │                              │ SocialAuto login │
│ (embedded+cu130)│                            │ (app JWT via OIDC)│
└───────────────┘                              └──────────────────┘
```

- **IdP**: authentik on omv k3s — users, groups (`gates-ops`), superuser
  `tbaltzakis@cloudless.gr`
- **Proxy gate**: every internal GUI is fronted by an outpost (SSO redirect)
- **OIDC**: apps that support OAuth2 get real login, not just a gate
- **CF Access**: omv tunnel hostnames use Cloudflare's separate ZT account
- **Platform OAuth**: X/Meta/LinkedIn/etc. live in `social_accounts` — never
  authentik (they're third-party providers, not your identity)
- **Secrets**: TOTP/API slots in `authentik-secret` — the canonical store
