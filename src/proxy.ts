import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getClientIp as getSharedClientIp } from "@/lib/rate-limit";

const LOCALES = routing.locales as readonly string[];
const DEFAULT_LOCALE = routing.defaultLocale;

function getLocaleFromPath(pathname: string): string {
  const segment = pathname.split("/")[1];
  return LOCALES.includes(segment) ? segment : DEFAULT_LOCALE;
}

function stripLocale(pathname: string): string {
  const segment = pathname.split("/")[1];
  if (!LOCALES.includes(segment)) return pathname;
  return pathname.slice(segment.length + 1) || "/";
}

function isHomepagePath(pathname: string): boolean {
  return pathname === "/" || /^\/(en|el|fr|de)$/.test(pathname);
}

/**
 * Primary auth for page gates: opaque D1 `session_token` from email/password
 * login (`/api/auth/login`). Without this, post-login redirects to /admin or
 * /dashboard bounce straight back to /auth/login even though APIs accept the cookie.
 */
async function readD1SessionCookie(
  req: NextRequest,
): Promise<{ valid: boolean; isAdmin: boolean } | null> {
  const sessionId = req.cookies.get("session_token")?.value;
  if (!sessionId) return null;

  try {
    const { getAuthDbFromEnv, getUserBySession, isAdmin: d1IsAdmin } = await import(
      "@/lib/auth-d1"
    );
    const db = getAuthDbFromEnv();
    if (!db) return null;
    const user = await getUserBySession(db, sessionId);
    if (!user) return { valid: false, isAdmin: false };
    const admin = await d1IsAdmin(db, user.id);
    return { valid: true, isAdmin: admin };
  } catch {
    return null;
  }
}

/** Legacy Auth.js JWT cookie (chunked or whole) — kept for transitional sessions. */
async function readNextAuthJwt(
  req: NextRequest,
): Promise<{ valid: boolean; isAdmin: boolean }> {
  // The session JWT can exceed the 4096-byte cookie limit when next-auth
  // CHUNKS it into `<name>.0`, `<name>.1`, … — the unchunked `<name>` cookie
  // then does not exist. Detect either form (base cookie OR first chunk) before
  // paying for the getToken dynamic import; getToken's SessionStore reassembles
  // the chunks itself.
  const baseNames = ["__Secure-authjs.session-token", "authjs.session-token"];
  const hasSession = baseNames.some(
    (n) => req.cookies.get(n) ?? req.cookies.get(`${n}.0`),
  );

  if (!hasSession) return { valid: false, isAdmin: false };

  try {
    const { getToken } = await import("next-auth/jwt");
    const token = await getToken({
      req: req as Parameters<typeof getToken>[0]["req"],
      secret: process.env.AUTH_SECRET ?? "",
      secureCookie: process.env.NODE_ENV === "production",
      cookieName:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
    });
    if (!token) return { valid: false, isAdmin: false };

    const groups = (token.groups as string[]) ?? [];
    const admin = groups.includes("admin");
    return { valid: true, isAdmin: admin };
  } catch {
    return { valid: false, isAdmin: false };
  }
}

async function readAuthToken(
  req: NextRequest,
): Promise<{ valid: boolean; isAdmin: boolean }> {
  const d1 = await readD1SessionCookie(req);
  if (d1) return d1;
  return readNextAuthJwt(req);
}

// --- next-intl locale middleware ---
const intlMiddleware = createIntlMiddleware(routing);

// --- In-memory rate limiter (per-process; resets on restart) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
  "/api/contact": { windowMs: 60_000, max: 3 },
  "/api/subscribe": { windowMs: 60_000, max: 2 },
  "/api/unsubscribe": { windowMs: 60_000, max: 3 },
  "/api/auth/register": { windowMs: 60_000, max: 3 },
  "/api/checkout": { windowMs: 60_000, max: 6 },
  "/api/calendar/book": { windowMs: 60_000, max: 3 },
  "/api/crm/contact": { windowMs: 60_000, max: 3 },
  "/api/chat": { windowMs: 60_000, max: 12 },
  "/api/track": { windowMs: 60_000, max: 30 },
  "/api/newsletter/send": { windowMs: 3_600_000, max: 6 },
};

const ADMIN_RATE_LIMIT = { windowMs: 60_000, max: 90 };

function isRateLimited(
  key: string,
  windowMs: number,
  max: number,
): { limited: boolean; remaining: number } {
  // Disable rate limiting for E2E tests in non-production environments
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_E2E === "1") {
    return { limited: false, remaining: max };
  }

  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: max - 1 };
  }

  entry.count += 1;

  if (entry.count > max) {
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: max - entry.count };
}

// Clean up stale entries every 5 minutes
let lastCleanup = Date.now();
function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * Generate a cryptographically random nonce for CSP.
 */
function generateNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf));
}

function buildCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.com https://connect.facebook.net https://browser.sentry-cdn.com https://js.hsforms.net https://js.hs-scripts.com https://js-eu1.hs-scripts.com https://www.googletagmanager.com https://snap.licdn.com`
    : `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://js.stripe.com https://m.stripe.com https://connect.facebook.net https://browser.sentry-cdn.com https://js.hsforms.net https://js.hs-scripts.com https://js-eu1.hs-scripts.com https://www.googletagmanager.com https://snap.licdn.com`;
  const connectSrc = isDev
    ? "connect-src 'self' ws: wss: http://localhost:* https://api.stripe.com https://m.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://www.facebook.com https://api.hubapi.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://px.ads.linkedin.com https://snap.licdn.com"
    : "connect-src 'self' wss://192.168.1.128:30800 https://api.stripe.com https://m.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://www.facebook.com https://api.hubapi.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://px.ads.linkedin.com https://snap.licdn.com https://plausible.io https://www.clarity.ms";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://p.typekit.net",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://use.typekit.net",
    connectSrc,
    "frame-src https://js.stripe.com https://hooks.stripe.com https://www.facebook.com",
    "worker-src 'self' blob:",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://www.facebook.com https://connect.facebook.net",
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const REPORT_TO = JSON.stringify({
  group: "csp-endpoint",
  max_age: 86400,
  endpoints: [{ url: "/api/csp-report" }],
  include_subdomains: true,
});

