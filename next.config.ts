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
  // Hosted arm64 `next build` (deploy-pi) traces a lean standalone that can
  // omit @swc/helpers; the Pi node:22 runtime then crashes on boot with
  // MODULE_NOT_FOUND for @swc/helpers/_/_interop_require_default.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@swc/helpers/**/*",
      "./node_modules/@next/env/**/*",
      "./node_modules/styled-jsx/**/*",
      "./node_modules/client-only/**/*",
      "./node_modules/server-only/**/*",
    ],
  },
  // Keep Node sqlite/fs out of the proxy/edge webpack graph.
  // AWS SDK clients removed — app uses D1 / R2 (aws4fetch) / Resend (Cloudflare Free).
  serverExternalPackages: [
    "node:sqlite",
    "node:fs",
    "node:path",
  ],
  // In WSL dev, set NEXT_DIST_DIR to a native Linux path (e.g. ~/next-cloudless)
  // to avoid the slow NTFS→WSL filesystem benchmark warning.
  // Production and CI leave this unset so the default .next dir is used.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Dev-only: allow cross-origin HMR from WSL2 / LAN hosts.
  // Override with comma-separated NEXT_ALLOWED_DEV_ORIGINS (e.g. 172.29.17.211,*.local).
  // Defaults cover localhost + common WSL/private LAN patterns — not used in production.
  allowedDevOrigins: (
    process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [
      "localhost",
      "127.0.0.1",
      "10.255.255.254",
      "*.local",
      // Private LAN ranges commonly used by WSL2 / home routers (dev HMR only).
      "172.*.*.*",
      "192.168.*.*",
    ]
  ),
  // Turbopack resolve alias for next-intl config
  turbopack: {
    root: resolve(import.meta.dirname),
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "files.stripe.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // Appflowy cover images: Appflowy assets land on R2; external URLs
      // set via Appflowy properties can be any subdomain of these two.
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.appflowy.com" },
      { protocol: "https", hostname: "appflowy.com" },
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
    // is [640, 750, 828, 1080, 1200, 1920, 2048],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Cache optimized variants for 30 days at the edge.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    // Tree-shake heavy barrel packages — reduces client bundle for GSAP, cmdk, etc.
    // NOTE: aws-amplify is intentionally NOT in this list. Turbopack's
    // optimizePackageImports rewrites `import { Amplify } from "aws-amplify"`
    // and `import { signIn } from "aws-amplify/auth"` to different submodule
    // paths whose Amplify singletons can end up *separate*, so the
    // configure() that ran via the first path is invisible to the auth
    // helpers loaded via the second — surfacing "Auth UserPool not configured"
    // at signIn time even when configure provably ran.
    optimizePackageImports: ["gsap", "cmdk", "lenis", "lucide-react", "three", "@react-three/drei"]
  }
};

// Bypass Turbopack / App Router matching where `[locale]` can steal paths
// that are not locale pages:
// - `/manifest.webmanifest` (metadata route) → PWA API handler
// - `/api/:path*` identity rewrite claims API routes before `[locale]=api`
//   can 404 `/api/auth/session` (and sibling auth handlers) as HTML
nextConfig.rewrites = async () => ({
  beforeFiles: [
    { source: "/manifest.webmanifest", destination: "/api/pwa-manifest" },
    { source: "/api/:path*", destination: "/api/:path*" },
    // Canonical RFC 8615 well-known URIs. The handlers live under
    // /api/.well-known/*; these rewrites expose the spec paths so agents
    // resolving /.well-known/api-catalog (RFC 9727) et al. reach them.
    // security.txt is intentionally NOT mapped — the static file in
    // public/.well-known already serves it.
    {
      source: "/.well-known/api-catalog",
      destination: "/api/.well-known/api-catalog",
    },
    {
      // Catch-all: RFC 9728 §3.1 inserts the well-known path before the
      // resource path — /.well-known/oauth-protected-resource/en must serve
      // the same metadata document (resource id stays the origin).
      source: "/.well-known/oauth-protected-resource/:path*",
      destination: "/api/.well-known/oauth-protected-resource",
    },
    {
      source: "/.well-known/oauth-authorization-server",
      destination: "/api/.well-known/oauth-authorization-server",
    },
    {
      source: "/.well-known/openid-configuration",
      destination: "/api/.well-known/openid-configuration",
    },
    {
      source: "/.well-known/ai-catalog.json",
      destination: "/api/.well-known/ai-catalog.json",
    },
  ],
  afterFiles: [],
  fallback: [],
});

// Pricing lives on the services page — bare /pricing (and locale variants)
// were dead ends (307 → /en/pricing → 404).
nextConfig.redirects = async () => [
  { source: "/pricing", destination: "/services", permanent: true },
  {
    source: "/:locale(en|el|fr|de)/pricing",
    destination: "/:locale/services",
    permanent: true,
  },
];

// RFC 8288 Link headers for agent discovery (isitagentready).
// Advertises only surfaces that exist today: the RFC 9727 api-catalog at
// its canonical well-known URI (rewritten above), human docs, the
// machine-readable docs index, OAuth protected-resource metadata
// (RFC 9728), and contact/legal pages — all IANA-registered relation
// types. Applied site-wide so agents entering on any page get the
// pointers.
const agentLinkHeader = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/json"',
  '</.well-known/oauth-protected-resource>; rel="oauth-protected-resource"; type="application/json"',
  '</.well-known/openid-configuration>; rel="openid-configuration"; type="application/json"',
  '</docs>; rel="service-doc"',
  '</api/docs>; rel="service-desc"; type="application/json"',
  '</api/health>; rel="status"; type="application/json"',
  '</contact>; rel="contact"',
  '</privacy>; rel="privacy-policy"',
  '</terms>; rel="terms-of-service"',
].join(", ");

nextConfig.headers = async () => [
  {
    source: "/:path*",
    headers: [{ key: "Link", value: agentLinkHeader }],
  },
];

const configured = withNextIntl(nextConfig) as NextConfig & {
  experimental?: Record<string, unknown>;
};

if (configured.experimental && typeof configured.experimental === "object") {
  delete configured.experimental.turbo;
  if (Object.keys(configured.experimental).length === 0) delete configured.experimental;
}

export default configured;
