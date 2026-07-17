/**
 * Authentication middleware utility for protected routes.
 *
 * Provides a simple way to protect API routes that require authentication.
 * Returns user info if authenticated, or returns a 401 response if not.
 * Includes audit logging for admin actions.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  getUserBySession,
  isAdmin,
  type AuthDatabase,
  cleanupExpiredSessions,
  validateSessionSecret,
} from "./auth-d1";
import { logAuthAction, type AuditAction } from "./auth-audit";

interface Env {
  AUTH_DB: AuthDatabase;
}

function getDb(_request: NextRequest): AuthDatabase | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

export interface AuthContext {
  userId: string;
  email: string;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  isAdmin: boolean;
}

/**
 * Get client IP from request (handles proxy headers)
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Log admin action (safe - won't throw if audit table doesn't exist)
 */
async function logAdminAction(
  db: AuthDatabase,
  adminUserId: string,
  action: AuditAction,
  request: NextRequest
): Promise<void> {
  try {
    await logAuthAction(db, {
      adminUserId,
      action,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
      requestPath: request.nextUrl.pathname,
      requestMethod: request.method,
    });
  } catch (e) {
    // Don't fail auth if audit logging fails
    console.warn("[auth-middleware] Audit log failed:", e);
  }
}

/**
 * Require authentication for a route.
 *
 * Usage in API route:
 * ```
 * const auth = await requireAuth(req);
 * if (auth instanceof NextResponse) return auth; // 401 redirect
 * // auth is AuthContext
 * console.log(auth.email);
 * ```
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthContext | NextResponse> {
  const db = getDb(request);
  if (!db) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  const secretCheck = validateSessionSecret();
  if (!secretCheck.valid) {
    console.warn("[auth-middleware] SESSION_SECRET validation:", secretCheck.error);
  }

  const sessionId = request.cookies.get("session_token")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const user = await getUserBySession(db, sessionId);
  if (!user) {
    const response = NextResponse.json({ error: "Session expired" }, { status: 401 });
    response.cookies.delete("session_token");
    return response;
  }

  const userIsAdmin = await isAdmin(db, user.id);

  // Log admin login activity
  if (userIsAdmin) {
    await logAdminAction(db, user.id, "login", request);
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    company: user.company,
    phone: user.phone,
    isAdmin: userIsAdmin,
  };
}

/**
 * Require admin role for a route.
 *
 * Usage in API route:
 * ```
 * const admin = await requireAdmin(req);
 * if (admin instanceof NextResponse) return admin; // 401/403 redirect
 * // admin is AuthContext
 * ```
 */
export async function requireAdmin(
  request: NextRequest
): Promise<AuthContext | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return auth;
}

/**
 * Optional authentication - returns user if authenticated, empty object if not.
 * Useful for routes that show different content for authenticated users.
 */
export async function optionalAuth(
  request: NextRequest
): Promise<AuthContext | null> {
  const db = getDb(request);
  if (!db) return null;

  const sessionId = request.cookies.get("session_token")?.value;
  if (!sessionId) return null;

  const user = await getUserBySession(db, sessionId);
  if (!user) return null;

  const userIsAdmin = await isAdmin(db, user.id);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    company: user.company,
    phone: user.phone,
    isAdmin: userIsAdmin,
  };
}

/**
 * Cleanup expired sessions (for cron jobs).
 */
export async function cleanupSessions(
  db: AuthDatabase
): Promise<{ cleaned: number }> {
  const count = await cleanupExpiredSessions(db);
  return { cleaned: count };
}