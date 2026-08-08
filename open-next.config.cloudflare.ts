/**
 * OpenNext.js Cloudflare configuration for cloudless.gr
 * Manually constructed to satisfy the validator exactly.
 */
import d1TagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import { MemoryQueue } from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: d1TagCache,
      queue: new MemoryQueue(),
      cdnInvalidation: "dummy",
    },
    routePreloadingBehavior: "none",
  },
  edgeExternals: ["node:crypto"],
  cloudflare: {
    useWorkerdCondition: true,
  },
  dangerous: {
    enableCacheInterception: false,
  },
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
    // Use a runtime dynamic import to avoid esbuild resolution issues
    assetResolver: async () => {
      const mod = await import(
        /* webpackIgnore: true */
        "@opennextjs/cloudflare/overrides/asset-resolver/index.js"
      );
      return mod.default;
    },
  },
};