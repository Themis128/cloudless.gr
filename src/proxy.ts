// Proxy logic for Next.js 16+ (replaces deprecated middleware)
// Handles rate limiting, auth redirects, locale routing, and security headers

import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { canonicalOrigin } from "@/lib/canonical-origin";
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

/**
 * localePrefix is "always". Unprefixed public paths like /store would otherwise
 * bind `[locale]=store` and 404 (especially with dynamicParams=false).
 * Leave /api and /portal on their dedicated App Router trees.
 */
function redirectUnprefixedToDefaultLocale(
  request: NextRequest,
  pathname: string
): NextResponse | null {
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/_next")
  ) {
    return null;
  }
  const first = pathname.split("/")[1] ?? "";
  if (!first || LOCALES.includes(first)) return null;
  const last = pathname.split("/").pop() ?? "";
  if (last.includes(".")) return null;
  return NextResponse.redirect(
    appUrl(`/${DEFAULT_LOCALE}${pathname}${request.nextUrl.search}`, request),
    307
  );
}

function isHomepagePath(pathname: string): boolean {
  return pathname === "/" || pathname === ``;
}

function stripAllLocalePrefixes(pathname: string): string {
  let path = pathname;
  while (true) {
    const segment = path.split("/")[1];
    if (!LOCALES.includes(segment)) break;
    path = path.slice(segment.length + 1) || "/";
  }
  return path;
}

/** Absolute URL for redirects. Never echo the listen bind (`0.0.0.0`) or CDN origin. */
function appUrl(path: string, request: NextRequest): URL {
  return new URL(path, canonicalOrigin(request));
}

const IS_DEV = process.env.NODE_ENV === "development";

const ADMIN_PATH = "/admin";
const ADMIN_PATH_EN = "/en/admin";
const DASHBOARD_PATH = "/dashboard";
const DASHBOARD_PATH_EN = "/en/dashboard";

const ALLOWED_ORIGINS = ["https://cloudless.gr", "https://www.cloudless.gr"];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}

function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Stripe-Signature, X-Requested-With");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }
  return response;
}

function handleOptionsRequest(request: NextRequest, nonce: string): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(addSecurityHeaders(response, nonce), request);
}

const RATE_LIMITED_ROUTES = [
  "/api/contact",
  "/api/subscribe",
  "/api/unsubscribe",
  "/api/checkout",
  "/api/calendar/book",
  "/api/crm/contact",
];

const RATE_LIMITS = {
  ip: {
    limit: IS_DEV ? 1000 : 100,
    window: 10,
  },
  auth: {
    limit: IS_DEV ? 2000 : 200,
    window: 10,
  },
};

const ADMIN_RATE_LIMIT = {
  ip: {
    limit: IS_DEV ? 1000 : 50,
    window: 10,
  },
  auth: {
    limit: IS_DEV ? 2000 : 100,
    window: 10,
  },
};

const ipRequestMap = new Map<string, { count: number; resetTime: number }>();
const authRequestMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(
  identifier: string,
  limit: number,
  window: number,
  store: Map<string, { count: number; resetTime: number }>
): boolean {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record) {
    store.set(identifier, { count: 1, resetTime: now + window * 1000 });
    return false;
  }

  if (now > record.resetTime) {
    store.set(identifier, { count: 1, resetTime: now + window * 1000 });
    return false;
  }

  if (record.count >= limit) {
    return true;
  }

  store.set(identifier, { count: record.count + 1, resetTime: record.resetTime });
  return false;
}

function cleanupStaleEntries(
  store: Map<string, { count: number; resetTime: number }>
): void {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetTime) {
      store.delete(key);
    }
  }
}

function generateNonce(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
}

/** Forward CSP nonce + pathname into the App Router request headers (for layout Scripts). */
function continueToApp(
  request: NextRequest,
  pathname: string,
  nonce: string
): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", pathname);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  return addSecurityHeaders(response, nonce);
}

function addSecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set(
    "Content-Security-Policy",
    buildCSP(nonce)
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );
  response.headers.set(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(self), usb=(), hid=(), midi=(), serial=(), xr-spatial-tracking=(), fullscreen=(self), gamepad=(), bluetooth=(), display-capture=(), clipboard-read=(), clipboard-write=(), window-management=(), local-fonts=()"
  );
  // HSTS — production only. On localhost dev, this + upgrade-insecure-requests
  // in the CSP made Chrome upgrade http://localhost:4000 to https://, which
  // then fails (no TLS) and shows an ERR_ADDRESS_INVALID page. Two-year
  // max-age also poisons the browser's HSTS cache for `localhost` long after
  // dev is over.
  if (!IS_DEV) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  // Report-To header for CSP reporting
  response.headers.set(
    "Report-To",
    '{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"/api/csp-report"}],"include_subdomains":true}'
  );
  return response;
}

function buildCSP(nonce: string): string {
  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: http: 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline' https:;
    img-src 'self' data: https: blob:;
    font-src 'self' https: data:;
    connect-src 'self' https: wss: https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://snap.licdn.com https://px.ads.linkedin.com;
    media-src 'self' https:;
    object-src 'none';
    base-uri 'self';
    form-action 'self' https://www.facebook.com https://connect.facebook.net;
    frame-src 'self' https://www.googletagmanager.com https://td.doubleclick.net;
    frame-ancestors 'none';
    ${IS_DEV ? "" : "upgrade-insecure-requests;"}
    report-uri /api/csp-report;
    report-to csp-endpoint;
  `.replace(/\s{2,}/g, " ").trim();
}

function readAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

function readD1SessionCookie(request: NextRequest): string | null {
  return request.cookies.get("session_token")?.value ?? null;
}

function readNextAuthJwt(request: NextRequest): string | null {
  const token = request.cookies.get("authjs.session-token")?.value ?? 
                request.cookies.get("next-auth.session-token")?.value;
  return token ?? null;
}

function isAdminFromSession(session: { groups?: string[] }): boolean {
  return (session.groups ?? []).includes("admin");
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = generateNonce();
  const pathname = request.nextUrl.pathname;

  // Skip HTTPS redirect for health checks (internal NodePort calls)
  if (pathname === "/api/health" || pathname.endsWith("/api/health")) {
    if (pathname.startsWith("/api/")) {
      return handleApiRoute(request, pathname, nonce);
    }
    return handlePageRoute(request, pathname, nonce);
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttps = forwardedProto === "https" || request.nextUrl.protocol === "https:";

  if (!isHttps && process.env.NODE_ENV === "production") {
    const httpsUrl = appUrl(`${request.nextUrl.pathname}${request.nextUrl.search}`, request);
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  if (pathname.startsWith("/api/")) {
    return handleApiRoute(request, pathname, nonce);
  }

  return handlePageRoute(request, pathname, nonce);
}

async function handleApiRoute(
  request: NextRequest,
  pathname: string,
  nonce: string
): Promise<NextResponse> {
  // Handle OPTIONS preflight requests
  if (request.method === "OPTIONS") {
    return handleOptionsRequest(request, nonce);
  }

  const ip = getSharedClientIp(request) || "unknown";
  const authToken = readAuthToken(request);
  const method = request.method.toUpperCase();
  
  let limitConfig = RATE_LIMITS.ip;
  if (pathname.startsWith("/api/admin/")) {
    if (!authToken) {
      // Unauthenticated probes of admin APIs stay tightly capped.
      limitConfig = ADMIN_RATE_LIMIT.ip;
    } else if (method === "GET" || method === "HEAD") {
      // Dashboard pages fan out many parallel GETs (SEO alone = 6). Each route
      // still enforces requireAdmin — use the general auth budget so reads do
      // not 429 during normal browsing.
      limitConfig = RATE_LIMITS.auth;
    } else {
      limitConfig = ADMIN_RATE_LIMIT.auth;
    }
  } else if (authToken) {
    limitConfig = RATE_LIMITS.auth;
  }

  const identifier = authToken || ip;
  if (isRateLimited(identifier, limitConfig.limit, limitConfig.window, 
                   authToken ? authRequestMap : ipRequestMap)) {
    const response = new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(limitConfig.window),
        "X-RateLimit-Limit": String(limitConfig.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil((Date.now() + limitConfig.window * 1000) / 1000)),
      },
    });
    return addCorsHeaders(addSecurityHeaders(response, nonce), request);
  }

  if (Math.random() < 0.01) {
    cleanupStaleEntries(authRequestMap);
    cleanupStaleEntries(ipRequestMap);
  }

  // Calculate remaining for rate-limit headers
  const store = authToken ? authRequestMap : ipRequestMap;
  const record = store.get(identifier);
  const remaining = record ? Math.max(0, limitConfig.limit - record.count) : limitConfig.limit - 1;

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limitConfig.limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return addCorsHeaders(addSecurityHeaders(response, nonce), request);
}

/** Builds the locale-aware `/auth/login?redirect=...` path for unauthenticated redirects. */
function buildLoginRedirectPath(pathname: string): string {
  const basePath = pathname.split("/")[1] ?? "";
  if (LOCALES.includes(basePath)) {
    const bare = pathname === `/${basePath}` ? "/" : pathname.slice(`${basePath}/`.length) || "/";
    return `/${basePath}/auth/login?redirect=${encodeURIComponent(bare)}`;
  }
  return `/auth/login?redirect=${encodeURIComponent(pathname === "/" ? "/" : pathname)}`;
}

/** Validates the D1 session token and returns the appropriate response, or null to fall through to NextAuth. */
async function handleD1SessionRoute(
  request: NextRequest,
  pathname: string,
  nonce: string,
  d1SessionToken: string,
  isAdminRoute: boolean,
  isPostLoginRoute: boolean
): Promise<NextResponse | null> {
  try {
    const { getUserBySession, isAdmin, getAuthDbFromEnv } = await import("@/lib/auth-d1");
    const db = getAuthDbFromEnv();
    if (!db) return null;

    const user = await getUserBySession(db, d1SessionToken);
    if (!user) {
      return NextResponse.redirect(appUrl(buildLoginRedirectPath(pathname), request), 307);
    }

    const isAdminUser = await isAdmin(db, user.id);

    if (isPostLoginRoute) {
      const dest = isAdminUser
        ? (pathname.startsWith("/en") ? ADMIN_PATH_EN : ADMIN_PATH)
        : (pathname.startsWith("/en") ? DASHBOARD_PATH_EN : DASHBOARD_PATH);
      return NextResponse.redirect(appUrl(dest, request), 307);
    }

    if (isAdminRoute && !isAdminUser) {
      const dest = pathname.startsWith("/en") ? DASHBOARD_PATH_EN : DASHBOARD_PATH;
      return NextResponse.redirect(appUrl(dest, request), 307);
    }

    return continueToApp(request, pathname, nonce);
  } catch {
    return null;
  }
}

/** Validates the NextAuth JWT session and returns the appropriate response. */
async function handleNextAuthRoute(
  request: NextRequest,
  pathname: string,
  nonce: string,
  isAdminRoute: boolean,
  isPostLoginRoute: boolean
): Promise<NextResponse> {
  try {
    const { getToken } = await import("next-auth/jwt");
    const session = await getToken({ req: request as unknown as Request });

    if (!session) {
      return NextResponse.redirect(appUrl(buildLoginRedirectPath(pathname), request), 307);
    }

    if (isPostLoginRoute) {
      const dest = isAdminFromSession(session)
        ? (pathname.startsWith("/en") ? ADMIN_PATH_EN : ADMIN_PATH)
        : (pathname.startsWith("/en") ? DASHBOARD_PATH_EN : DASHBOARD_PATH);
      return NextResponse.redirect(appUrl(dest, request), 307);
    }

    if (isAdminRoute && !isAdminFromSession(session)) {
      const dest = pathname.startsWith("/en") ? DASHBOARD_PATH_EN : DASHBOARD_PATH;
      return NextResponse.redirect(appUrl(dest, request), 307);
    }

    return continueToApp(request, pathname, nonce);
  } catch {
    return NextResponse.redirect(appUrl(buildLoginRedirectPath(pathname), request), 307);
  }
}

async function handlePageRoute(
  request: NextRequest,
  pathname: string,
  nonce: string
): Promise<NextResponse> {
  const isRscPrefetch = request.nextUrl.searchParams.has("_rsc");
  if (!isRscPrefetch) {
    const identifier = getSharedClientIp(request) || "unknown";
    if (isRateLimited(identifier, RATE_LIMITS.ip.limit, RATE_LIMITS.ip.window, ipRequestMap)) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": String(RATE_LIMITS.ip.window),
        },
      });
    }
  }

  if (Math.random() < 0.01) {
    cleanupStaleEntries(ipRequestMap);
  }

  const localeRedirect = redirectUnprefixedToDefaultLocale(request, pathname);
  if (localeRedirect) {
    return addSecurityHeaders(localeRedirect, nonce);
  }

  const isAdminRoute = pathname.startsWith(ADMIN_PATH) || pathname.startsWith(ADMIN_PATH_EN);
  const isDashboardRoute = pathname.startsWith(DASHBOARD_PATH) || pathname.startsWith(DASHBOARD_PATH_EN);
  const isPostLoginRoute =
    pathname.startsWith("/auth/post-login") ||
    pathname === "/auth/post-login" ||
    pathname.startsWith("/en/auth/post-login");

  if (isAdminRoute || isDashboardRoute || isPostLoginRoute) {
    // E2E bypass: if e2e_admin cookie is set, allow access to admin routes
    const e2eAdminCookie = request.cookies.get("e2e_admin")?.value === "1";
    if (e2eAdminCookie && isAdminRoute) {
      return continueToApp(request, pathname, nonce);
    }

    const sessionToken = readNextAuthJwt(request);
    const sessionCookie = request.cookies.get("authjs.session-token")?.value;
    const chunkedCookie = request.cookies.get("authjs.session-token.0")?.value;
    const d1SessionToken = request.cookies.get("session_token")?.value;
    const hasSessionToken = sessionToken || sessionCookie || chunkedCookie || d1SessionToken;

    if (!hasSessionToken) {
      if (isPostLoginRoute) {
        const basePath = pathname.split("/")[1] || "";
        const loginPath = LOCALES.includes(basePath) ? `/${basePath}/auth/login` : "/auth/login";
        return NextResponse.redirect(appUrl(loginPath, request), 307);
      }
      return NextResponse.redirect(appUrl(buildLoginRedirectPath(pathname), request), 307);
    }

    if (d1SessionToken && !sessionToken && !sessionCookie && !chunkedCookie) {
      const d1Result = await handleD1SessionRoute(
        request, pathname, nonce, d1SessionToken, isAdminRoute, isPostLoginRoute
      );
      if (d1Result) return d1Result;
    }

    return handleNextAuthRoute(request, pathname, nonce, isAdminRoute, isPostLoginRoute);
  }

  return continueToApp(request, pathname, nonce);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/health (health checks)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - manifest.webmanifest (PWA manifest)
     * - sw.js (service worker)
     * - offline.html (offline page)
     * - .well-known/ (well-known URLs)
     * - files with extensions: svg, png, jpg, jpeg, gif, webp, ico, css, js, mjs, map, woff, woff2, ttf, eot, otf, html
     */
    "/((?!api/health|_next/static|_next/image|manifest\\.webmanifest|sw\\.js|offline\\.html|\\.well-known|[^/]+\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|map|woff|woff2|ttf|eot|otf|html)).*)",
  ],
};

export default proxy;

// Re-export for tests that check source file content
export { RATE_LIMITS, ADMIN_RATE_LIMIT };