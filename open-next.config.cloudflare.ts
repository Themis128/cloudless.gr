/**
 * OpenNext.js Cloudflare configuration for cloudless.gr
 * Uses defineCloudflareConfig from the package to properly configure all overrides.
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import { MemoryQueue } from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default defineCloudflareConfig({
  incrementalCache: "dummy",
  tagCache: d1TagCache,
  queue: new MemoryQueue(),
  cachePurge: "dummy",
  routePreloadingBehavior: "none",
  enableCacheInterception: false,
});