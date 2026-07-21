const { defineOpenNextConfig } = require("@opennextjs/cloudflare/config");

module.exports = defineOpenNextConfig({
  // Fix for .bin font files from @vercel/og (Geist-Regular.ttf.bin) in Next.js 16.x
  // These binary font files cause "No loader is configured for .bin files" errors
  // during SST deployment. We configure the asset handler to treat .bin files
  // as binary assets rather than trying to compress/process them.
  assetHandler: {
    // Copy static assets as-is without compression for binary files
    copy: {
      patterns: ["**/*.bin"],
    },
  },
  // Also disable compression for dynamic routes that may reference these assets
  experimental: {
    disableCompression: true,
  },
});
```
