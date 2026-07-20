import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  // Use R2 for incremental cache storage
  incrementalCache: {
    type: "r2",
    binding: "CACHE_BUCKET",
  },
  // Use D1 for durable store
  durableStore: {
    type: "d1",
    binding: "AUTH_DB",
    tablePrefix: "opennext_",
  },
  // OpenNext outputs to _worker-next directory
  // SST/wrangler will use this for the Worker
  default: {
    // Use the _worker-next output directory for SST/wrangler
    outputDir: "_worker-next",
  },
};

export default config;
