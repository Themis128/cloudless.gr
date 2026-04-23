import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { type NextRequest, NextResponse } from "next/server";

const handleI18n = createMiddleware(routing);

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const intlResponse = handleI18n(request);

  // Redirects (e.g. /en → /) pass through untouched
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  // For pass-through responses, inject x-pathname into the request headers
  // so server components can read it via headers() for hreflang generation.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Carry over any cookies next-intl set (e.g. NEXT_LOCALE)
  intlResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
