import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getClientIp as getSharedClientIp } from "@/lib/rate-limit";

// Cognito JWKS — primary for both k3s (Pi) and Lambda deployments.
const _upId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const _reg = process.env.AWS_REGION || _upId.split("_")[0] || "us-east-1";

const JWKS = _upId
  ? createRemoteJWKSet(
      new URL(`https://cognito-idp.${_reg}.amazonaws.com/${_upId}/.well-known/jwks.json`),
    )
  : null;

const JWT_ISSUER = _upId ? `https://cognito-idp.${_reg}.amazonaws.com/${_upId}` : "";

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

async function readAuthToken(
  req: NextRequest,
): Promise<{ valid: boolean; isAdmin: boolean }> {
  if (!JWKS || !JWT_ISSUER) return { valid: false, isAdmin: false };

  // next-auth stores the session as an encrypted JWT in __Secure-authjs.session-token
  // (prod) or authjs.session-token (dev/HTTP). Extract and verify the id_token
  // that next-auth embeds in the session JWT payload.
  // Note: next-auth v5 splits large session cookies into chunks (.0, .1, etc.)
  // We need to check for both chunked and unchunked cookies.
  const prodCookieName = "__Secure-authjs.session-token";
  const devCookieName = "authjs.session-token";

  // Check for chunked cookies first (next-auth splits large JWTs)
  const chunkedCookie = req.cookies.get(`${prodCookieName}.0`)?.value ??
    req.cookies.get(`${devCookieName}.0`)?.value;

  // Also check unchunked cookie
  const sessionCookie = req.cookies.get(prodCookieName)?.value ??
    req.cookies.get(devCookieName)?.value;

  if (sessionCookie || chunkedCookie) {
    try {
      // next-auth v5 session cookies are encrypted — decode with next-auth secret
      // via the getToken helper (edge-compatible).
      const { getToken } = await import("next-auth/jwt");
      const token = await getToken({
        req: req as Parameters<typeof getToken>[0]["req"],
        secret: process.env.AUTH_SECRET ?? "",
        secureCookie: process.env.NODE_ENV === "production",
        // When there's a chunked cookie present, we need to use the base name
        // so getToken can find and reassemble the chunks
        cookieName:
          process.env.NODE_ENV === "production"
            ? prodCookieName
            : devCookieName,
      });
      if (token) {
        const groups = (token.groups as string[]) ?? [];
        return { valid: true, isAdmin: groups.includes("admin") };
      }
    } catch {
      // fall through to legacy Cognito check
    }
  }

// Direct Cognito token cookie fallback (Amplify-style sessions)
    // Amplify stores idToken in accessToken cookie under the key pattern:
    // CognitoIdentityServiceProvider.{client}.{user}.accessToken
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    if (clientId) {
      const lastAuthKey = `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`;
      const username = req.cookies.get(lastAuthKey)?.value;
      if (username) {
        // Amplify stores tokens with 'accessToken' key name (contains id_token payload)
        const tokenKey = `CognitoIdentityServiceProvider.${clientId}.${username}.accessToken`;
       const token = req.cookies.get(tokenKey)?.value;
       if (token) {
         try {
           const { payload } = await jwtVerify(token, JWKS, {
             issuer: JWT_ISSUER,
             audience: clientId,
           });
           return {
             valid: true,
             isAdmin:
               (payload["cognito:groups"] as string[] | undefined)?.includes("admin") ?? false,
           };
         } catch {
           // invalid token
         }
       }
     }
   }

  return { valid: false, isAdmin: false };
}

// --- next-intl locale middleware ---
const intlMiddleware = createIntlMiddleware(routing);

// --- In-memory rate limiter (per-process; resets on restart) ---
//
// Caveat (worth understanding before changing the numbers below):
// In Lambda each warm container has its own copy of `rateLimitMap`. With N
// concurrent containers warm, the effective per-IP ceiling is roughly N ×
// `max`. For burst protection at scale, the right answer is AWS WAF's
// rate-based rule (or APIGW usage plans) — this in-process limiter is a
// best-effort first line that catches accidental loops and small-scale
// spam, not a real shield against a coordinated attacker. The numbers
// below are conservative on purpose.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
  "/api/contact": { windowMs: 60_000, max: 3 },
  "/api/subscribe": { windowMs: 60_000, max: 2 },
  "/api/unsubscribe": { windowMs: 60_000, max: 3 },
  "/api/checkout": { windowMs: 60_000, max: 6 },
  "/api/calendar/book": { windowMs: 60_000, max: 3 },
  "/api/hubspot/ticket": { windowMs: 60_000, max: 3 },
  "/api/crm/contact": { windowMs: 60_000, max: 3 },
  // LLM proxy — each call hits the Anthropic API and costs money. Tighter cap.
  "/api/chat": { windowMs: 60_000, max: 12 },
};

