/**
 * OpenNext.js Cloudflare configuration for cloudless.gr
 * Consolidated layout supporting Next.js 16 compilation splits.
 *
 * Used by `scripts/cf-build-wrapper.sh` via `--openNextConfigPath`.
 * AWS SST deploy uses `open-next.config.ts` (non-edge middleware).
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import { MemoryQueue } from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default defineCloudflareConfig({
  default: {
    placement: "server",
    incrementalCache: r2IncrementalCache,
    tagCache: d1TagCache,
    queue: MemoryQueue,
  },
} as any);
