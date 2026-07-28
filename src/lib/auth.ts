/**
 * next-auth v5 configuration — Cognito OIDC provider.
 *
 * Token storage: The session cookie carries only the user sub, groups, and
 * expiry metadata. The actual id_token and refresh_token are persisted in
 * DynamoDB (SessionTokenStore table) to keep the cookie well under the 4KB
 * limit and avoid 413s on CloudFront/Lambda edge. Tokens are fetched from
 * DynamoDB only when a refresh is needed or when the session callback
 * populates session.idToken for downstream use (fetch-with-auth).
 *
 * Refresh-token rotation follows the Auth.js documented pattern:
 *   https://authjs.dev/guides/refresh-token-rotation
 */

import NextAuth, { type DefaultSession, type Account } from "next-auth";
import Cognito from "next-auth/providers/cognito";
import type { JWT } from "next-auth/jwt";
import { getTokens, putTokens, deleteTokens } from "@/lib/session-token-store";

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
    /** Whether tokens have been persisted to DynamoDB for this session */
    tokensPersisted?: boolean;
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

// JWT callback helpers — extracted to keep the callback under the cognitive-
// complexity threshold (sonarjs/cognitive-complexity, S3776).

/** Handles the initial sign-in: persist tokens to DynamoDB and populate claims. */
async function handleSignIn(
  token: JWT,
  account: Account,
  profile: Record<string, unknown> | undefined
): Promise<JWT> {
  const userId = token.sub ?? "";
  if (userId && account.id_token && account.refresh_token) {
    await putTokens(userId, {
      idToken: account.id_token as string,
      refreshToken: account.refresh_token as string,
    });
    token.tokensPersisted = true;
  }
  token.expiresAt =
    typeof account.expires_at === "number"
      ? account.expires_at
      : Math.floor(Date.now() / 1000) + Number(account.expires_in ?? 0);

  const accessPayload = account.access_token
    ? decodeJwtPayload(account.access_token as string)
    : {};
  const idPayload = account.id_token ? decodeJwtPayload(account.id_token as string) : {};

  token.groups = readGroups(idPayload, accessPayload, profile);
  token.roles = [];
  return token;
}

/** Attempts to refresh an expired session token using the stored refresh_token. */
async function handleTokenRefresh(token: JWT, env: AuthEnv, now: number): Promise<JWT> {
  const userId = token.sub ?? "";
  if (!userId) {
    token.error = REFRESH_TOKEN_ERROR;
    return token;
  }

  let stored;
  try {
    stored = await getTokens(userId);
  } catch {
    token.error = REFRESH_TOKEN_ERROR;
    return token;
  }

  if (!stored?.refreshToken) {
    token.error = REFRESH_TOKEN_ERROR;
    return token;
  }

  try {
    const refreshed = await refreshAccessToken(stored.refreshToken, env);
    // Persist updated tokens back to DynamoDB
    await putTokens(userId, {
      idToken: refreshed.id_token ?? stored.idToken,
      refreshToken: refreshed.refresh_token ?? stored.refreshToken,
    });
    token.expiresAt = now + refreshed.expires_in;
    const payload = decodeJwtPayload(refreshed.access_token);
    token.groups = (payload[GROUPS_CLAIM] as string[] | undefined) ?? token.groups ?? [];
    delete token.error;
    return token;
  } catch {
    token.error = REFRESH_TOKEN_ERROR;
    return token;
  }
}

function buildNextAuth(env: AuthEnv): NextAuthResult {
  const { issuer, clientId, clientSecret, cognitoDomain, authUrl } = env;
  return NextAuth({
    providers: [Cognito({ clientId, clientSecret, issuer })],
    callbacks: {
      async jwt({ token, account, profile }) {
        if (account) {
          // On initial sign-in, persist tokens to DynamoDB instead of the JWT
          // cookie. This keeps the cookie thin and avoids the 4KB/413 issue.
          return handleSignIn(token, account, profile as Record<string, unknown> | undefined);
        }

        const now = Math.floor(Date.now() / 1000);
        if (token.expiresAt && now < token.expiresAt - 30) {
          return token;
        }

        // Token expired — refresh using tokens from DynamoDB
        return handleTokenRefresh(token, env, now);
      },
      async session({ session, token }) {
        // Fetch idToken from DynamoDB for downstream use (fetch-with-auth)
        const userId = token.sub ?? "";
        if (userId) {
          try {
            const stored = await getTokens(userId);
            session.idToken = stored?.idToken;
          } catch {
            // Non-fatal — session still works, just no idToken for API calls
          }
        }
        session.user.id = userId;
        session.user.groups = token.groups ?? [];
        session.user.roles = token.roles ?? [];
        if (token.error) session.error = token.error;
        return session;
      },
    },
    events: {
      async signOut(message) {
        // Clean up stored tokens from DynamoDB
        const idToken = "token" in message ? message.token?.sub : undefined;
        if (idToken) {
          try {
            await deleteTokens(idToken);
          } catch {
            // Best-effort cleanup
          }
        }

        if (!cognitoDomain) return;
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
        // Auth.js v5 can surface Configuration errors with the word in the
        // message rather than the error name/type (e.g. when the error is a
        // generic AuthError wrapper). Check both to avoid the CloudWatch
        // SERVERLESS-APP_MAIN-Errors alarm firing on crawler/probe GETs.
        const CONFIG_ERROR_KEYWORD = "Configuration";
        const isConfigurationError =
          tag.includes(CONFIG_ERROR_KEYWORD) ||
          (error?.message ?? "").includes(CONFIG_ERROR_KEYWORD);
        if (isConfigurationError && configured) return;
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
  if (!env.authSecret || !env.issuer || !env.clientId || !env.clientSecret) {
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
      ((req: Request) => Response | Promise<Response>) | undefined;
    return h ? h(req) : getDisabledAuthResponse(req);
  },
  POST: (req: Request) => {
    const h = getNextAuth()?.handlers.POST as
      ((req: Request) => Response | Promise<Response>) | undefined;
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
