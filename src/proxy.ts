import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// --- next-intl locale middleware ---
const intlMiddleware = createIntlMiddleware(routing);

// --- In-memory rate limiter (per-process; resets on restart) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
  "/api/contact": { windowMs: 60_000, max: 5 },
  "/api/subscribe": { windowMs: 60_000, max: 3 },
  "/api/checkout": { windowMs: 60_000, max: 10 },
};

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

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

/** Security headers applied to all responses */
function addSecurityHeaders(response: NextResponse): void {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- API routes: CORS + rate limiting + security headers ---
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    addSecurityHeaders(response);

    const origin = request.headers.get("origin") ?? "";
    const allowedOrigins = ["https://cloudless.gr", "https://www.cloudless.gr"];

    if (process.env.NODE_ENV === "development" && origin.startsWith("http://localhost")) {
      allowedOrigins.push(origin);
    }

    if (allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, stripe-signature");
    }

    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }

    const limit = RATE_LIMITS[pathname];
    if (limit && request.method === "POST") {
      cleanupStaleEntries();

      const ip = getClientIp(request);
      const key = `${ip}:${pathname}`;
      const { limited, remaining } = isRateLimited(key, limit.windowMs, limit.max);

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

  // --- Page routes: next-intl locale routing + security headers ---
  const response = intlMiddleware(request);
  addSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    // Match all request paths except static files, Next.js internals, and PWA assets
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html)$).*)",
  ],
};
