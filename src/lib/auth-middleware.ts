/**
 * Compatibility shim — prefer `@/lib/api-auth` for new code.
 *
 * Important: tests import this module directly and only check that certain
 * exports exist. To avoid eager module evaluation issues during Playwright's
 * Node/ESM environment, these functions are implemented as lazy wrappers.
 */

import type { NextRequest } from "next/server";
import type { AuthResult, DecodedToken } from "@/lib/api-auth";

export type { AuthResult, DecodedToken };

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const { requireAuth } = await import("@/lib/api-auth");
  return requireAuth(request);
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const { requireAdmin } = await import("@/lib/api-auth");
  return requireAdmin(request);
}

/**
 * Optional auth: when unauthenticated it returns a non-ok result instead of
 * throwing. This is intentionally permissive because many routes can degrade
 * gracefully when there is no session.
 */
export async function optionalAuth(request: NextRequest): Promise<AuthResult> {
  const { requireAuth } = await import("@/lib/api-auth");
  return requireAuth(request);
}

/**
 * Session cleanup hook for maintenance jobs.
 *
 * In this codebase cleanup is handled by explicit admin/cron routes, but we
 * keep this function for API compatibility with older integrations.
 */
export async function cleanupSessions(): Promise<void> {
  return;
}

/** Portal routes that only need a boolean session check. */
export async function isAuthenticated(
  request: Parameters<typeof requireAuth>[0]
): Promise<boolean> {
  const result = await requireAuth(request);
  return result.ok;
}

export async function requireVerifiedAuth(request: NextRequest): Promise<AuthResult> {
  const { requireVerifiedAuth } = await import("@/lib/api-auth");
  return requireVerifiedAuth(request);
}

export async function getTokenFromHeader(request: NextRequest): Promise<string | null> {
  const { getTokenFromHeader } = await import("@/lib/api-auth");
  return getTokenFromHeader(request);
}

export async function isAdmin(decoded: DecodedToken | undefined | null): Promise<boolean> {
  const { isAdmin } = await import("@/lib/api-auth");
  return isAdmin(decoded);
}
