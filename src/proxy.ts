// proxy.ts — standalone middleware implementation for tests and documentation
// This is a proxy middleware (not the deprecated middleware)

// Import the implementation from middleware (which we'll recreate inline)
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
  return pathname === "/" || pathname === ``;
}

function stripAllLocalePrefixes(pathname: string): string {
  // Remove all leading locale prefixes to prevent /en/en/en/... cascade
  let path = pathname;
  while (true) {
    const segment = path.split("/")[1];
    if (!LOCALES.includes(segment)) break;
    path = path.slice(segment.length + 1) || "/";
  }
  return path;
}

// Rate limiting constants (copied from middleware)
// In development, limits are relaxed so testing forms/APIs isn't frustrating.
const IS_DEV = process.env.NODE_ENV === "development";

const RATE_LIMITS = {
  // Global IP-based rate limiting
  ip: {
    limit: IS_DEV ? 1000 : 5, // max 5 requests (1000 in dev)
    window: 10, // per 10 seconds
  },
  // Authenticated user rate limiting
  auth: {
    limit: IS_DEV ? 2000 : 10, // max 10 requests (2000 in dev)
    window: 10, // per 10 seconds
  },
};

// Admin-specific rate limits (stricter)
const ADMIN_RATE_LIMIT = {
  ip: {
    limit: IS_DEV ? 1000 : 3,
    window: 10,
  },
  auth: {
    limit: IS_DEV ? 2000 : 5,
    window: 10,
  },
};

// In-memory stores for rate limiting (in production, use Redis or similar)
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
    // Reset if window has passed
    store.set(identifier, { count: 1, resetTime: now + window * 1000 });
    return false;
  }

  if (record.count >= limit) {
    return true; // Rate limited
  }

  // Increment count
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

// Simple nonce generation for CSP
function generateNonce(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
}

// Security headers functions
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
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );
  return response;
}

function buildCSP(nonce: string): string {
  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: http: 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'nonce-${nonce}' 'unsafe-inline';
    img-src 'self' data: https: blob:;
    font-src 'self';
    connect-src 'self' https: wss:;
    media-src 'self' https:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, " ").trim();
}

// Authentication helper functions
function readAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

function readD1SessionCookie(request: NextRequest): string | null {
  return request.cookies.get("__session")?.value ?? null;
}

function readNextAuthJwt(request: NextRequest): string | null {
  return request.cookies.get("next-auth.session-token")?.value ?? null;
}

// Main middleware logic
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Generate nonce for CSP
  const nonce = generateNonce();

  // Get pathname
  const pathname = request.nextUrl.pathname;

  // Check if request is from a trusted proxy (for forwarded headers)
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttps = forwardedProto === "https" || request.nextUrl.protocol === "https:";

  // Redirect HTTP to HTTPS in production
  if (!isHttps && process.env.NODE_ENV === "production") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  // Handle API routes
  if (pathname.startsWith("/api/")) {
    return handleApiRoute(request, pathname, nonce);
  }

  // Handle page routes
  return handlePageRoute(request, pathname, nonce);
}

// API route handler
async function handleApiRoute(
  request: NextRequest,
  pathname: string,
  nonce: string
): Promise<NextResponse> {
  // Apply rate limiting for API routes
  const ip = request.headers.get("x-forwarded-for") ?? 
             request.headers.get("x-real-ip") ?? 
             "";
  const authToken = readAuthToken(request);
  
  // Determine rate limit based on path and auth
  let limitConfig = RATE_LIMITS.ip;
  if (pathname.startsWith("/api/admin/")) {
    limitConfig = ADMIN_RATE_LIMIT.ip;
    if (authToken) {
      limitConfig = ADMIN_RATE_LIMIT.auth;
    }
  } else if (authToken) {
    limitConfig = RATE_LIMITS.auth;
  }

  const identifier = authToken || ip;
  if (isRateLimited(identifier, limitConfig.limit, limitConfig.window, 
                   authToken ? authRequestMap : ipRequestMap)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(limitConfig.window),
      },
    });
  }

  // Clean up stale entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    cleanupStaleEntries(authRequestMap);
    cleanupStaleEntries(ipRequestMap);
  }

  // For now, just pass through to Next.js API handler
  // In a real implementation, we might proxy to external services
  return NextResponse.next();
}

// Page route handler
async function handlePageRoute(
  request: NextRequest,
  pathname: string,
  nonce: string
): Promise<NextResponse> {
  // Apply rate limiting for page routes (more lenient)
  const ip = request.headers.get("x-forwarded-for") ?? 
             request.headers.get("x-real-ip") ?? 
             "";
  const identifier = ip;
  
  if (isRateLimited(identifier, RATE_LIMITS.ip.limit, RATE_LIMITS.ip.window, ipRequestMap)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(RATE_LIMITS.ip.window),
      },
    });
  }

  // Clean up stale entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    cleanupStaleEntries(ipRequestMap);
  }

  // Set security headers on response
  const response = await NextResponse.next();
  return addSecurityHeaders(response, nonce);
}

// Export config for Next.js (proxy-appropriate config)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|\\.well-known|favicon.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|sitemap\\.xml|robots\\.txt|opengraph-image|twitter-image|icon|apple-icon|portal|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|map)$).*)",
  ],
  // Proxy middleware always runs on Node.js runtime
};

// Re-export utilities for tests and compatibility
export {
  generateNonce,
  addSecurityHeaders,
  handleApiRoute,
  handlePageRoute,
  readAuthToken,
  isRateLimited,
  cleanupStaleEntries,
  buildCSP,
  getLocaleFromPath,
  stripLocale,
  isHomepagePath,
  readD1SessionCookie,
  readNextAuthJwt,
};

// Export constants needed by tests
export { RATE_LIMITS, ADMIN_RATE_LIMIT, LOCALES, DEFAULT_LOCALE };