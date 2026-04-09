/**
 * Server-side authentication helpers for API routes
 * Uses AWS Amplify v6 and Cognito JWT tokens
 */

import { NextRequest, NextResponse } from "next/server";
import * as jwt from "jsonwebtoken";

interface DecodedToken {
  sub: string;
  email?: string;
  "cognito:username"?: string;
  "cognito:groups"?: string[];
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

/**
 * Extract JWT token from Authorization header
 * Format: "Bearer <token>"
 */
export function getTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer") return null;

  return token;
}

/**
 * Decode JWT without verification (validates expiry only)
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded.payload !== "object") return null;
    const payload = decoded.payload as DecodedToken;
    
    // Check expiry
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if user is in admin group
 */
export function isAdmin(decoded: DecodedToken | null): boolean {
  return decoded?.["cognito:groups"]?.includes("admin") ?? false;
}

/**
 * Require authentication on an API route
 * Usage: const auth = requireAuth(request);
 *        if (!auth.ok) return auth.response;
 *        // access auth.user
 */
export function requireAuth(request: NextRequest) {
  const token = getTokenFromHeader(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing authorization token" }, { status: 401 }),
    };
  }

  const decoded = decodeToken(token);
  if (!decoded) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }),
    };
  }

  return { ok: true, user: decoded };
}

/**
 * Require admin authentication on an API route
 */
export function requireAdmin(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth;

  if (!isAdmin(auth.user)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }

  return { ok: true, user: auth.user };
}
