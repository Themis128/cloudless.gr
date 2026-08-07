import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side authentication for API routes.
 *
 * Paths (after E2E bypass):
 *   1. Bearer — opaque D1 `session_token` (header)
 *   2. Cookie — D1 `session_token` (email/password login)
 *
 * Admin: D1 admin role projected into `groups: ["admin"]`.
 */

export interface DecodedToken {
  sub: string;
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
  name?: string;
  groups?: string[];
}

type AuthSuccess = { ok: true; user: DecodedToken };
type AuthError = { ok: false; response: NextResponse };
export type AuthResult = AuthSuccess | AuthError;

const ADMIN_GROUP = "admin";

/** Extract a token from the Authorization header (Bearer scheme). */
export function getTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer") return null;
  return token ?? null;
}

/** Resolve a D1 user from an opaque session id (cookie or Bearer). */
async function resolveD1Session(sessionId: string): Promise<DecodedToken | null> {
  if (!sessionId) return null;
  try {
    const { getAuthDbFromEnv, getUserBySession, isAdmin: d1IsAdmin } = await import(
      "@/lib/auth-d1"
    );
    const db = getAuthDbFromEnv();
    if (!db) return null;
    const user = await getUserBySession(db, sessionId);
    if (!user) return null;
    const admin = await d1IsAdmin(db, user.id);
    return {
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
      email_verified: true,
      groups: admin ? [ADMIN_GROUP] : [],
    };
  } catch {
    return null;
  }
}

async function readD1SessionCookie(request: NextRequest): Promise<DecodedToken | null> {
  const sessionId = request.cookies.get("session_token")?.value;
  if (!sessionId) return null;
  return resolveD1Session(sessionId);
}

/**
 * Resolve an opaque session id to a user (D1 only).
 * Kept as `verifyToken` for call sites that pass a raw session id.
 */
export async function verifyToken(token: string): Promise<DecodedToken | null> {
  return resolveD1Session(token);
}

/** True when `groups` includes `admin`. */
export function isAdmin(decoded: DecodedToken | undefined | null): boolean {
  if (!decoded) return false;
  return (decoded.groups ?? []).includes(ADMIN_GROUP);
}

/**
 * Authenticate a Bearer token as an opaque D1 session id.
 * Returns AuthResult on pass/fail, or null to fall through to cookie auth.
 */
async function authenticateBearer(
  request: NextRequest,
  token: string,
): Promise<AuthResult | null> {
  // Prefer session cookie over a leftover Bearer header.
  const d1CookieFirst = await readD1SessionCookie(request);
  if (d1CookieFirst) return { ok: true, user: d1CookieFirst };

  const bearerD1 = await resolveD1Session(token);
  if (bearerD1) return { ok: true, user: bearerD1 };

  return {
    ok: false,
    response: NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    ),
  };
}

/** Require authentication via D1 session (Bearer or cookie). */
  export async function requireAuth(request: NextRequest): Promise<AuthResult> {
    // E2E bypass: only when BOTH env vars are set AND Bearer matches.
    // Dead in production even if misconfigured (NODE_ENV check).
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_E2E === "1" &&
      process.env.E2E_ADMIN_TOKEN
    ) {
      const e2eToken = getTokenFromHeader(request);
      if (e2eToken && e2eToken === process.env.E2E_ADMIN_TOKEN) {
        return {
          ok: true,
          user: {
            sub: "e2e-admin",
            email: "e2e-admin@cloudless.test",
            email_verified: true,
            groups: [ADMIN_GROUP],
          },
        };
      }
    }

    // E2E bypass for checkout GET stub (without token)
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_E2E === "1"
    ) {
      const pathname = request.nextUrl.pathname;
      if (pathname === "/api/checkout" && request.method === "GET") {
        return {
          ok: true,
          user: {
            sub: "e2e-test",
            email: "e2e-test@cloudless.test",
            email_verified: true,
            groups: [],
          },
        };
      }
      // E2E bypass for checkout POST (without token)
      if (pathname === "/api/checkout" && request.method === "POST") {
        return {
          ok: true,
          user: {
            sub: "e2e-test",
            email: "e2e-test@cloudless.test",
            email_verified: true,
            groups: [],
          },
        };
      }
    }

    const token = getTokenFromHeader(request);
    if (token) {
      const bearerResult = await authenticateBearer(request, token);
      if (bearerResult) return bearerResult;
    }

    // Fall through to D1 session cookie auth. When NEXT_PUBLIC_E2E === "1"
    // without E2E_ADMIN_TOKEN configured, we must still honour valid session
    // cookies — otherwise admin APIs 401 even for authenticated admin users.
    const d1User = await readD1SessionCookie(request);
    if (d1User) return { ok: true, user: d1User };

    // E2E mode without a matching token and without a session cookie — 401.
    if (process.env.NEXT_PUBLIC_E2E === "1") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Missing authorization token" },
          { status: 401 },
        ),
      };
    }

    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 },
      ),
    };
  }

/**
 * Same as `requireAuth`. D1 sessions are only issued after email activation,
 * so verified-email is guaranteed by construction.
 */
export async function requireVerifiedAuth(request: NextRequest): Promise<AuthResult> {
  return requireAuth(request);
}

/** Require admin authentication — returns user or 401/403. */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult;

  if (!isAdmin(authResult.user)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user: authResult.user };
}
