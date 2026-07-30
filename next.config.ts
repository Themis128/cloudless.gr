import type { NextConfig } from "next";
import { resolve } from "path";
import createNextIntlPlugin from "next-intl/plugin";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Coverage mode — set by the E2E coverage harness (scripts/e2e-with-env.sh
// runs `next dev --webpack` with COVERAGE=1 + NODE_V8_COVERAGE). We deliberately
// DO NOT use SWC/Istanbul pre-instrumentation: Istanbul requires Babel, and
// switching off SWC breaks Server Actions on the App Router
// (vercel/next.js#53901). The documented best practice is V8 native coverage
// (NODE_V8_COVERAGE for the server + Playwright CDP for the browser), which only
// works if full, external source maps are emitted so the V8 byte-offsets can be
// remapped back to the original TS by monocart. The default dev devtool
// (eval-source-map) is not resolvable post-hoc, so we force `source-map` here.
const COVERAGE =
  process.env.COVERAGE === "1" || process.env.NEXT_PUBLIC_COVERAGE === "1";

const nextConfig: NextConfig = {
  // Compression of HTTP responses (gzip via the Next.js server). On Lambda
  // the compression is applied before CloudFront passes through; on the Pi
  // the in-process compression is what users actually receive (Pi nginx
  // doesn't recompress what's already compressed). Default is true; set
  // explicitly so anyone reading config sees that compression is on.
  compress: true,
  // Strip the X-Powered-By: Next.js header — small attack-surface reduction.
  poweredByHeader: false,
  // Emit browser source maps so Playwright CDP coverage of /_next/static chunks
  // can be remapped to src/. Only in coverage mode — production stays map-free
  // (source maps are uploaded to Sentry separately during the SST deploy).
  ...(COVERAGE ? { productionBrowserSourceMaps: true } : {}),
  // Full external source maps for the `next dev --webpack` coverage server, so
  // both server (NODE_V8_COVERAGE) and client (CDP) V8 coverage resolve to the
  // original TS. Ignored under Turbopack (normal dev/build) — webpack() only
  // runs in webpack mode — so this is a no-op outside coverage runs.
  ...(COVERAGE
    ? {
        webpack: (config: { devtool?: string | false }) => {
          config.devtool = "source-map";
          return config;
        },
      }
    : {}),
  // For Docker builds (Pi HA standby): emit a self-contained .next/standalone
  // bundle. SST/Vercel deploys leave this unset.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  // Turbopack (Next 16) fails to resolve `@smithy/core/*` subpath exports
  // through pnpm's hoisted layout on Windows. Externalize the AWS SDK
  // clients so Next uses Node's native resolver instead of bundling them.
  // next-auth must NOT be in serverExternalPackages: it imports next/server
  // without the .js extension which fails when loaded as an external ESM
  // module. Use transpilePackages so Turbopack bundles it explicitly instead.
  transpilePackages: ["next-auth"],
  serverExternalPackages: [
    "@aws-sdk/client-athena",
    "@aws-sdk/client-bedrock-runtime",
    "@aws-sdk/client-cognito-identity-provider",
    "@aws-sdk/client-dynamodb",
    "@aws-sdk/client-ses",
    "@aws-sdk/client-sesv2",
    "@aws-sdk/client-ssm",
    // Free Workers = 3 MiB gzip. Keep OG font/WASM out of the traced server
    // package; OpenNext still pre-renders opengraph-image routes at build time.
    "@vercel/og",
  ],
  // Drop traced copies of OG binaries from the OpenNext server function package.
  // See https://opennext.js.org/cloudflare/troubleshooting (Worker size limit).
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@vercel/og/**/*",
      "node_modules/next/dist/compiled/@vercel/og/**/*",
      "node_modules/@resvg/**/*",
      "node_modules/satori/**/*",
    ],
  },
  // In WSL dev, set NEXT_DIST_DIR to a native Linux path (e.g. ~/next-cloudless)
  // to avoid the slow NTFS→WSL filesystem benchmark warning.
  // Production and CI leave this unset so the default .next dir is used.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Allow WSL2 LAN-side IP to access the dev server (cross-origin HMR).
  // Without this, accessing the dev server via http://172.x.x.x:4000 blocks
  // the webpack-hmr endpoint with "Blocked cross-origin request".
  allowedDevOrigins: ["localhost", "127.0.0.1", "172.29.17.211", "10.255.255.254", "*.local"],
  turbopack: {
    root: resolve(import.meta.dirname),
    resolveAlias: { "next-intl/config": "./src/i18n/request.ts" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "files.stripe.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // Notion cover images: Notion-uploaded files land on S3; external URLs
      // set via Notion properties can be any subdomain of these two.
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.notion.so" },
      { protocol: "https", hostname: "notion.so" },
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
    // Tree-shake heavy barrel packages — reduces client bundle for GSAP, cmdk, etc.
    optimizePackageImports: ["gsap", "cmdk", "lenis", "lucide-react", "three", "@react-three/drei"],
  },
};

