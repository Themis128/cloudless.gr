/**
 * next-auth v5 configuration wired to Keycloak.
 *
 * Replaces aws-amplify / Cognito as the auth backend for both the
 * k3s (Pi) cluster deployment and the AWS Lambda (serverless) deployment.
 *
 * Token storage: next-auth stores the session in a signed+encrypted JWT
 * cookie. The Keycloak access_token + id_token + refresh_token are kept
 * on the JWT so proxy.ts can validate the id_token directly and the
 * server can refresh transparently when the access_token expires.
 *
 * Refresh-token rotation follows the Auth.js documented pattern:
 *   https://authjs.dev/guides/refresh-token-rotation
 * Federated logout follows RP-Initiated Logout (OIDC):
 *   https://www.keycloak.org/securing-apps/oidc-layers
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    idToken?: string;
    error?: "RefreshTokenError";
    user: {
      id: string;
      groups?: string[];
      roles?: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    groups?: string[];
    roles?: string[];
    error?: "RefreshTokenError";
  }
}

const hasAuthSecret = !!process.env.AUTH_SECRET;
const KC_ISSUER = process.env.KEYCLOAK_ISSUER ?? "";
const KC_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? "";
const KC_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET ?? "";

/**
 * Exchange the rotated refresh_token at Keycloak's token endpoint.
 * Throws on failure so the jwt callback can flag the session.
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: KC_CLIENT_ID,
  });
  if (KC_CLIENT_SECRET) body.set("client_secret", KC_CLIENT_SECRET);

  const res = await globalThis.fetch(`${KC_ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Keycloak refresh failed: ${res.status}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    id_token?: string;
    expires_in: number;
  };
}

const nextAuthResult = hasAuthSecret
  ? NextAuth({
      providers: [
        Keycloak({
          clientId: KC_CLIENT_ID,
          clientSecret: KC_CLIENT_SECRET,
          issuer: KC_ISSUER,
        }),
      ],
      callbacks: {
        async jwt({ token, account, profile }) {
          // Initial sign-in: persist Keycloak tokens onto the JWT.
          if (account) {
            token.accessToken = account.access_token;
            token.idToken = account.id_token;
            token.refreshToken = account.refresh_token;
            token.expiresAt =
              typeof account.expires_at === "number"
                ? account.expires_at
                : Math.floor(Date.now() / 1000) + Number(account.expires_in ?? 0);
            const p = profile as Record<string, unknown> | undefined;
            token.groups = (p?.["groups"] as string[]) ?? [];
            const realmAccess = p?.["realm_access"] as { roles?: string[] } | undefined;
            token.roles = realmAccess?.roles ?? [];
            return token;
          }

          // Subsequent calls: if access token still valid, reuse.
          const now = Math.floor(Date.now() / 1000);
          if (token.expiresAt && now < token.expiresAt - 30) {
            return token;
          }

          // Access token expired (or near-expired) — rotate via refresh_token.
          if (!token.refreshToken) {
            token.error = "RefreshTokenError";
            return token;
          }

          try {
            const refreshed = await refreshAccessToken(token.refreshToken);
            token.accessToken = refreshed.access_token;
            token.refreshToken = refreshed.refresh_token; // Keycloak rotates by default
            if (refreshed.id_token) token.idToken = refreshed.id_token;
            token.expiresAt = now + refreshed.expires_in;
            delete token.error;
            return token;
          } catch {
            token.error = "RefreshTokenError";
            return token;
          }
        },
        async session({ session, token }) {
          session.accessToken = token.accessToken;
          session.idToken = token.idToken;
          session.user.id = token.sub ?? "";
          session.user.groups = token.groups ?? [];
          session.user.roles = token.roles ?? [];
          if (token.error) session.error = token.error;
          return session;
        },
      },
      events: {
        /**
         * RP-Initiated Logout: when next-auth signs the user out, also end
         * the Keycloak SSO session by calling the realm's end_session_endpoint
         * with id_token_hint. Without this, the Keycloak SSO cookie remains
         * valid and the next signIn() silently re-authenticates without
         * showing the login page.
         */
        async signOut(message) {
          const idToken = "token" in message ? message.token?.idToken : undefined;
          if (!idToken || !KC_ISSUER) return;
          const url = new URL(`${KC_ISSUER}/protocol/openid-connect/logout`);
          url.searchParams.set("id_token_hint", idToken);
          try {
            await globalThis.fetch(url.toString(), { method: "GET" });
          } catch {
            // Best-effort — the cookie is already cleared, Keycloak SSO will
            // age out on its own.
          }
        },
      },
      session: { strategy: "jwt" },
      pages: {
        signIn: "/auth/login",
        error: "/auth/login",
      },
    })
  : null;

export const handlers = nextAuthResult?.handlers ?? {
  GET: () => Response.json({}),
  POST: () => Response.json({}),
};
export const signIn = nextAuthResult?.signIn ?? (async () => undefined);
export const signOut = nextAuthResult?.signOut ?? (async () => undefined);
export const auth = nextAuthResult?.auth ?? (async () => null);
