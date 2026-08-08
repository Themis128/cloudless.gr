// proxy.ts — Next.js 16+ proxy (replaces deprecated middleware)

export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
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
  let path = pathname;
  while (true) {
    const segment = path.split("/")[1];
    if (!LOCALES.includes(segment)) break;
    path = path.slice(segment.length + 1) || "/";
  }
  return path;
}

const IS_DEV = process.env.NODE_ENV === "development";

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
    style-src 'self' 'unsafe-inline' https:;
    img-src 'self' data: https: blob:;
    font-src 'self' https: data:;
    connect-src 'self' https: wss:;
    media-src 'self' https:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
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

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttps = forwardedProto === "https" || request.nextUrl.protocol === "https:";

  if (!isHttps && process.env.NODE_ENV === "production") {
    const httpsUrl = request.nextUrl.clone();
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
  const ip = getSharedClientIp(request) || "unknown";
  const authToken = readAuthToken(request);
  
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

  if (Math.random() < 0.01) {
    cleanupStaleEntries(authRequestMap);
    cleanupStaleEntries(ipRequestMap);
  }

  return NextResponse.next();
}

async function handlePageRoute(
  request: NextRequest,
  pathname: string,
  nonce: string
): Promise<NextResponse> {
  const isRscPrefetch = request.nextUrl.searchParams.has("_rsc");
  if (!isRscPrefetch) {
    const ip = getSharedClientIp(request);
    const identifier = ip || "unknown";
    
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

  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/en/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/en/dashboard");
  const isPostLoginRoute = pathname.startsWith("/auth/post-login") || pathname === "/auth/post-login" ||
                            pathname.startsWith("/en/auth/post-login");
  
  if (isAdminRoute || isDashboardRoute || isPostLoginRoute) {
    const sessionToken = readNextAuthJwt(request);
    const sessionCookie = request.cookies.get("authjs.session-token")?.value;
    const chunkedCookie = request.cookies.get("authjs.session-cookie.0")?.value;
    const d1SessionToken = request.cookies.get("session_token")?.value;
    
    const hasSessionToken = sessionToken || sessionCookie || chunkedCookie || d1SessionToken;
    
    if (hasSessionToken) {
      if (d1SessionToken && !sessionToken && !sessionCookie && !chunkedCookie) {
        try {
          const { getUserBySession, isAdmin, getAuthDbFromEnv } = await import("@/lib/auth-d1");
          const db = getAuthDbFromEnv();
          
          if (db) {
            const user = await getUserBySession(db, d1SessionToken);
            
            if (!user) {
              const basePath = pathname.split("/")[1] || "";
              const isLocalized = LOCALES.includes(basePath);
              const redirectPath = isLocalized
                ? `/${basePath}/auth/login?redirect=${encodeURIComponent(pathname === `/${basePath}` ? "/" : pathname.slice(`${basePath}/`.length) || "/")}`
                : `/auth/login?redirect=${encodeURIComponent(pathname === "/" ? "/" : pathname)}`;
              return NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin), 307);
            }
            
            const isAdminUser = await isAdmin(db, user.id);
            
            if (isPostLoginRoute) {
              if (isAdminUser) {
                const adminUrl = pathname.startsWith("/en") ? "/en/admin" : "/admin";
                return NextResponse.redirect(new URL(adminUrl, request.nextUrl.origin), 307);
              } else {
                const dashboardUrl = pathname.startsWith("/en") ? "/en/dashboard" : "/dashboard";
                return NextResponse.redirect(new URL(dashboardUrl, request.nextUrl.origin), 307);
              }
            }
            
            if (isAdminRoute && !isAdminUser) {
              const dashboardUrl = pathname.startsWith("/en") ? "/en/dashboard" : "/dashboard";
              return NextResponse.redirect(new URL(dashboardUrl, request.nextUrl.origin), 307);
            }
            
            return NextResponse.next();
          }
        } catch {
        }
      }
      
      try {
        const { getToken } = await import("next-auth/jwt");
        const session = await getToken({ req: request as unknown as Request });
        
        if (!session) {
          const basePath = pathname.split("/")[1] || "";
          const isLocalized = LOCALES.includes(basePath);
          const redirectPath = isLocalized
            ? `/${basePath}/auth/login?redirect=${encodeURIComponent(pathname === `/${basePath}` ? "/" : pathname.slice(`${basePath}/`.length) || "/")}`
            : `/auth/login?redirect=${encodeURIComponent(pathname === "/" ? "/" : pathname)}`;
          return NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin), 307);
        }
        
        if (isPostLoginRoute) {
          if (isAdminFromSession(session)) {
            const adminUrl = pathname.startsWith("/en") ? "/en/admin" : "/admin";
            return NextResponse.redirect(new URL(adminUrl, request.nextUrl.origin), 307);
          } else {
            const dashboardUrl = pathname.startsWith("/en") ? "/en/dashboard" : "/dashboard";
            return NextResponse.redirect(new URL(dashboardUrl, request.nextUrl.origin), 307);
          }
        }
        
        if (isAdminRoute && !isAdminFromSession(session)) {
          const dashboardUrl = pathname.startsWith("/en") ? "/en/dashboard" : "/dashboard";
          return NextResponse.redirect(new URL(dashboardUrl, request.nextUrl.origin), 307);
        }
      } catch {
        const basePath = pathname.split("/")[1] || "";
        const isLocalized = LOCALES.includes(basePath);
        const redirectPath = isLocalized
          ? `/${basePath}/auth/login?redirect=${encodeURIComponent(pathname === `/${basePath}` ? "/" : pathname.slice(`${basePath}/`.length) || "/")}`
          : `/auth/login?redirect=${encodeURIComponent(pathname === "/" ? "/" : pathname)}`;
        return NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin), 307);
      }
    } else {
      if (isPostLoginRoute) {
        const basePath = pathname.split("/")[1] || "";
        const isLocalized = LOCALES.includes(basePath);
        const loginPath = isLocalized ? `/${basePath}/auth/login` : "/auth/login";
        return NextResponse.redirect(new URL(loginPath, request.nextUrl.origin), 307);
      }
      
      const basePath = pathname.split("/")[1] || "";
      const isLocalized = LOCALES.includes(basePath);
      const redirectPath = isLocalized
        ? `/${basePath}/auth/login?redirect=${encodeURIComponent(pathname === `/${basePath}` ? "/" : pathname.slice(`${basePath}/`.length) || "/")}`
        : `/auth/login?redirect=${encodeURIComponent(pathname === "/" ? "/" : pathname)}`;
      
      return NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin), 307);
    }
  }

  const response = await NextResponse.next();
  return addSecurityHeaders(response, nonce);
}

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

export { RATE_LIMITS, ADMIN_RATE_LIMIT, LOCALES, DEFAULT_LOCALE };