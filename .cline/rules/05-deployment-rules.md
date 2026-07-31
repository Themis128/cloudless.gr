# Deployment Rules

## Build Pipeline

```bash
# Development
pnpm dev                    # Local dev server with Turbopack
pnpm cf:dev:opennext       # OpenNext.js local preview

# Production Build
pnpm cf:build              # OpenNext.js Cloudflare build
pnpm cf:deploy             # Deploy to Cloudflare Workers

# SST-based Production
pnpm deploy                # Build + SST deploy (production)
pnpm deploy:staging        # Build + SST deploy (staging)
```

## Key Scripts (package.json)

| Script | Command | Purpose |
|--------|---------|---------|
| `cf:build` | `opennextjs-cloudflare build` | Full OpenNext build |
| `cf:deploy` | `opennextjs-cloudflare deploy` | Deploy to Cloudflare |
| `cf:preview` | `opennextjs-cloudflare preview` | Local preview |
| `cf:upload` | `opennextjs-cloudflare upload` | Upload without deploy |
| `deploy` | Build + SST deploy (production) | Full production deploy |
| `deploy:staging` | Build + SST deploy (staging) | Full staging deploy |

## open-next.config.ts

Uses `@opennextjs/cloudflare` with `defineCloudflareConfig()`:

- **`r2IncrementalCache`** — R2 bucket for page/data cache
- **`d1TagCache`** — D1 for strongly consistent tag revalidation
- **`MemoryQueue`** — In-memory queue for dev; SST overrides for production
- **`buildCommand: "next build"`** — Explicit build command (no Turbopack)

## CI/CD Pipeline

- **GitHub Actions:** Workflows in `.github/workflows/`
- **Runner:** Self-hosted Pi runners (ARM64)
- **Failover:** `RUNNER_GENERIC` pattern for hosted-runner outages
- **ETL workflows:** Run on self-hosted Pi runners (Cloudflare blocks GitHub Actions IPs)
- **Secrets:** GitHub Secrets for deployment credentials

## Deployment Checklist

Before deploying:
1. [ ] Run `pnpm test:ci` — all tests pass
2. [ ] Run `pnpm cf:build` — build succeeds
3. [ ] Check for any TypeScript errors (`pnpm typecheck`)
4. [ ] Verify wrangler.jsonc bindings match deployed resources
5. [ ] Ensure all required Wrangler secrets are set

## Rollback

```bash
# Rollback Workers deployment
wrangler rollback --config wrangler.jsonc

# Rollback SST deployment
sst rollback --stage production
```

## Monitoring

- **Health check:** `/api/health` endpoint
- **Service status:** `/api/services` endpoint
- **Cloudflare Dashboard:** Monitor Workers invocations, R2 operations, D1 database size
- **Free tier limits:** Workers < 100K/day, R2 < 10M ops/month, D1 < 5GB