// next-intl middleware (localePrefix: "always") intercepts every unprefixed
// route on its own and 307s to the appropriate locale BEFORE Next.js
// rewrites() get a chance. An earlier attempt to pre-rewrite hot landing
// paths (/services, /store, /contact, /blog, /docs, /case-studies, /work)
// here to /en/* was dead code — verified live: both with and without the
// NEXT_LOCALE cookie those URLs still produce a 307 from middleware. Per
// next-intl docs, the middleware IS the locale layer; we keep
// /manifest.webmanifest → /api/pwa-manifest as the only legitimate rewrite.
nextConfig.rewrites = async () => ({
  beforeFiles: [
    { source: "/manifest.webmanifest", destination: "/api/pwa-manifest" },
  ],
  afterFiles: [],
  fallback: [],
});

// /portal/* is a private, token-driven, authenticated surface — kept
// locale-neutral on purpose (magic-link URLs emailed to clients carry
// no locale). When a user manually types /en/portal/... (or any other
// supported locale prefix), 308 them to the canonical /portal/* so the
// URL bar settles where every other link in the app points. Query
// string is preserved automatically.
nextConfig.redirects = async () => [
  {
    source: "/:locale(en|el|fr|de)/portal/:path*",
    destination: "/portal/:path*",
    permanent: true,
  },
];

const configured = withNextIntl(nextConfig) as NextConfig & {
  experimental?: Record<string, unknown>;
};

if (configured.experimental && typeof configured.experimental === "object") {
  delete configured.experimental.turbo;
  if (Object.keys(configured.experimental).length === 0) delete configured.experimental;
}

export default withBundleAnalyzer(configured);

// Bind wrangler D1/R2/KV into `next dev` only — never during `next build` / CI
// (initOpenNextCloudflareForDev talks to wrangler and needs CLOUDFLARE_API_TOKEN
// when bindings are remote, which breaks non-interactive builds).
const isNextDevCli = !process.env.CI && process.argv.includes("dev");

if (isNextDevCli) {
  void import("@opennextjs/cloudflare").then(
    ({ initOpenNextCloudflareForDev, getCloudflareContext }) => {
      void initOpenNextCloudflareForDev().then(() => {
        try {
          const { env } = getCloudflareContext();
          const authDb = (env as { AUTH_DB?: { prepare: (q: string) => unknown } }).AUTH_DB;
          if (authDb && typeof authDb.prepare === "function") {
            (globalThis as { __AUTH_DB__?: typeof authDb }).__AUTH_DB__ = authDb;
            (process as unknown as { env: { AUTH_DB?: typeof authDb } }).env.AUTH_DB = authDb;
          }
        } catch {
          // Context not ready in this config-load process — request handlers still
          // resolve AUTH_DB via Symbol.for("__cloudflare-context__") / auth-db-local.
        }
      });
    }
  );
}
