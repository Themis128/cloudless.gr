import { handlers } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// A bare GET to /api/auth/signin/<provider> is NOT a real sign-in — Auth.js v5
// sign-in is POST + CSRF (the app uses signIn("cognito"), which POSTs). next-auth
// logs an `[auth][error] Configuration` for such GETs, and crawlers / uptime
// probes hit them. Redirect those GETs to the login page instead.
// Provider callbacks (/api/auth/callback/*) are GETs and stay on the real handler.

const SIGNIN_PROVIDER = /^\/api\/auth\/signin\/[^/]+\/?$/;

export const { POST } = handlers;

export function GET(request: NextRequest): Response | Promise<Response> {
  if (SIGNIN_PROVIDER.test(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/auth/login", request.nextUrl.origin), 302);
  }
  return (handlers.GET as (req: Request) => Response | Promise<Response>)(request);
}
