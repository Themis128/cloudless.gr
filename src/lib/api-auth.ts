import { NextRequest, NextResponse } from "next/server";
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from "jose";
import { auth } from "@/lib/auth";

/**
 * Server-side authentication helpers for API routes.
 *
 * Two auth paths (tried in order):
 *   1. next-auth session cookie (primary) -- browser same-origin requests
 *      carry the `authjs.session-token` cookie automatically. We read it
 *      via `auth()` from src/lib/auth.ts. No Bearer header needed.
 *   2. Bearer token (fallback) -- external callers (cron, Slack, scripts)
 *      send `Authorization: Bearer <token>`. Verified against the Keycloak
 *      JWKS at `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`.
 *
 * Admin check: Keycloak `admin` group (groups claim) OR `admin` / `realm:admin`
 * realm role (realm_access.roles).
 */

// Provider-agnostic: Cognito when configured, else Keycloak. Both are OIDC.
const IS_COGNITO = !!process.env.COGNITO_ISSUER;

function getIssuer(): string {
  return (
    process.env.COGNITO_ISSUER ??
    process.env.KEYCLOAK_ISSUER ??
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ??
    ""
  ).replace(/\/+$/, "");
}

/** JWKS URL for the active provider (Cognito vs Keycloak path differs). */
function getCertsUrl(issuer: string): string {
  return IS_COGNITO ? `${issuer}/.well-known/jwks.json` : `${issuer}/protocol/openid-connect/certs`;
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | ReturnType<typeof createLocalJWKSet> | null | undefined;

function getJWKS() {
  if (jwksCache !== undefined) return jwksCache;
  const issuer = getIssuer();
  if (!issuer) { jwksCache = null; return null; }
  const raw = process.env.KEYCLOAK_JWKS_JSON;
  if (raw) {
    try {
      jwksCache = createLocalJWKSet(
        JSON.parse(raw) as Parameters<typeof createLocalJWKSet>[0],
      );
      return jwksCache;
    } catch {
      // fall through to remote
    }
  }
  jwksCache = createRemoteJWKSet(new URL(getCertsUrl(issuer)));
  return jwksCache;
}

/** Reset the cached JWKS (for tests that change env vars). */
export function resetJwksCache(): void {
  jwksCache = undefined;
}

export interface DecodedToken {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
  groups?: string[];
  /** Cognito conveys group membership under this claim. */
  "cognito:groups"?: string[];
  realm_access?: { roles?: string[] };
}

type AuthSuccess = { ok: true; user: DecodedToken };
type AuthError = { ok: false; response: NextResponse };
export type AuthResult = AuthSuccess | AuthError;

/** Extract a JWT from the Authorization header (Bearer scheme). */
export function getTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer") return null;
  return token ?? null;
}

/**
 * Try to authenticate via the next-auth session cookie.
 * Returns DecodedToken on success, null if no session.
 */
async function readSessionCookie(): Promise<DecodedToken | null> {
  try {
    const session = await auth();
    if (!session?.user) return null;
    return {
      sub: session.user.id ?? "",
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      groups: session.user.groups ?? [],
      realm_access: { roles: session.user.roles ?? [] },
    };
  } catch {
    return null;
  }
}

/**
 * Verify a Keycloak JWT with full RS256 signature verification against the
 * realm JWKS, enforcing the issuer.
 *
 * Falls back to decode + expiry only when no issuer is configured AND the
 * runtime is not production (dev/test environments without Keycloak).
 */
export async function verifyToken(token: string): Promise<DecodedToken | null> {
  const jwks = getJWKS();
  const issuer = getIssuer();
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        ...(issuer ? { issuer } : {}),
      });
      return payload as unknown as DecodedToken;
    } catch {
      return null;
    }
  }

  if (process.env.NODE_ENV === "production") return null;

  return decodeTokenUnverified(token);
}

function decodeTokenUnverified(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8"),
    ) as DecodedToken;
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a decoded token grants admin. Admin is granted by Keycloak `admin`
 * group membership, or an `admin` / `realm:admin` realm role.
 */
export function isAdmin(decoded: DecodedToken | undefined | null): boolean {
  if (!decoded) return false;
  // Group membership: Keycloak `groups` or Cognito `cognito:groups`.
  const groups = [...(decoded.groups ?? []), ...(decoded["cognito:groups"] ?? [])];
  if (groups.includes("admin")) return true;
  const roles = decoded.realm_access?.roles ?? [];
  return roles.includes("admin") || roles.includes("realm:admin");
}

/**
 * Require authentication. Tries:
 *   1. Bearer token in Authorization header (fetchWithAuth, external callers)
 *   2. next-auth session cookie (browser same-origin without Bearer)
 * Returns user or 401.
 *
 * Bearer is checked first because all admin page JS sends it via
 * fetchWithAuth, and it carries the full Keycloak JWT with groups/roles.
 * The session cookie fallback handles edge cases where the browser hits
 * an API route directly (e.g. form action, link).
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  // E2E test bypass: only active when BOTH NEXT_PUBLIC_E2E=1 AND a matching
  // E2E_ADMIN_TOKEN env var are configured AND the Bearer token matches.
  // Production sets neither env var, so this is dead code in prod.
  if (process.env.NEXT_PUBLIC_E2E === "1" && process.env.E2E_ADMIN_TOKEN) {
    const e2eToken = getTokenFromHeader(request);
    if (e2eToken && e2eToken === process.env.E2E_ADMIN_TOKEN) {
      return {
        ok: true,
        user: {
          sub: "e2e-admin",
          email: "e2e-admin@cloudless.test",
          "cognito:groups": ["admin"],
        } as DecodedToken,
      };
    }
  }

  const token = getTokenFromHeader(request);
  if (token) {
    const decoded = await verifyToken(token);
    if (decoded) {
      return { ok: true, user: decoded };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      ),
    };
  }

  const sessionUser = await readSessionCookie();
  if (sessionUser) {
    return { ok: true, user: sessionUser };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: "Missing authorization token" },
      { status: 401 },
    ),
  };
}

/** Require admin authentication -- returns user or 401/403. */
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
