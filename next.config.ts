import type { NextConfig } from "next";
import { resolve } from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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
