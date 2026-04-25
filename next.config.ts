import type { NextConfig } from "next";
import { resolve } from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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

const configured = withNextIntl(nextConfig) as NextConfig & {
  experimental?: Record<string, unknown>;
};

if (configured.experimental && typeof configured.experimental === "object") {
  delete configured.experimental.turbo;
  if (Object.keys(configured.experimental).length === 0) delete configured.experimental;
}

export default configured;
