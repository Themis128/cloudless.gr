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

// Cognito exposes group membership under "cognito:groups".
const GROUPS_CLAIM = "cognito:groups";

// Derive issuer / client ID from NEXT_PUBLIC_* vars when the server-side
// COGNITO_ISSUER / COGNITO_CLIENT_ID vars are not set. The pool ID encodes
// the region: us-east-1_Abc123 → issuer https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Abc123
function cognitoIssuer(poolId: string): string {
  const region = poolId.split("_")[0];
  return `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
}

const poolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const ISSUER = process.env.COGNITO_ISSUER || (poolId ? cognitoIssuer(poolId) : "");
const CLIENT_ID =
  process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
// Public PKCE app client — no client secret.
const CLIENT_SECRET = "";

// Cognito's hosted-UI domain (e.g.
// https://cloudless-auth.auth.us-east-1.amazoncognito.com) for RP-initiated
// logout, which Cognito implements as a non-standard
// /logout?client_id=…&logout_uri=… endpoint (not advertised in its OIDC
// discovery document). Optional — logout is best-effort.
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
 * Exchange the refresh_token at Cognito's token endpoint. Throws on failure.
 * Cognito does not rotate refresh tokens, so the caller keeps the existing one
 * when none is returned.
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}> {
  const token_endpoint = `${COGNITO_DOMAIN}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  const res = await globalThis.fetch(token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
          session.user.roles = [];
          if (token.error) session.error = token.error;
          return session;
        },
      },
      events: {
        /**
         * RP-Initiated Logout: end Cognito's SSO session via the hosted-UI
         * /logout endpoint so the next signIn() shows the login page.
         */
        async signOut() {
          try {
            if (!COGNITO_DOMAIN) return;
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
      // Suppress the benign next-auth "Configuration" error that fires on a bare
      // GET to /api/auth/signin/<provider> (health probes, crawlers, link
      // unfurlers). Real sign-in POSTs with CSRF and is unaffected.
      logger: {
        error(error: Error) {
          const tag = `${error?.name ?? ""} ${(error as { type?: string })?.type ?? ""}`;
          const configured = !!(ISSUER && CLIENT_ID);
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

/** The active OIDC provider id — always "cognito". */
export const authProvider = "cognito" as const;
