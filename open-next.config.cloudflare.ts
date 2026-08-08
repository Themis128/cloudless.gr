/**
 * OpenNext.js Cloudflare configuration for cloudless.gr
 * Manual config to satisfy the strict validator exactly.
 * Using proxy.ts (Next.js 16+) instead of deprecated middleware.ts
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import { MemoryQueue } from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: d1TagCache,
  queue: new MemoryQueue(),
});
