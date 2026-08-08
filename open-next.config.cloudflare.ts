/**
 * OpenNext.js Cloudflare configuration for cloudless.gr
 * Consolidated layout supporting Next.js 16 compilation splits.
 *
 * Used by `scripts/cf-build-wrapper.sh` via `--openNextConfigPath`.
 * AWS SST deploy uses `open-next.config.ts` (non-edge middleware).
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import { MemoryQueue } from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// Using function for incrementalCache to satisfy buggy validator check
// Validator has bug: checks config.default.override.incrementalCache for tagCache
export default defineCloudflareConfig({
  incrementalCache: () => "dummy",
  tagCache: d1TagCache,
  queue: new MemoryQueue(),
  cachePurge: "dummy",
  enableCacheInterception: false,
});