function addSecurityHeaders(response: NextResponse, nonce: string): void {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Hardened Permissions-Policy (post-audit)
  const permissionsPolicy = [
    "accelerometer=()",
    "camera=()",
    "geolocation=()",
    "gyroscope=()",
    "hid=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "serial=()",
    "usb=()",
    "xr-spatial-tracking=()",
    "payment=(self)",
    "fullscreen=(self)",
  ].join(", ");
  response.headers.set("Permissions-Policy", permissionsPolicy);

  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  response.headers.set("Report-To", REPORT_TO);
  response.headers.set("Content-Security-Policy", buildCSP(nonce));
  response.headers.set("x-nonce", nonce);
}

function handleApiRoute(
  request: NextRequest,
  pathname: string,
  nonce: string,
): NextResponse {
  const response = NextResponse.next();
  addSecurityHeaders(response, nonce);

  const origin = request.headers.get("origin") ?? "";
  const allowedOrigins = ["https://cloudless.gr", "https://www.cloudless.gr"];
  if (
    process.env.NODE_ENV === "development" &&
    /^http:\/\/localhost:(3000|3001|4000)$/.test(origin)
  ) {
    allowedOrigins.push(origin);
  }
  if (allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, stripe-signature",
    );
  }

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  const limit =
    RATE_LIMITS[pathname] ??
    (pathname.startsWith("/api/admin/") ? ADMIN_RATE_LIMIT : null);
  const isAdminRoute = pathname.startsWith("/api/admin/");
  if (
    limit &&
    (isAdminRoute || (request.method !== "GET" && request.method !== "OPTIONS"))
  ) {
    cleanupStaleEntries();
    const ip = getSharedClientIp(request);
    const { limited, remaining } = isRateLimited(
      `${ip}:${pathname}`,
      limit.windowMs,
      limit.max,
    );
    response.headers.set("X-RateLimit-Limit", String(limit.max));
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    if (limited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(limit.windowMs / 1000)),
            "X-RateLimit-Limit": String(limit.max),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }
  }

  return response;
}

async function handlePageRoute(
  request: NextRequest,
  pathname: string,
  nonce: string,
): Promise<NextResponse> {
  const bare = stripLocale(pathname);
  const locale = getLocaleFromPath(pathname);
  const prefix = `/${locale}`;

  // Post-login resolver
  if (bare === "/auth/post-login") {
    const { valid, isAdmin: hasAdminGroup } = await readAuthToken(request);
    if (!valid) {
      return NextResponse.redirect(new URL(`${prefix}/auth/login`, request.url));
    }
    return NextResponse.redirect(
      new URL(`${prefix}${hasAdminGroup ? "/admin" : "/dashboard"}`, request.url),
    );
  }

  const isAdminPath = bare === "/admin" || bare.startsWith("/admin/");
  const isDashboardPath = bare === "/dashboard" || bare.startsWith("/dashboard/");

  if (isAdminPath || isDashboardPath) {
    const { valid, isAdmin: hasAdminGroup } = await readAuthToken(request);
    if (valid) {
      if (isAdminPath && !hasAdminGroup) {
        return NextResponse.redirect(new URL(`${prefix}/dashboard`, request.url));
      }
    } else {
      const loginUrl = new URL(`${prefix}/auth/login`, request.url);
      loginUrl.searchParams.set("redirect", bare);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (request.headers.get("accept")?.includes("text/markdown") && isHomepagePath(pathname)) {
    return NextResponse.rewrite(new URL("/api/home-markdown", request.url));
  }

  request.headers.set("x-pathname", pathname);
  const response = intlMiddleware(request);
  addSecurityHeaders(response, nonce);

  if (isHomepagePath(pathname)) {
    response.headers.set(
      "Link",
      '</.well-known/api-catalog>; rel="api-catalog", </auth.md>; rel="auth-md", </.well-known/mcp/server-card.json>; rel="mcp-server-card"'
    );
  } else if (request.headers.get("accept")?.includes("text/markdown")) {
    response.headers.set("X-Agent-Markdown-Supported", "true");
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (process.env.NODE_ENV === "production" && host.toLowerCase().startsWith("www.cloudless.gr")) {
    const apexUrl = request.nextUrl.clone();
    apexUrl.host = "cloudless.gr";
    apexUrl.protocol = "https:";
    return NextResponse.redirect(apexUrl, 308);
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (
    process.env.NODE_ENV === "production" &&
    forwardedProto === "http" &&
    !pathname.startsWith("/api/")
  ) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  if (pathname.startsWith("/api/")) {
    return handleApiRoute(request, pathname, nonce);
  }

  return handlePageRoute(request, pathname, nonce);
}

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|\\.well-known|favicon.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|sitemap\\.xml|robots\\.txt|opengraph-image|twitter-image|icon|apple-icon|portal|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|map)$).*)",
  ],
};
