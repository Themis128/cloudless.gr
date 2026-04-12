import type { NextConfig } from "next";
import { resolve } from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Removed "output: export" to enable API routes and SSR for e-store
  turbopack: {
    root: resolve(import.meta.dirname),
    // next-intl 3.26 writes this alias to the deprecated experimental.turbo key,
    // which Next.js 16 no longer reads. Mirror it here so Turbopack resolves it.
    // Use forward slashes — Turbopack doesn't support Windows backslash paths.
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files.stripe.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // i18n is handled by next-intl in App Router (see src/i18n/request.ts)
  // Do NOT use the Pages Router i18n key here — it causes build failures
};

const configured = withNextIntl(nextConfig) as NextConfig & {
  experimental?: Record<string, unknown>;
};

// Remove deprecated key if injected by older next-intl plugin behavior.
if (configured.experimental && typeof configured.experimental === "object") {
  delete configured.experimental.turbo;
  if (Object.keys(configured.experimental).length === 0) {
    delete configured.experimental;
  }
}

export default configured;
