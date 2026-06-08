/**
 * next-auth v5 configuration — Cognito OIDC provider.
 *
 * Token storage: next-auth stores the session in a signed+encrypted JWT
 * cookie. The provider access_token + id_token + refresh_token are kept on
 * the JWT so proxy.ts can validate the id_token directly and the server can
 * refresh transparently when the access_token expires.
 *
 * Refresh-token rotation follows the Auth.js documented pattern:
 *   https://authjs.dev/guides/refresh-token-rotation
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Cognito from "next-auth/providers/cognito";

const REFRESH_TOKEN_ERROR = "RefreshTokenError" as const;
type RefreshTokenError = typeof REFRESH_TOKEN_ERROR;

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    idToken?: string;
    error?: RefreshTokenError;
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
    error?: RefreshTokenError;
  }
}

// Cognito's OIDC issuer is deterministic:
//   https://cognito-idp.{region}.amazonaws.com/{userPoolId}
// Derive it from COGNITO_USER_POOL_ID when COGNITO_ISSUER isn't set explicitly,
// so a deploy that only carries the pool ID (the common case in SSM / .env)
// still produces a valid provider instead of Auth.js's "missing both issuer and
// authorization endpoint config" Configuration error. Mirrors the derivation in
// proxy.ts and api-auth.ts.
function resolveCognitoIssuer(): string {
  const explicit = (process.env.COGNITO_ISSUER ?? "").replace(/\/+$/, "");
  if (explicit) return explicit;
  const poolId =
    process.env.COGNITO_USER_POOL_ID ?? process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
  if (!poolId) return "";
  const region = process.env.AWS_REGION || poolId.split("_")[0] || "us-east-1";
  return `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
}

const ISSUER = resolveCognitoIssuer();
const CLIENT_ID = process.env.COGNITO_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET ?? "";

export const authProvider: "cognito" | null = ISSUER ? "cognito" : null;

// Cognito exposes group membership under "cognito:groups".
const GROUPS_CLAIM = "cognito:groups";

// Cognito's hosted-UI domain (e.g.
// https://cloudless-auth.auth.us-east-1.amazoncognito.com) for RP-initiated
// logout, which Cognito implements as a non-standard
// /logout?client_id=…&logout_uri=… endpoint.
const COGNITO_DOMAIN = (process.env.COGNITO_DOMAIN ?? "").replace(/\/+$/, "");
const AUTH_URL = (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(
  /\/+$/,
  ""
);

/** Decode a JWT without verification — used only to read provider claims. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const padded = part.replaceAll("-", "+").replaceAll("_", "/");
    const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Exchange the refresh_token at Cognito's token endpoint. Throws on failure
 * so the jwt callback can flag the session. Cognito does not rotate refresh
 * tokens, so the caller keeps the existing one when none is returned.
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };

  const res = await globalThis.fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
  };
}

function readGroups(
  idPayload: Record<string, unknown>,
  accessPayload: Record<string, unknown>,
  profile?: Record<string, unknown>
): string[] {
  return (
    (idPayload[GROUPS_CLAIM] as string[] | undefined) ??
    (accessPayload[GROUPS_CLAIM] as string[] | undefined) ??
    (profile?.[GROUPS_CLAIM] as string[] | undefined) ??
    []
  );
}

const hasAuthSecret = !!process.env.AUTH_SECRET;

const nextAuthResult = hasAuthSecret
  ? NextAuth({
      providers: [Cognito({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, issuer: ISSUER })],
      callbacks: {
        async jwt({ token, account, profile }) {
          if (account) {
            token.accessToken = account.access_token;
            token.idToken = account.id_token;
            token.refreshToken = account.refresh_token;
            token.expiresAt =
              typeof account.expires_at === "number"
                ? account.expires_at
                : Math.floor(Date.now() / 1000) + Number(account.expires_in ?? 0);

            const accessPayload = account.access_token
              ? decodeJwtPayload(account.access_token as string)
              : {};
            const idPayload = account.id_token ? decodeJwtPayload(account.id_token as string) : {};
            const p = profile as Record<string, unknown> | undefined;

            token.groups = readGroups(idPayload, accessPayload, p);
            token.roles = [];
            return token;
          }

          const now = Math.floor(Date.now() / 1000);
          if (token.expiresAt && now < token.expiresAt - 30) {
            return token;
          }

          if (!token.refreshToken) {
            token.error = REFRESH_TOKEN_ERROR;
            return token;
          }

          try {
            const refreshed = await refreshAccessToken(token.refreshToken);
            token.accessToken = refreshed.access_token;
            if (refreshed.refresh_token) token.refreshToken = refreshed.refresh_token;
            if (refreshed.id_token) token.idToken = refreshed.id_token;
            token.expiresAt = now + refreshed.expires_in;
            const payload = decodeJwtPayload(refreshed.access_token);
            token.groups = (payload[GROUPS_CLAIM] as string[] | undefined) ?? token.groups ?? [];
            delete token.error;
            return token;
          } catch {
            token.error = REFRESH_TOKEN_ERROR;
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
        async signOut(message) {
          if (!COGNITO_DOMAIN) return;
          const idToken = "token" in message ? message.token?.idToken : undefined;
          void idToken; // Cognito logout uses client_id + logout_uri, not id_token_hint
          try {
            const url = new URL(`${COGNITO_DOMAIN}/logout`);
            url.searchParams.set("client_id", CLIENT_ID);
            url.searchParams.set("logout_uri", `${AUTH_URL}/`);
            await globalThis.fetch(url.toString(), { method: "GET" });
          } catch {
            // Best-effort — the cookie is already cleared; SSO ages out.
          }
        },
      },
      session: { strategy: "jwt" },
      logger: {
        error(error: Error) {
          const tag = `${error?.name ?? ""} ${(error as { type?: string })?.type ?? ""}`;
          const configured = !!(ISSUER && CLIENT_ID && CLIENT_SECRET);
          if (tag.includes("Configuration") && configured) return;
          console.error(`[auth][error] ${error?.message ?? error}`);
        },
      },
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
