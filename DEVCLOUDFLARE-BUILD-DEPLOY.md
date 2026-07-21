# Cloudless.gr → Cloudflare Build & Deploy Pipeline

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Build Pipeline                            │
│                                                             │
│  pnpm cf:build                                              │
│  └─► opennextjs-cloudflare build                            │
│       ├─► next build (via buildCommand in open-next.config) │
│       └─► OpenNext bundling → .open-next/worker.js          │
│                                                             │
│  pnpm cf:deploy                                             │
│  └─► opennextjs-cloudflare deploy                           │
│       ├─► Uploads .open-next/worker.js to Cloudflare Worker │
│       └─► Uploads static assets to R2                       │
│                                                             │
│  Deploy Scripts (SST/Pipeline):                             │
│  ├─► pnpm deploy (production, SST-based)                    │
│  └─► pnpm deploy:staging (staging)                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Runtime Architecture                      │
│                                                             │
│  Cloudflare Worker                                           │
│  ├─► Incremental Cache: R2 (NEXT_INC_CACHE_R2_BUCKET)       │
│  ├─► Tag Cache: D1 (NEXT_CACHE_D1_BINDING)                  │
│  ├─► Queue: MemoryQueue (dev) / Durable Queue (production)  │
│  └─► Legacy KV: TAG_CACHE, REVALIDATION_QUEUE (back compat)│
└─────────────────────────────────────────────────────────────┘
```

## Available Scripts
 
 | Script | Command | Description |
 |--------|---------|-------------|
 | `pnpm cf:build` | `bash scripts/cf-build-wrapper.sh` | Full OpenNext build → `.open-next/` |
 | `pnpm cf:deploy` | `opennextjs-cloudflare deploy` | Deploy built worker to Cloudflare (requires `.open-next/worker.js`) |
 | `pnpm cf:preview` | `opennextjs-cloudflare preview` | Preview worker locally |
 | `pnpm cf:upload` | `opennextjs-cloudflare upload` | Upload to Cloudflare without deploying |
 | `pnpm deploy` | Build + `sst deploy` (production) | Full production deploy via SST (OpenNext) |
 | `pnpm deploy:staging` | Build + `sst deploy` (staging) | Full staging deploy via SST (OpenNext) |
 | `pnpm cf:deploy:free` | `wrangler deploy --config wrangler.cloudflare-free.json` | Free-tier deploy (custom worker) |
 | `pnpm cf:dev` | `wrangler dev` | Local Wrangler dev server |
 | `pnpm cf:types` | `wrangler types` | Generate Cloudflare env types |
 | `pnpm cloudflare-build` | `bash scripts/cf-build-wrapper.sh` | Alias for cf:build |

## Configuration Files

### `open-next.config.ts` — Primary OpenNext Configuration

Uses official `@opennextjs/cloudflare` best practices:

- **`defineCloudflareConfig()`** — Type-safe config wrapper
- **`r2IncrementalCache`** — R2 bucket for persistent page/data cache
- **`d1TagCache`** — D1 database for strongly consistent tag revalidation
- **`MemoryQueue`** — In-memory queue for dev/preview (SST overrides for production)
- **`buildCommand: "next build"`** — Explicit build command override (no Turbopack)

**Important**: `@opennextjs/cloudflare` v1.20.x `exports` map (`./*` → `./dist/api/*.js`) does NOT resolve shorthand paths like `@opennextjs/cloudflare/r2-incremental-cache`. Use the full override paths:

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import { MemoryQueue } from "@opennextjs/cloudflare/overrides/queue/memory-queue";
```

### `opennext.config.js` — Legacy Config (Deprecated)

Retained for backward compatibility. Contains the `.bin` font file asset handler fix for `@vercel/og`. New configuration should go in `open-next.config.ts`.

### `wrangler.jsonc` — Cloudflare Worker Configuration

**Required bindings (added 2026-07-21):**

| Binding | Type | Resource | Purpose |
|---------|------|----------|---------|
| `NEXT_INC_CACHE_R2_BUCKET` | R2 | `cloudless-assets` | OpenNext incremental cache |
| `NEXT_CACHE_D1_BINDING` | D1 | `user-auth-db` | OpenNext tag cache |

**Existing bindings (unchanged):**

| Binding | Type | Resource |
|---------|------|----------|
| `AUTH_DB` | D1 | `user-auth-db` |
| `TAG_CACHE` | KV | Legacy tag cache |
| `REVALIDATION_QUEUE` | KV | Legacy revalidation queue |
| `ASSETS_BUCKET` | R2 | `cloudless-assets` |
| `CACHE_BUCKET` | R2 | `cloudless-assets` |
| `MEDIA_BUCKET` | R2 | `app-media-bucket` |
| `ANALYTICS_BUCKET` | R2 | `cloudless-analytics` |
| `DATALAKE_BUCKET` | R2 | `datalake-bucket` |

## Deploy Workflows

### Standard Production Deploy (Recommended)

```bash
pnpm deploy
```

This runs:
1. `opennextjs-cloudflare build` — Builds Next.js + bundles for Cloudflare
2. `find .open-next -name "*.bin" -delete` — Removes problematic `.bin` font files
3. `sst deploy --config sst.config.cloudflare.ts --stage production` — Deploys via SST

### Quick Deploy (Wrangler-only, no SST)

```bash
pnpm cf:build && pnpm cf:deploy
```

### Preview Locally

```bash
pnpm cf:preview
```

Runs the built worker locally via `opennextjs-cloudflare preview`.

### Wrangler Dev Server

```bash
pnpm cf:dev
```

Starts Wrangler local dev server on port 8787.

## Best Practices (from @opennextjs/cloudflare docs)

### Caching Strategy

1. **Incremental Cache → R2** (`r2IncrementalCache`)
   - Cheaper for large objects than KV
   - More consistent reads than KV
   - Good for rendered pages and fetch cache

2. **Tag Cache → D1** (`d1TagCache`)
   - Strongly consistent (vs KV's eventual consistency)
   - Good for on-demand revalidation
   - Durable Object variant available for high-write workloads

3. **Queue → MemoryQueue (dev) → Durable Queue (production via SST)**
   - MemoryQueue is sufficient for local dev/preview
   - Production SST deploy provisions a durable queue automatically

### Environment Variables for Cache Purging

To enable cache purging in production, set:

```
CACHE_PURGE_ZONE_ID=your_zone_id
CACHE_PURGE_API_TOKEN=your_api_token
```

### Build Environment Variables

```bash
# Skip Next.js build (reuse existing standalone output)
SKIP_NEXT_APP_BUILD=true

# Custom output directory
OPEN_NEXT_DIR=.open-next

# Custom config file path
OPEN_NEXT_CONFIG_FILE=open-next.config.ts
```

## Migration Notes

### 2026-07-21: OpenNext.js Configuration Upgrade

- **Before**: Legacy `open-next.config.ts` with hardcoded `override` blocks using `"dummy"` cache/queue implementations.
- **After**: Official `defineCloudflareConfig()` with `r2IncrementalCache` + `d1TagCache` + `MemoryQueue`.
- **package.json changes**:
  - `cf:build`: Changed from `next build` to `opennextjs-cloudflare build` (official pattern)
  - `cf:deploy`: Changed from `wrangler deploy` to `opennextjs-cloudflare deploy` (official pattern)
  - Added `cf:preview` and `cf:upload` scripts
- **wrangler.jsonc changes**: Added `NEXT_INC_CACHE_R2_BUCKET` (R2) and `NEXT_CACHE_D1_BINDING` (D1) bindings

### Middleware Stub Workaround

The OpenNext build requires middleware stubs to be pre-created to avoid ENOENT errors:

```bash
mkdir -p .next/server
echo '{}' > .next/server/middleware.js.nft.json
touch .next/server/middleware.js .next/server/middleware.js.map
```

This is handled by `scripts/cf-build-wrapper.sh` before running `opennextjs-cloudflare build`.

### KV Legacy

The existing `TAG_CACHE` and `REVALIDATION_QUEUE` KV namespaces are preserved for backward compatibility but are no longer the primary cache path. OpenNext.js now uses R2 + D1 directly.

## Workers Architecture: Two Entry Points

### SST/OpenNext Worker (`src/index.ts` + `.open-next/worker.js`)
- **Primary deploy target** via `pnpm deploy`
- Built by OpenNext.js, handles Next.js SSR/SSG routes
- Uses `wrangler.jsonc` configuration
- Health endpoint: `/api/health` (handled by SST/OpenNext)

### Free-Tier Worker (`src/index-cloudflare-free.js`)
- **Alternative deploy** for Cloudflare Free Tier (no paid add-ons)
- Custom worker with inline auth, analytics, and chat endpoints
- Uses `wrangler.cloudflare-free.json` configuration
- Contains its own `/api/health` endpoint with D1 connectivity check

## Troubleshooting: Empty Health Response

If `/api/health` returns HTTP 200 with empty body:
1. The SST/OpenNext build may not have completed (`.open-next/worker.js` missing)
2. Check deployment logs: `npx wrangler tail --config wrangler.jsonc`
3. Verify wrangler.cloudflare-free.json main path points to `./src/index-cloudflare-free.js`
4. For SST deploy: ensure `sst.config.cloudflare.ts` references correct worker path
