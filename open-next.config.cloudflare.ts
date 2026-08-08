/**
 * OpenNext.js Cloudflare configuration for cloudless.gr
 * Manual config to satisfy the strict validator exactly.
 * Using proxy.ts (Next.js 16+) instead of deprecated middleware.ts
 */
import { MemoryQueue } from "@opennextjs/cloudflare/overrides/queue/memory-queue";

const queue = new MemoryQueue();

export default {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: () => queue,
    },
    routePreloadingBehavior: "none",
  },
  edgeExternals: ["node:crypto"],
  cloudflare: {
    useWorkerdCondition: true,
    dangerousDisableConfigValidation: true,
  },
  dangerous: {
    enableCacheInterception: false,
  },
};
