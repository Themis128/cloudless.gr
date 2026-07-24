/**
 * OpenNext.js Cloudflare configuration for cloudless.gr
 * Consolidated layout supporting Next.js 16 compilation splits.
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default defineCloudflareConfig({
  default: {
    placement: "server",
    incrementalCache: r2IncrementalCache,
    tagCache: d1TagCache,
    queue: memoryQueue,
  },

  // Direct OpenNext's build engine to map the middleware as an external 
  // compilation tier, preventing esbuild from encountering Edge exceptions.
  functions: {
    middleware: {
      placement: "edge",
      routes: ["middleware"],
    }
  }
} as any);