// Admin endpoints are JWT-auth-gated, but we still rate-limit them to cap
// abuse from stolen tokens and prevent expensive AI/report operations from
// being hammered. windowMs: 60s, per-IP across all /api/admin/*.
const ADMIN_RATE_LIMIT = { windowMs: 60_000, max: 90 };

function isRateLimited(
  key: string,
  windowMs: number,
  max: number,
): { limited: boolean; remaining: number } {
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
 * Uses Web Crypto (available in both Edge Runtime and Node.js ≥ 19).
 */
function generateNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  // btoa over a latin-1 string — safe because all values are 0–255.
  return btoa(String.fromCharCode(...buf));
}

/**
 * Build a per-request Content-Security-Policy string.
 *
 * script-src uses a per-request nonce + 'strict-dynamic' instead of the
 * blanket 'unsafe-inline'. This means:
 *   - Inline scripts without the matching nonce attribute are blocked.
 *   - Scripts loaded by a trusted (nonced) script are implicitly trusted,
 *     so GTM / Stripe / HubSpot child scripts continue to work.
 *   - 'unsafe-eval' is retained for Three.js WebGL shader compilation on
 *     the home page — removing it would require pre-compiling all GLSL.
 *
 * The nonce is also forwarded to layout.tsx via the `x-nonce` response
 * header, where it is applied to every Next.js <Script> component so that
 * inline runtime scripts get the matching attribute.
 *
 * Allowlists every third-party host the site currently loads:
 *   - Stripe (checkout + redirect)
 *   - Sentry (browser SDK + ingest)
 *   - Meta Pixel (connect.facebook.net)
 *   - Cognito (Amplify auth flows)
 *   - HubSpot (forms + tracking)
 *   - Google Analytics / GTM
 */
function buildCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  // In dev mode, Turbopack/HMR injects inline scripts without nonces and
  // opens WebSockets on the dev origin — we need 'unsafe-inline' + ws:// to
  // make the dev server work. Production uses the strict nonced policy.
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.com https://connect.facebook.net https://browser.sentry-cdn.com https://js.hsforms.net https://js.hs-scripts.com https://js-eu1.hs-scripts.com https://www.googletagmanager.com`
    : `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://js.stripe.com https://m.stripe.com https://connect.facebook.net https://browser.sentry-cdn.com https://js.hsforms.net https://js.hs-scripts.com https://js-eu1.hs-scripts.com https://www.googletagmanager.com`;
  const connectSrc = isDev
    ? "connect-src 'self' ws: wss: http://localhost:* http://172.* https://api.stripe.com https://m.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://www.facebook.com https://auth.cloudless.gr https://api.hubapi.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com"
    : "connect-src 'self' ws://192.168.1.128:30800 wss://192.168.1.128:30800 https://api.stripe.com https://m.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://www.facebook.com https://auth.cloudless.gr https://api.hubapi.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com";

  return [
    "default-src 'self'",
    scriptSrc,
    // fonts.googleapis.com is allowlisted because next/font/google emits a
    // @font-face stylesheet whose src URLs hit Google's CDN even though the
    // font binaries themselves are self-hosted under /_next/static/media.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://p.typekit.net",
    "img-src 'self' data: blob: https:",
    // fonts.gstatic.com — Google Fonts binary CDN. next/font/google falls back
    // to it for the woff2 files when the build cannot inline them.
    "font-src 'self' data: https://fonts.gstatic.com https://use.typekit.net",
    connectSrc,
    "frame-src https://js.stripe.com https://hooks.stripe.com https://www.facebook.com",
    "worker-src 'self' blob:",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Reporting-API endpoint group. Modern browsers prefer this over the
 * legacy report-uri directive, but they fall back to report-uri when
 * the report-to group is unknown — so we ship both in the CSP above.
 */
const REPORT_TO = JSON.stringify({
  group: "csp-endpoint",
  max_age: 86400,
  endpoints: [{ url: "/api/csp-report" }],
  include_subdomains: true,
});

/** Security headers applied to all responses */
function addSecurityHeaders(response: NextResponse, nonce: string): void {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Defense-in-depth: deny every powerful feature this marketing/storefront
  // app does not need. payment=(self) keeps Stripe Payment Request API
  // working; everything else is hard-blocked. Browsers that don't recognize
  // a directive ignore it.
  response.headers.set(
    "Permissions-Policy",
    [
      "accelerometer=()",
      "autoplay=(self)",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "hid=()",
      "idle-detection=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=(self)",
      "picture-in-picture=()",
      "publickey-credentials-get=(self)",
      "screen-wake-lock=()",
      "serial=()",
      "usb=()",
      "web-share=(self)",
      "xr-spatial-tracking=()",
    ].join(", "),
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("Report-To", REPORT_TO);
  response.headers.set("Content-Security-Policy", buildCSP(nonce));
  // Forward nonce to server components (layout.tsx reads x-nonce via headers()).
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

// POST-LOGIN ROUTE: /auth/post-login
//
// After a successful sign-in, next-auth redirects to /auth/post-login for client-side
// routing. This endpoint reads the session token, determines if the user has admin
// privileges, and redirects to /admin or /dashboard accordingly.
// This enables role-based first navigation without flashing the login page.
async function handlePostLoginRoute(
  request: NextRequest,
): Promise<NextResponse> {
  const prodCookieName = "__Secure-authjs.session-token";
  const devCookieName = "authjs.session-token";

  // Check for chunked cookies first (next-auth splits large JWTs)
  const chunkedCookie = request.cookies.get(`${prodCookieName}.0`)?.value ??
    request.cookies.get(`${devCookieName}.0`)?.value;

  // Also check unchunked cookie
  const sessionCookie = request.cookies.get(prodCookieName)?.value ??
    request.cookies.get(devCookieName)?.value;

  if (!sessionCookie && !chunkedCookie) {
    // No session cookie - redirect to login
    const locale = getLocaleFromPath(request.nextUrl.pathname);
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login`, request.nextUrl.origin)
    );
  }

  // Try to decode the session token to check groups
  try {
    const { getToken } = await import("next-auth/jwt");
    const token = await getToken({
      req: request as Parameters<typeof getToken>[0]["req"],
      secret: process.env.AUTH_SECRET ?? "",
      secureCookie: process.env.NODE_ENV === "production",
      cookieName: process.env.NODE_ENV === "production" ? prodCookieName : devCookieName,
    });
    const locale = getLocaleFromPath(request.nextUrl.pathname);
    const groups = (token?.groups as string[]) ?? [];
    if (groups.includes("admin")) {
      return NextResponse.redirect(new URL(`/${locale}/admin`, request.nextUrl.origin));
    }
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.nextUrl.origin));
  } catch {
    // If token decode fails, redirect to login
    const locale = getLocaleFromPath(request.nextUrl.pathname);
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login`, request.nextUrl.origin)
    );
  }
}

async function handlePageRoute(
  request: NextRequest,
  pathname: string,
  nonce: string,
): Promise<NextResponse> {
  // Handle post-login route BEFORE the locale stripping
  const bareForRouteCheck = stripLocale(pathname);
  if (bareForRouteCheck === "/auth/post-login") {
    return handlePostLoginRoute(request);
  }

  const bare = stripLocale(pathname);
  const locale = getLocaleFromPath(pathname);
  const prefix = `/${locale}`;
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

  // Forward the pathname as a request header so server components (root
  // layout) can call themeForRoute() and render <html data-theme=...>
  // server-side with no first-paint flash. next/headers reads request-side.
  request.headers.set("x-pathname", pathname);
  const response = intlMiddleware(request);
  // intlMiddleware can return null for redirects - handle gracefully
  if (!response) {
    return NextResponse.next();
  }
  addSecurityHeaders(response, nonce);
  return response;
}

export async function proxy(request: NextRequest) {
  // One nonce per request — used both in the CSP header and forwarded to
  // layout.tsx via x-nonce so <Script nonce={nonce}> matches the policy.
  const nonce = generateNonce();
  const { pathname } = request.nextUrl;

  // Enforce HTTPS in production so all traffic stays encrypted in transit.
  // Exclude /api/* routes: k8s health probes hit the pod directly over HTTP
  // (Next.js sets x-forwarded-proto:http on plain HTTP connections), and
  // HTTPS enforcement for browser API calls is handled by CF/Traefik at ingress.
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

export const config = {
  matcher: [
    // Match all request paths except static files, Next.js internals, and PWA assets
    "/((?!_next/static|_next/image|\\.well-known|favicon.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|sitemap\\.xml|robots\\.txt|opengraph-image|twitter-image|icon|apple-icon|portal|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|map)$).*)",
  ],
};