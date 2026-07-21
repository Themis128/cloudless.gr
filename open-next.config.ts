/**
 * OpenNext.js Cloudflare configuration for cloudless.gr
 *
 * Based on official @opennextjs/cloudflare best practices:
 * - Incremental Cache → R2 (consistent, cost-effective for large objects)
 * - Tag Cache → D1 (strongly consistent, good for revalidation)
 * - Queue → MemoryQueue (dev/preview) / Durable Queue (production via SST)
 *
 * NOTE: @opennextjs/cloudflare v1.20.x exports map (./* → ./dist/api/*.js)
 * doesn't resolve the shorthand paths (e.g. "r2-incremental-cache") correctly
 * because the actual files live under ./dist/api/overrides/ subdirectories.
 * We import from the full override paths which resolve at runtime.
 *
 * R2 binding: NEXT_INC_CACHE_R2_BUCKET (must exist in wrangler.jsonc)
 * D1 binding: NEXT_CACHE_D1_BINDING  (must exist in wrangler.jsonc)
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: d1TagCache,

  // Use in-memory queue for dev/local preview; SST overrides this with its
  // own durable-queue binding in the production deploy pipeline.
  queue: memoryQueue,

  // Build command override: tell OpenNext to use the standard Next.js build
  // with Turbopack disabled (our next.config.ts uses TypeScript CLI, which
  // is incompatible with Turbopack during builds).
  buildCommand: "next build",
});