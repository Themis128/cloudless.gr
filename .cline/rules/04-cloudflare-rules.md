# Cloudflare Rules

## AWS → Cloudflare Migration Preference

- **Target platform is Cloudflare** (Workers, R2, D1, Access, Tunnel, DNS/CDN). New work should prefer Cloudflare-native services over AWS.
- Treat remaining AWS usage (SSM, SES, Cognito, S3, Lambda, Athena, etc.) as **legacy to migrate off**, not expand.
- **Do not install the AWS CLI** on developer machines, Pi hosts, or CI agents.
- **Do not add the AWS SDK** to new code or scripts. Prefer existing in-repo wrappers only when touching legacy paths.
- Prefer Cloudflare APIs / Wrangler / existing `cloudflare-*` skills and repo scripts over any AWS tooling.

## Deployment Target

- **Primary:** Pi k3s cluster (omv node at 192.168.1.128)
- **Proxy:** Cloudflare Workers (`pi-origin`)
- **Build:** OpenNext.js Cloudflare (`pnpm cf:build` → `opennextjs-cloudflare build`)
- **Deploy:** `pnpm cf:deploy` or `pnpm deploy` (SST-based production)

## Key Bindings (wrangler.jsonc)

| Binding | Type | Resource |
|---------|------|----------|
| `NEXT_INC_CACHE_R2_BUCKET` | R2 | `cloudless-assets` |
| `NEXT_CACHE_D1_BINDING` | D1 | `user-auth-db` |
| `AUTH_DB` | D1 | `user-auth-db` |
| `ASSETS_BUCKET` | R2 | `cloudless-assets` |
| `ANALYTICS_BUCKET` | R2 | `cloudless-analytics` |
| `DATALAKE_BUCKET` | R2 | `datalake-bucket` |

## Secrets Management

- **Non-secret config:** D1 `app_config` table (migration 0007)
- **Secrets:** Wrangler secrets (not SSM, not .env files in prod)
- **ETL scripts:** Read from D1 via `/api/config` endpoint or use environment variables
- **SSM escape hatch:** `SSM_DISABLED=1` environment variable disables SSM fallback

## Cloudflare Tunnel

- **Tunnel ID:** e977a490-58c5-4fdb-9155-86832e3e636a
- **Status:** ACTIVE since 2026-07-20
- **11 services connected:** grafana, kuma, n8n, ntfy, espocrm, meili, postiz, appflowy, docs, and main app
- **Troubleshooting:** Check tunnel status with `cloudflared tunnel info <tunnel-id>`

## OpenNext.js Build Pipeline

```
pnpm cf:build
  └─► opennextjs-cloudflare build
       ├─► next build (via buildCommand in open-next.config.ts)
       └─► OpenNext bundling → .open-next/worker.js

pnpm cf:deploy
  └─► opennextjs-cloudflare deploy
       ├─► Uploads .open-next/worker.js to Cloudflare Worker
       └─► Uploads static assets to R2
```

## Workers AI

- **Primary:** `@cf/meta/llama-3.1-8b-instruct`
- **Fallback chain:** Workers AI → Google Gemini → Anthropic → Chat Service Binding
- **Chat endpoint:** `/api/chat` (POST)
- **Admin AI:** `/api/admin/ai/generate` (requires admin auth)