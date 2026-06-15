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

// Cognito exposes group membership under "cognito:groups".
const GROUPS_CLAIM = "cognito:groups";

/**
 * Auth config resolved from the environment.
 *
 * IMPORTANT: every value here is read from `process.env` *lazily*, the first
 * time the next-auth instance is actually needed (a request), NOT at module
 * load. On Lambda the auth secrets (AUTH_SECRET, COGNITO_CLIENT_SECRET, …)
 * are not in the SST environment block — they are hydrated into process.env
 * by `instrumentation.register()`, which runs asynchronously on cold start.
 * If we froze this config at module-evaluation time we'd race that hydration:
 * the auth module is often evaluated before register() resolves, so ISSUER /
 * AUTH_SECRET would be "" and next-auth would build a provider-less, secret-less
 * instance that returns `{}` / throws `Configuration` for the entire life of
 * the warm container. Reading lazily guarantees we see the hydrated values.
 * proxy.ts and api-auth.ts read the same env lazily for the same reason.
 */
interface AuthEnv {
  issuer: string;
  clientId: string;
  clientSecret: string;
  cognitoDomain: string;
  authUrl: string;
  authSecret: string;
}

function resolveAuthEnv(): AuthEnv {
  return {
    issuer: resolveCognitoIssuer(),
    clientId: process.env.COGNITO_CLIENT_ID ?? "",
    clientSecret: process.env.COGNITO_CLIENT_SECRET ?? "",
    // Cognito's hosted-UI domain (e.g.
    // https://cloudless-auth.auth.us-east-1.amazoncognito.com) for RP-initiated
    // logout, which Cognito implements as a non-standard
    // /logout?client_id=…&logout_uri=… endpoint.
    cognitoDomain: (process.env.COGNITO_DOMAIN ?? "").replace(/\/+$/, ""),
    authUrl: (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, ""),
    authSecret: process.env.AUTH_SECRET ?? "",
  };
}

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
async function refreshAccessToken(
  refreshToken: string,
  env: Pick<AuthEnv, "clientId" | "cognitoDomain">
): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.clientId,
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };

  const res = await globalThis.fetch(`${env.cognitoDomain}/oauth2/token`, {
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

type NextAuthResult = ReturnType<typeof NextAuth>;

function buildNextAuth(env: AuthEnv): NextAuthResult {
  const { issuer, clientId, clientSecret, cognitoDomain, authUrl } = env;
  return NextAuth({
    providers: [Cognito({ clientId, clientSecret, issuer })],
    callbacks: {
      async jwt({ token, account, profile }) {
        if (account) {
          // accessToken is intentionally NOT persisted on the JWT. Nothing reads
          // session.accessToken, and dropping it shrinks the encrypted session
          // cookie — which chunks past the 4KB limit and can push the combined
          // Cookie header over the CloudFront/Lambda edge limit (→ 413 on
          // authenticated requests). idToken (used by fetch-with-auth) and
          // refreshToken (used to refresh) are still needed, so they stay.
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
          const refreshed = await refreshAccessToken(token.refreshToken, env);
          // accessToken not stored (see jwt account branch above); we still decode
          // the fresh access_token below to refresh the groups claim.
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
        if (!cognitoDomain) return;
        const idToken = "token" in message ? message.token?.idToken : undefined;
        void idToken; // Cognito logout uses client_id + logout_uri, not id_token_hint
        try {
          const url = new URL(`${cognitoDomain}/logout`);
          url.searchParams.set("client_id", clientId);
          url.searchParams.set("logout_uri", `${authUrl}/`);
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
        const configured = !!(issuer && clientId && clientSecret);
        if (tag.includes("Configuration") && configured) return;
        console.error(`[auth][error] ${error?.message ?? error}`);
      },
    },
    pages: {
      signIn: "/auth/login",
      error: "/auth/login",
    },
  });
}

/**
 * Lazily-built, memoized next-auth instance. Built on first use (a request),
 * by which time instrumentation.register() has hydrated process.env from SSM.
 * Returns null when AUTH_SECRET is still unset (auth genuinely unconfigured).
 */
let memoizedResult: NextAuthResult | null = null;
let memoizedConfigured = false;

function getNextAuth(): NextAuthResult | null {
  if (memoizedConfigured) return memoizedResult;
  const env = resolveAuthEnv();
  if (!env.authSecret || !env.issuer) {
    // Don't memoize: values may still be hydrating on a cold start or dev-server
    // restart, so a later request should retry rather than be permanently locked
    // to a broken instance.  (next-auth throws "missing issuer" when issuer is
    // empty — memoizing that would poison all subsequent requests.)
    return null;
  }
  memoizedResult = buildNextAuth(env);
  memoizedConfigured = true;
  return memoizedResult;
}

/** The active auth provider, resolved lazily. null when unconfigured. */
export function getAuthProvider(): "cognito" | null {
  return resolveCognitoIssuer() ? "cognito" : null;
}

/**
 * Fallback response when auth is disabled (no AUTH_SECRET / issuer configured).
 * Returns null session for /api/auth/session GET, 200 for other endpoints.
 * This prevents "Unexpected token '<'" errors from the browser when auth is unconfigured
 * for local dev.
 */
function getDisabledAuthResponse(req: Request) {
  const url = new URL(req.url);
  if (url.pathname === "/api/auth/session") {
    return Response.json(null);
  }
  return Response.json({});
}

/**
 * Stable handlers object. GET/POST resolve the real next-auth handler lazily
 * per request, so the route module (`export const { POST } = handlers`) can
 * destructure at import time while the underlying instance is built on demand.
 */
export const handlers: {
  GET: (req: Request) => Response | Promise<Response>;
  POST: (req: Request) => Response | Promise<Response>;
} = {
  GET: (req: Request) => {
    const h = getNextAuth()?.handlers.GET as
      | ((req: Request) => Response | Promise<Response>)
      | undefined;
    return h ? h(req) : getDisabledAuthResponse(req);
  },
  POST: (req: Request) => {
    const h = getNextAuth()?.handlers.POST as
      | ((req: Request) => Response | Promise<Response>)
      | undefined;
    return h ? h(req) : getDisabledAuthResponse(req);
  },
};

export const signIn: NextAuthResult["signIn"] = (...args: Parameters<NextAuthResult["signIn"]>) => {
  const fn = getNextAuth()?.signIn;
  return (fn ? fn(...args) : Promise.resolve(undefined)) as ReturnType<NextAuthResult["signIn"]>;
};

export const signOut: NextAuthResult["signOut"] = (
  ...args: Parameters<NextAuthResult["signOut"]>
) => {
  const fn = getNextAuth()?.signOut;
  return (fn ? fn(...args) : Promise.resolve(undefined)) as ReturnType<NextAuthResult["signOut"]>;
};

export const auth: NextAuthResult["auth"] = ((...args: unknown[]) => {
  const fn = getNextAuth()?.auth as ((...a: unknown[]) => unknown) | undefined;
  return fn ? fn(...args) : Promise.resolve(null);
}) as NextAuthResult["auth"];
