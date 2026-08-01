import { NextRequest, NextResponse } from "next/server";

// Rate limiting state
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isHomepagePath(pathname: string): boolean {
  return pathname === "/" || /^\/(en|el|fr|de)$/.test(pathname);
}

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per IP

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 300_000);

export function proxy(request: NextRequest): NextResponse | undefined {
  const ip = getClientIp(request);
  const { pathname } = request.nextUrl;

  // Rate limiting
  if (isRateLimited(ip)) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  if (request.headers.get("accept")?.includes("text/markdown") && isHomepagePath(pathname)) {
    return NextResponse.rewrite(new URL("/api/home-markdown", request.url));
  }

  // Security headers
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|\\.well-known|favicon.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|sitemap\\.xml|robots\\.txt|opengraph-image|twitter-image|icon|apple-icon|portal|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|map)$).*)",
  ],
};
