/**
 * OpenNext.js Cloudflare configuration for cloudless.gr
 * Manual config to satisfy the strict validator exactly.
 * Using proxy.ts (Next.js 16+) instead of deprecated middleware.ts
 *
 * tagCache is "dummy" (not D1) so OpenNext never burns free-tier
 * rows_written on user-auth-db. Incremental cache stays on R2.
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { MemoryQueue } from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: "dummy",
  queue: new MemoryQueue(),
});
