import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Server-side authentication helpers for API routes.
 * Uses Cognito JWT tokens with full RS256 signature verification
 * via the pool's JWKS endpoint.
 */

const REGION = process.env.AWS_REGION ?? "us-east-1";
const USER_POOL_ID =
  process.env.COGNITO_USER_POOL_ID ??
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ??
  "";
const CLIENT_ID =
  process.env.COGNITO_CLIENT_ID ??
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ??
  "";

const COGNITO_ISSUER = USER_POOL_ID
  ? "https://cognito-idp." + REGION + ".amazonaws.com/" + USER_POOL_ID
  : "";

// JWKS is cached in-process by jose (fetched once per key rotation)
const getJWKS = USER_POOL_ID
  ? createRemoteJWKSet(new URL(COGNITO_ISSUER + "/.well-known/jwks.json"))
  : null;

export interface DecodedToken {
  sub: string;
  email?: string;
  "cognito:username"?: string;
  "cognito:groups"?: string[];
  token_use?: "id" | "access";
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

type AuthSuccess = { ok: true; user: DecodedToken };
type AuthError = { ok: false; response: NextResponse };
export type AuthResult = AuthSuccess | AuthError;

/** Extract JWT token from Authorization header (Bearer scheme). */
export function getTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer") return null;
  return token ?? null;
}

/**
 * Verify a Cognito JWT with full RS256 signature verification.
 * Falls back to expiry-only check when the pool is not configured
 * (dev/test environments without Cognito).
 */
export async function verifyToken(token: string): Promise<DecodedToken | null> {
  // Full verification path
  if (getJWKS) {
    try {
      const { payload } = await jwtVerify(token, getJWKS, {
        issuer: COGNITO_ISSUER,
        ...(CLIENT_ID ? { audience: CLIENT_ID } : {}),
      });
      // Only accept ID tokens — access tokens use a different audience claim
      if ((payload as Record<string, unknown>)["token_use"] !== "id")
        return null;
      return payload as unknown as DecodedToken;
    } catch {
      return null;
    }
  }

  // Dev/test fallback: decode + expiry only (no signature check)
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

/** Check if a decoded token belongs to the admin group. */
export function isAdmin(decoded: DecodedToken | undefined | null): boolean {
  return decoded?.["cognito:groups"]?.includes("admin") ?? false;
}

/** Require authentication — returns user or 401 response. */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const token = getTokenFromHeader(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 },
      ),
    };
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      ),
    };
  }

  return { ok: true, user: decoded };
}

/** Require admin authentication — returns user or 401/403 response. */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth;

  if (!isAdmin(auth.user)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user: auth.user };
}
