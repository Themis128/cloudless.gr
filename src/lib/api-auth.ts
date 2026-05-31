import { NextRequest, NextResponse } from "next/server";
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/**
 * Server-side authentication helpers for API routes.
 *
 * Auth provider is **Keycloak** (OIDC), realm `master`, client `cloudless-app`.
 * The browser obtains tokens via next-auth's Authorization Code + PKCE flow
 * (see src/lib/auth.ts) and calls admin APIs with
 * `Authorization: Bearer <access_token>`. This module verifies that access
 * token's RS256 signature against the Keycloak JWKS and authorizes admins by
 * Keycloak **group** membership (`groups` claim) or realm role
 * (`realm_access.roles`).
 *
 * Key resolution strategy:
 *   1. If KEYCLOAK_JWKS_JSON is set, use it as a local JWK set (no outbound
 *      HTTPS — handy for dev/offline or containers that can't reach Keycloak).
 *   2. Otherwise createRemoteJWKSet fetches + caches the realm JWKS at
 *      `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs` (prod / Pi / Lambda).
 *
 * Back-compat: the legacy Cognito `cognito:groups` claim is still honored by
 * isAdmin() so any in-flight Cognito ID tokens (and the existing test fixtures)
 * keep working during the transition. New tokens use Keycloak claims.
 */

const KC_ISSUER = (
  process.env.KEYCLOAK_ISSUER ??
  process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ??
  ""
).replace(/\/+$/, "");

function buildJwks() {
  if (!KC_ISSUER) return null;
  const raw = process.env.KEYCLOAK_JWKS_JSON;
  if (raw) {
    try {
      return createLocalJWKSet(JSON.parse(raw) as Parameters<typeof createLocalJWKSet>[0]);
    } catch {
      // fall through to remote
    }
  }
  return createRemoteJWKSet(new URL(`${KC_ISSUER}/protocol/openid-connect/certs`));
}

// JWKS is cached in-process (local set is instant; remote set caches after first fetch).
const getJWKS = buildJwks();

export interface DecodedToken extends JWTPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  /** Keycloak group-membership-mapper claim. */
  groups?: string[];
  /** Keycloak realm roles. */
  realm_access?: { roles?: string[] };
  /** Legacy Cognito group claim — honored for back-compat. */
  "cognito:groups"?: string[];
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
 * Verify a Keycloak JWT with full RS256 signature verification against the
 * realm JWKS, enforcing the issuer. Audience is intentionally NOT enforced:
 * Keycloak access tokens carry a variable `aud` (often "account"), so checking
 * it would reject otherwise-valid tokens.
 *
 * Falls back to decode + expiry only when no issuer is configured (dev/test
 * environments without Keycloak).
 */
export async function verifyToken(token: string): Promise<DecodedToken | null> {
  if (getJWKS) {
    try {
      const { payload } = await jwtVerify(token, getJWKS, {
        ...(KC_ISSUER ? { issuer: KC_ISSUER } : {}),
      });
      return payload as DecodedToken;
    } catch {
      return null;
    }
  }

  // Dev/test fallback: decode + expiry only (no signature check).
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8")) as DecodedToken;
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a decoded token grants admin. Admin is granted by Keycloak `admin`
 * group membership, or an `admin` / `realm:admin` realm role. The legacy
 * Cognito `cognito:groups` claim is honored for back-compat.
 */
export function isAdmin(decoded: DecodedToken | undefined | null): boolean {
  if (!decoded) return false;
  const groups = decoded.groups ?? decoded["cognito:groups"] ?? [];
  if (groups.includes("admin")) return true;
  const roles = decoded.realm_access?.roles ?? [];
  return roles.includes("admin") || roles.includes("realm:admin");
}

/** Require authentication — returns the user or a 401 response. */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const token = getTokenFromHeader(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing authorization token" }, { status: 401 }),
    };
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }),
    };
  }

  return { ok: true, user: decoded };
}

/** Require admin authentication — returns the user or a 401/403 response. */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth;

  if (!isAdmin(auth.user)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }

  return { ok: true, user: auth.user };
}
