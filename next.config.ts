import type { NextConfig } from "next";
import { resolve } from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Compression of HTTP responses (gzip via the Next.js server). On Lambda
  // the compression is applied before CloudFront passes through; on the Pi
  // the in-process compression is what users actually receive (Pi nginx
  // doesn't recompress what's already compressed). Default is true; set
  // explicitly so anyone reading config sees that compression is on.
  compress: true,
  // Strip the X-Powered-By: Next.js header — small attack-surface reduction.
  poweredByHeader: false,
  // For Docker builds (Pi HA standby): emit a self-contained .next/standalone
  // bundle. SST/Vercel deploys leave this unset.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  // In WSL dev, set NEXT_DIST_DIR to a native Linux path (e.g. ~/next-cloudless)
  // to avoid the slow NTFS→WSL filesystem benchmark warning.
  // Production and CI leave this unset so the default .next dir is used.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  turbopack: {
    root: resolve(import.meta.dirname),
    resolveAlias: { "next-intl/config": "./src/i18n/request.ts" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "files.stripe.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    // AVIF first, WebP fallback. AVIF is ~20-30% smaller than WebP at the
    // same perceptual quality and ~50% smaller than JPEG. Browsers that
    // don't accept AVIF (Safari < 16.4, ancient Firefox) get WebP. The
    // few left after that get the original via Next.js' content
    // negotiation. On every <Image> request the optimizer picks the
    // smallest format the client accepts.
    formats: ["image/avif", "image/webp"],
    // Drop the 3840 ladder rung (8K). On real traffic almost nothing hits
    // it (laptops cap at 2560, phones at ~1440), so removing it just
    // saves one generation per image without anyone noticing. The default
    // is [640, 750, 828, 1080, 1200, 1920, 2048, 3840].
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Cache optimized variants for 30 days at the edge.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    // Tree-shake heavy barrel packages — reduces client bundle for Amplify, GSAP, cmdk
    optimizePackageImports: ["aws-amplify", "gsap", "cmdk", "lenis"],
  },
};

// Bypass Turbopack dev-mode bug where [locale] catches special metadata routes
// in the App Router before next/manifest.ts can handle them.
nextConfig.rewrites = async () => ({
  beforeFiles: [
    { source: "/manifest.webmanifest", destination: "/api/pwa-manifest" },
  ],
  afterFiles: [],
  fallback: [],
});

const configured = withNextIntl(nextConfig) as NextConfig & {
  experimental?: Record<string, unknown>;
};

if (configured.experimental && typeof configured.experimental === "object") {
  delete configured.experimental.turbo;
  if (Object.keys(configured.experimental).length === 0) delete configured.experimental;
}

export default configured;
