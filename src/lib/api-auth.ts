import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { auth } from "@/lib/auth";

/**
 * Server-side authentication helpers for API routes.
 *
 * Auth paths (tried in order after E2E bypass):
 *   1. Bearer — Cognito JWKS only when `NEXT_PUBLIC_AUTH_PROVIDER=cognito`;
 *      otherwise opaque D1 `session_token` (header or cookie)
 *   2. D1 `session_token` cookie — email/password login (`auth-d1`)
 *   3. next-auth session cookie — Cognito Hosted UI (cognito provider only)
 *
 * Admin: Cognito `cognito:groups` / `groups` includes `admin`, or D1 admin role.
 */

/** Cognito JWKS + Hosted UI only when explicitly selected. */
export function isCognitoAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_PROVIDER === "cognito";
}

function getIssuer(): string {
  if (!isCognitoAuthEnabled()) return "";
  return (process.env.COGNITO_ISSUER ?? "").replace(/\/+$/, "");
}

/** JWKS URL for Cognito. */
function getCertsUrl(issuer: string): string {
  return `${issuer}/.well-known/jwks.json`;
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null | undefined;

function getJWKS() {
  if (jwksCache !== undefined) return jwksCache;
  if (!isCognitoAuthEnabled()) {
    jwksCache = null;
    return null;
  }
  const issuer = getIssuer();
  if (!issuer) {
    jwksCache = null;
    return null;
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
  email_verified?: boolean;
  preferred_username?: string;
  name?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
  token_use?: "id" | "access";
  client_id?: string;
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
      groups: admin ? ["admin"] : [],
    };
  } catch {
    return null;
  }
}

/**
 * Cloudflare D1 session_token cookie (primary when AUTH_PROVIDER ≠ cognito).
 */
async function readD1SessionCookie(request: NextRequest): Promise<DecodedToken | null> {
  const sessionId = request.cookies.get("session_token")?.value;
  if (!sessionId) return null;
  return resolveD1Session(sessionId);
}

/**
 * Verify a Cognito JWT with full RS256 signature verification against the
 * user pool JWKS, enforcing the issuer.
 *
 * Falls back to decode + expiry only when no issuer is configured AND the
 * runtime is not production (dev/test environments without Cognito).
 */
export async function verifyToken(token: string): Promise<DecodedToken | null> {
  const jwks = getJWKS();
  const issuer = getIssuer();
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        ...(issuer ? { issuer } : {}),
      });
      const decoded = payload as unknown as DecodedToken;
      // Audience check (fix #4 from audit). Cognito ID tokens carry `aud`
      // (the app client_id); access tokens carry `client_id`. Either must
      // match COGNITO_CLIENT_ID when set. This stops cross-app-client tokens
      // from the same user pool from authenticating against this app.
      const expectedAud =
        process.env.COGNITO_CLIENT_ID ?? process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
      if (expectedAud) {
        const aud = Array.isArray(decoded.aud) ? decoded.aud : decoded.aud ? [decoded.aud] : [];
        const audMatch = aud.includes(expectedAud) || decoded.client_id === expectedAud;
        if (!audMatch) return null;
      }
      return decoded;
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
 * Check if a decoded token grants admin. Admin is granted by Cognito `admin`
 * group membership (cognito:groups claim).
 */
export function isAdmin(decoded: DecodedToken | undefined | null): boolean {
  if (!decoded) return false;
  // Group membership: Cognito `cognito:groups`. Legacy `groups` claim is still
  // honoured for the session-cookie path, which projects them to the same key.
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
 * fetchWithAuth, and it carries the full Cognito JWT with groups.
 * The session cookie fallback handles edge cases where the browser hits
 * an API route directly (e.g. form action, link).
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  // E2E test bypass: only active when BOTH NEXT_PUBLIC_E2E=1 AND a matching
  // E2E_ADMIN_TOKEN env var are configured AND the Bearer token matches.
  // Belt-and-braces: also require NODE_ENV !== "production" so this is
  // physically dead code in prod even if env vars are misconfigured (fix #25).
  if (
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
          "cognito:groups": ["admin"],
        } as DecodedToken,
      };
    }
  }

  // In E2E we only trust the explicit E2E_ADMIN_TOKEN Bearer above.
  // Reject all other cookies/sessions so negative tests stay honest.
  if (process.env.NEXT_PUBLIC_E2E === "1") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 },
      ),
    };
  }

  const token = getTokenFromHeader(request);
  if (token) {
    if (isCognitoAuthEnabled()) {
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

    // D1 mode: Bearer is an opaque session id (not a Cognito JWT).
    const bearerD1 = await resolveD1Session(token);
    if (bearerD1) {
      return { ok: true, user: bearerD1 };
    }
    // Stale Cognito JWT leftovers must not 401 ahead of a valid cookie.
  }

  // Cloudflare D1 session_token (email/password login)
  const d1User = await readD1SessionCookie(request);
  if (d1User) {
    return { ok: true, user: d1User };
  }

  // next-auth / Cognito Hosted UI — only when Cognito is the active provider
  if (isCognitoAuthEnabled()) {
    const sessionUser = await readSessionCookie();
    if (sessionUser) {
      return { ok: true, user: sessionUser };
    }
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
 * Like `requireAuth` but additionally requires `email_verified === true` on
 * the Cognito ID token. Use this for any flow that takes the user's email at
 * face value to send notifications (portal enroll, contact, billing), so an
 * attacker can't sign up with `victim@somewhere` and trigger emails to the
 * real victim before they've clicked the Cognito confirmation link.
 *
 * Session-cookie users are always considered verified (the cookie is only
 * set after a successful next-auth callback, which requires confirmation in
 * the Cognito Hosted UI flow).
 */
export async function requireVerifiedAuth(request: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult;
  // Bearer-token path: enforce explicit email_verified claim. The
  // session-cookie path doesn't expose this field (next-auth strips it),
  // and the cookie is only set after the user clicks through Cognito's
  // confirmation, so treat session-cookie users as verified by construction.
  const u = authResult.user;
  const cameViaBearer = u.email_verified !== undefined || u.token_use !== undefined;
  if (cameViaBearer && u.email_verified !== true) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Email not verified. Confirm via the link in your inbox first." },
        { status: 403 },
      ),
    };
  }
  return authResult;
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
