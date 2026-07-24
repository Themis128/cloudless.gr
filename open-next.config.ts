/**
 * OpenNext.js Cloudflare configuration for cloudless.gr
 * Consolidated layout supporting Next.js 16 compilation splits.
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

  // Middleware is placed on "server" (not "edge") because:
  // 1. Cloudflare Workers don't have a separate edge runtime tier — the
  //    middleware runs in the same workerd isolate as the server function.
  // 2. With placement: "edge", OpenNext calls generateEdgeBundle() which
  //    bundles the middleware as a standalone edge function. Then
  //    copyTracedFiles() in the default function's generateBundle() still
  //    tries to process middleware.js.nft.json and throws
  //    "middleware cannot use the edge runtime" because the nft.json stub
  //    was "{}" (no files array).
  // 3. With placement: "server", OpenNext calls generateBundle() for the
  //    middleware, which correctly bundles it as part of the server function.
  //    The middleware.js.nft.json now has a proper {"files":["middleware.js"]}
  //    format (see scripts/opennext-middleware-fix.mjs), so processNftFile()
  //    succeeds.
  functions: {
    middleware: {
      placement: "server",
      routes: ["middleware"],
    }
  }
} as any);
