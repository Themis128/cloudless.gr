import NextAuth, { type DefaultSession } from "next-auth";
import { D1Database } from "@cloudflare/workers-types";
import { createHmac, randomBytes } from "crypto";
import {
  recordNotification,
  sendActivationEmail,
  notifyTeam,
  slackRegistrationNotify,
  hashPassword,
  verifyPassword,
  rateLimit,
  getClientIp,
} from "@/lib/auth-utils";
const REFRESH_TOKEN_ERROR = "RefreshTokenError" as const;
declare const AUTH_DB: D1Database;
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
    /** Whether tokens have been persisted to D1 for this session */
    tokensPersisted?: boolean;
    expiresAt?: number;
    groups?: string[];
    roles?: string[];
    error?: RefreshTokenError;
  }
}

/**
 * Cloudflare D1-based authentication configuration.
 *
 * Session storage: The session cookie carries only the user id and expiry metadata.
 * The actual session data is persisted in D1 to keep the cookie under the 4KB limit.
 *
 * Token rotation follows a similar pattern to the Cognito implementation.
 */

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
  authUrl: string;
  authSecret: string;
}

function resolveAuthEnv(): AuthEnv {
  return {
    authUrl: (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, ""),
    authSecret: process.env.AUTH_SECRET ?? "",
  };
}

declare const AUTH_DB: D1Database;
/**
 * Handles the initial sign-in: create session in D1 and populate claims.
 */
async function handleSignIn(
  token: JWT,
  user: { id: string; email: string; fullName?: string }
): Promise<JWT> {
  const userId = token.sub ?? "";
  if (userId) {
    await AUTH_DB.prepare(
      "INSERT INTO sessions (user_id, expires_at) VALUES (?, ?)"
    )
      .bind(userId, Math.floor(Date.now() / 1000) + 3600 * 24) // 24-hour expiry
      .run();
    token.tokensPersisted = true;
  }

  token.expiresAt = Math.floor(Date.now() / 1000) + 3600 * 24; // 24-hour expiry
  token.groups = [];
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

  try {
    // Check if session exists in D1
    const session = await AUTH_DB.prepare("SELECT expires_at FROM sessions WHERE user_id = ?")
      .bind(userId)
      .first();

    if (!session || session.expires_at <= now) {
      token.error = REFRESH_TOKEN_ERROR;
      return token;
    }

    // Update session expiry
    token.expiresAt = now + 3600 * 24; // 24-hour expiry
    await AUTH_DB.prepare("UPDATE sessions SET expires_at = ? WHERE user_id = ?")
      .bind(token.expiresAt, userId)
      .run();

    delete token.error;
    return token;
  } catch {
    token.error = REFRESH_TOKEN_ERROR;
    return token;
  }
}

function buildNextAuth(env: AuthEnv): NextAuthResult {
  const { authUrl } = env;
  return NextAuth({
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          // On initial sign-in, create session in D1
          return handleSignIn(token, user as { id: string; email: string; fullName?: string });
        }

        const now = Math.floor(Date.now() / 1000);
        if (token.expiresAt && now < token.expiresAt - 30) {
          return token;
        }

        // Token expired — refresh using D1 session
        return handleTokenRefresh(token, env, now);
      },
      async session({ session, token }) {
        session.user.id = token.sub ?? "";
        session.user.groups = token.groups ?? [];
        session.user.roles = token.roles ?? [];
        if (token.error) session.error = token.error;
        return session;
      },
    },
    events: {
      async signOut(message) {
        // Clean up stored tokens from D1
        const userId = "token" in message ? message.token?.sub : undefined;
        if (userId) {
          try {
            await AUTH_DB.prepare("DELETE FROM sessions WHERE user_id = ?")
              .bind(userId)
              .run();
          } catch {
            // Best-effort cleanup
          }
        }
      },
    },
    session: { strategy: "jwt" },
    logger: {
      error(error: Error) {
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
 * Lazily-built, memoized next-auth instance. Built on first use (a request).
 * Returns null when AUTH_SECRET is still unset (auth genuinely unconfigured).
 */
let memoizedResult: NextAuthResult | null = null;
let memoizedConfigured = false;

function getNextAuth(): NextAuthResult | null {
  if (memoizedConfigured) return memoizedResult;
  const env = resolveAuthEnv();
  if (!env.authSecret) {
    // Don't memoize: values may still be hydrating on a cold start or dev-server
    // restart, so a later request should retry rather than be permanently locked
    // to a broken instance.
    return null;
  }
  memoizedResult = buildNextAuth(env);
  memoizedConfigured = true;
  return memoizedResult;
}

/** The active auth provider, resolved lazily. */
export function getAuthProvider(): "d1" | null {
  return "d1";
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