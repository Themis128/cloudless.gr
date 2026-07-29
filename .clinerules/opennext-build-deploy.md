# OpenNext.js Cloudflare Build & Deploy — Cloudless.gr

## Build Pipeline

```
pnpm cf:build
  └─► opennextjs-cloudflare build
       ├─► next build (via buildCommand in open-next.config.ts)
       └─► OpenNext bundling → .open-next/worker.js

pnpm cf:deploy
  └─► opennextjs-cloudflare deploy
       ├─► Uploads .open-next/worker.js to Cloudflare Worker
       └─► Uploads static assets to R2

pnpm deploy (production, SST-based)
  └─► pnpm run cf:build:opennext
  └─► find .open-next -name "*.bin" -delete
  └─► sst deploy --config sst.config.cloudflare.ts --stage production
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

## open-next.config.ts — Official defineCloudflareConfig()

Uses `@opennextjs/cloudflare` best practices:

- **`r2IncrementalCache`** — R2 bucket for page/data cache (NEXT_INC_CACHE_R2_BUCKET)
- **`d1TagCache`** — D1 for strongly consistent tag revalidation (NEXT_CACHE_D1_BINDING)
- **`MemoryQueue`** — In-memory queue for dev; SST overrides for production
- **`buildCommand: "next build"`** — Explicit build command (no Turbopack)

### Import Paths (v1.20.x)

The `@opennextjs/cloudflare` v1.20.x `exports` map (`./*` → `./dist/api/*.js`) does NOT resolve shorthand paths like `@opennextjs/cloudflare/r2-incremental-cache` because the actual files live under `./dist/api/overrides/` subdirectories. Use the full override paths:

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import { MemoryQueue } from "@opennextjs/cloudflare/overrides/queue/memory-queue";
```

## wrangler.jsonc — Required Bindings

| Binding | Type | Resource |
|---------|------|----------|
| `NEXT_INC_CACHE_R2_BUCKET` | R2 | `cloudless-assets` |
| `NEXT_CACHE_D1_BINDING` | D1 | `user-auth-db` |

## Best Practices

- **Incremental Cache → R2**: Cheaper for large objects, more consistent than KV
- **Tag Cache → D1**: Strongly consistent (vs KV eventual consistency)
- **Queue**: MemoryQueue for dev, Durable Queue for production (SST provisions it)
- **Cache Purging**: Set `CACHE_PURGE_ZONE_ID` + `CACHE_PURGE_API_TOKEN` env vars
- **Build Env Vars**: `SKIP_NEXT_APP_BUILD=true`, `OPEN_NEXT_DIR=.open-next`, `OPEN_NEXT_CONFIG_FILE=open-next.config.ts`

## Migration (2026-07-21)

- **Before**: Legacy `open-next.config.ts` with hardcoded `override` blocks using `"dummy"` cache/queue
- **After**: Official `defineCloudflareConfig()` with R2 + D1 + MemoryQueue
- **cf:build**: Changed from `next build` → `opennextjs-cloudflare build`
- **cf:deploy**: Changed from `wrangler deploy` → `opennextjs-cloudflare deploy`
- **Added**: `cf:preview`, `cf:upload`, `cf:dev:opennext` scripts
- **wrangler.jsonc**: Added `NEXT_INC_CACHE_R2_BUCKET` and `NEXT_CACHE_D1_BINDING` bindings
