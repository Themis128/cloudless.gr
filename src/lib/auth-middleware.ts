/**
 * Compatibility shim — prefer `@/lib/api-auth` for new code.
 * Re-exports the real session/Bearer auth helpers used by API routes.
 */
export {
  requireAuth,
  requireAdmin,
  requireVerifiedAuth,
  isAdmin,
  getTokenFromHeader,
  type AuthResult,
  type DecodedToken,
} from "@/lib/api-auth";

/** Portal routes that only need a boolean session check. */
export async function isAuthenticated(
  request: Parameters<typeof import("@/lib/api-auth").requireAuth>[0]
): Promise<boolean> {
  const { requireAuth } = await import("@/lib/api-auth");
  const result = await requireAuth(request);
  return result.ok;
}
