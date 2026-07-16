/**
 * next-auth v5 configuration wired to AWS Cognito.
 *
 * Replaces the previous Keycloak provider. Cognito is the auth backend for
 * both the k3s (Pi) cluster deployment and the AWS Lambda (serverless)
 * deployment.
 *
 * Token storage: next-auth stores the session in a signed+encrypted JWT
 * cookie (no server-side DB needed). The id/access tokens from Cognito are
 * forwarded to the browser so proxy.ts can validate them directly.
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Cognito from "next-auth/providers/cognito";
import type { NextRequest } from "next/server";

// Region derivation: prefer AWS_REGION, then pool ID prefix, then default
const _poolId = process.env.COGNITO_USER_POOL_ID ?? process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const _regionFromEnv = process.env.AWS_REGION;
const _regionPrefix = _poolId ? _poolId.split("_")[0] : "";
const COGNITO_REGION = _regionFromEnv ?? _regionPrefix ?? "us-east-1";
const COGNITO_POOL_ID = _poolId;

// Issuer derivation: prefer explicit COGNITO_ISSUER, then derive from pool ID
const _explicitIssuer = process.env.COGNITO_ISSUER?.replace(/\/$/, "") ?? "";
const COGNITO_ISSUER = _explicitIssuer || (COGNITO_POOL_ID
  ? `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_POOL_ID}`.replace(/\/$/, "")
  : "");

/**
 * Returns "cognito" if a Cognito issuer can be resolved, null otherwise.
 * Used by tests and middleware to determine which auth provider is active.
 */
export function getAuthProvider(): "cognito" | null {
  return COGNITO_ISSUER ? "cognito" : null;
}

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    idToken?: string;
    user: {
      id: string;
      groups?: string[];
      roles?: string[];
    } & DefaultSession["user"];
  }
}

// Actual NextAuth instance - returns null when AUTH_SECRET is empty (auth disabled)
function getNextAuth() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !COGNITO_ISSUER) return null;
  return NextAuth({
    secret,
    providers: [
      Cognito({
        clientId: process.env.COGNITO_CLIENT_ID ?? "",
        clientSecret: process.env.COGNITO_CLIENT_SECRET ?? "",
        issuer: COGNITO_ISSUER,
      }),
    ],
    callbacks: {
      async jwt({ token, account, profile }) {
        // Check for expired token - set error for re-authentication
        // (Refresh token logic removed as part of migration away from AWS/Cognito)
        const expiresAtNum = typeof token.expiresAt === 'number' ? token.expiresAt : undefined;
        if (expiresAtNum && Date.now() / 1000 > expiresAtNum) {
          token.error = "RefreshTokenMissing";
        }

        if (account) {
          token.accessToken = account.access_token;
          token.idToken = account.id_token;
          // Extract cognito:groups from id_token (preferred)
          const idTok = account.id_token as string | undefined;
          if (idTok) {
            try {
              const parts = idTok.split(".");
              if (parts.length === 3) {
                const payload = JSON.parse(
                  Buffer.from(parts[1], "base64").toString("utf-8")
                ) as Record<string, unknown>;
                // In Cognito mode, ignore legacy "groups" claim, only use cognito:groups
                const fromId = (payload["cognito:groups"] as string[]) ?? [];
                token.groups = fromId;
              }
            } catch {
              // Malformed token - fall through
            }
          }
          // Fall back to profile if groups still not set
          if (!token.groups && profile) {
            const p = profile as Record<string, unknown> | undefined;
            token.groups = (p?.["cognito:groups"] as string[]) ?? [];
          }
          // Ensure groups is always an array
          if (!token.groups) {
            token.groups = [];
          }
        }
        return token;
      },
      async session({ session, token }) {
        session.accessToken = token.accessToken as string | undefined;
        session.idToken = token.idToken as string | undefined;
        session.user.id = token.sub ?? "";
        session.user.groups = (token.groups as string[]) ?? [];
        (session.user as { roles?: string[] }).roles = (token.roles as string[]) ?? [];
        return session;
      },
    },
    events: {
      async signOut() {
        // Cognito Hosted UI logout on sign-out
        // {COGNITO_DOMAIN}/logout is Cognito's non-standard logout endpoint
        const domain = process.env.COGNITO_DOMAIN;
        const clientId = process.env.COGNITO_CLIENT_ID;
        const authUrl = process.env.AUTH_URL ?? "http://localhost:4000";
        if (domain && clientId) {
          const logoutUrl = `${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(`${authUrl}/`)}`;
          await fetch(logoutUrl, { method: "GET" }).catch(() => {});
        }
      },
    },
    session: { strategy: "jwt" },
    pages: {
      signIn: "/auth/login",
      error: "/auth/login",
    },
  });
}

// Lazy initialization - only create when env is properly configured
let _auth: ReturnType<typeof NextAuth> | null | undefined;

// We capture this at module load time for getAuthProvider()
const _capturedIssuer = COGNITO_ISSUER;
const _capturedPoolId = COGNITO_POOL_ID;

// Export handlers that work even when auth is disabled
export const handlers = {
  GET: async (req: Request) => {
    const auth = getNextAuth();
    if (!auth) {
      // Auth disabled - return appropriate fallback
      if (req.url?.includes("session")) {
        // Return JSON null for session endpoint when auth disabled
        return new Response(JSON.stringify(null), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }
    // Convert Workers Request to NextRequest for compatibility
    const nextReq = req as NextRequest;
    return auth.handlers.GET(nextReq);
  },
  POST: async (req: Request) => {
    const auth = getNextAuth();
    if (!auth) {
      return new Response("{}", { status: 200 });
    }
    // Convert Workers Request to NextRequest for compatibility
    const nextReq = req as NextRequest;
    return auth.handlers.POST(nextReq);
  },
};

export const signIn = async (...args: unknown[]) => {
  const auth = getNextAuth();
  if (!auth) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (auth.signIn as any)(...args);
};

export const signOut = async (...args: unknown[]) => {
  const auth = getNextAuth();
  if (!auth) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (auth.signOut as any)(...args);
};

export const auth = async (...args: unknown[]) => {
  const auth = getNextAuth();
  if (!auth) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (auth.auth as any)(...args);
};
