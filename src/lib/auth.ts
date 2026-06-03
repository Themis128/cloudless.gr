/**
 * next-auth v5 configuration — provider-agnostic (Cognito OR Keycloak).
 *
 * The OIDC provider is chosen at runtime by environment:
 *   - If COGNITO_ISSUER is set        → AWS Cognito (the always-up AWS path).
 *   - Otherwise, if KEYCLOAK_ISSUER   → Keycloak (legacy / Pi).
 * This lets both providers ship in one build so the cutover is a safe env
 * flip with no code change. Cognito is the migration target (auth must be
 * always-up; Keycloak ran on a single fragile Pi).
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
import Keycloak from "next-auth/providers/keycloak";
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

// ── Provider selection ──────────────────────────────────────────────────────
// Cognito wins when configured; else Keycloak. Both are OIDC, so the rest of
// the wiring (callbacks, proxy.ts, api-auth.ts) is shared — only the issuer,
// client creds, and the groups claim name differ.
type OidcProvider = "cognito" | "keycloak";
const PROVIDER: OidcProvider = process.env.COGNITO_ISSUER ? "cognito" : "keycloak";
const IS_COGNITO = PROVIDER === "cognito";

const ISSUER = (IS_COGNITO ? process.env.COGNITO_ISSUER : process.env.KEYCLOAK_ISSUER) ?? "";
const CLIENT_ID =
  (IS_COGNITO ? process.env.COGNITO_CLIENT_ID : process.env.KEYCLOAK_CLIENT_ID) ?? "";
const CLIENT_SECRET =
  (IS_COGNITO ? process.env.COGNITO_CLIENT_SECRET : process.env.KEYCLOAK_CLIENT_SECRET) ?? "";

// Cognito exposes group membership under "cognito:groups"; Keycloak under
// "groups" (via the group-membership protocol mapper, full.path=false).
const GROUPS_CLAIM = IS_COGNITO ? "cognito:groups" : "groups";
const KC_CLAIM_REALM_ACCESS = "realm_access";

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

// Provider token / logout endpoints. Explicit per provider (no discovery
// round-trip) so the Keycloak path is unchanged and Cognito uses its hosted
// domain. Cognito's token endpoint is {domain}/oauth2/token; Keycloak's is
// {issuer}/protocol/openid-connect/token.
function tokenEndpoint(): string {
  return IS_COGNITO ? `${COGNITO_DOMAIN}/oauth2/token` : `${ISSUER}/protocol/openid-connect/token`;
}

const hasAuthSecret = !!process.env.AUTH_SECRET;

/**
 * Exchange the refresh_token at the provider's token endpoint. Throws on
 * failure so the jwt callback can flag the session. Cognito does not rotate
 * refresh tokens, so the caller keeps the existing one when none is returned.
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}> {
  const token_endpoint = tokenEndpoint();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  // Cognito app clients with a secret require HTTP Basic auth on /oauth2/token;
  // Keycloak accepts the secret in the body. Send the appropriate form.
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (CLIENT_SECRET) {
    if (IS_COGNITO) {
      headers.Authorization = `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`;
    } else {
      body.set("client_secret", CLIENT_SECRET);
    }
  }

  const res = await globalThis.fetch(token_endpoint, {
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

function readRoles(
  accessPayload: Record<string, unknown>,
  profile?: Record<string, unknown>
): string[] {
  // Realm roles are Keycloak-only; Cognito conveys authorization via groups.
  const realmAccess = (accessPayload[KC_CLAIM_REALM_ACCESS] ?? profile?.[KC_CLAIM_REALM_ACCESS]) as
    | { roles?: string[] }
    | undefined;
  return realmAccess?.roles ?? [];
}

const providers = [
  IS_COGNITO
    ? Cognito({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, issuer: ISSUER })
    : Keycloak({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, issuer: ISSUER }),
];

const nextAuthResult = hasAuthSecret
  ? NextAuth({
      providers,
      callbacks: {
        async jwt({ token, account, profile }) {
          // Initial sign-in: persist provider tokens onto the JWT.
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
            token.roles = readRoles(accessPayload, p);
            return token;
          }

          // Subsequent calls: if access token still valid, reuse.
          const now = Math.floor(Date.now() / 1000);
          if (token.expiresAt && now < token.expiresAt - 30) {
            return token;
          }

          // Access token expired (or near-expired) — rotate via refresh_token.
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
            token.roles = readRoles(payload).length ? readRoles(payload) : (token.roles ?? []);
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
        /**
         * RP-Initiated Logout: end the provider's SSO session so the next
         * signIn() shows the login page instead of silently re-authenticating.
         *   - Keycloak: standard end_session_endpoint + id_token_hint.
         *   - Cognito: non-standard {domain}/logout?client_id&logout_uri.
         */
        async signOut(message) {
          const idToken = "token" in message ? message.token?.idToken : undefined;
          try {
            if (IS_COGNITO) {
              if (!COGNITO_DOMAIN) return;
              const url = new URL(`${COGNITO_DOMAIN}/logout`);
              url.searchParams.set("client_id", CLIENT_ID);
              url.searchParams.set("logout_uri", `${AUTH_URL}/`);
              await globalThis.fetch(url.toString(), { method: "GET" });
              return;
            }
            if (!idToken || !ISSUER) return;
            const url = new URL(`${ISSUER}/protocol/openid-connect/logout`);
            url.searchParams.set("id_token_hint", idToken);
            await globalThis.fetch(url.toString(), { method: "GET" });
          } catch {
            // Best-effort — the cookie is already cleared; SSO ages out.
          }
        },
      },
      session: { strategy: "jwt" },
      // Suppress the benign next-auth "Configuration" error that fires on a bare
      // GET to /api/auth/signin/<provider> (health probes, crawlers, link
      // unfurlers). Real sign-in POSTs with CSRF and is unaffected. That log
      // line is what the CloudWatch `CloudlessApp/ServerlessErrors` metric
      // filter counts. We only swallow it when the provider is actually
      // configured — a missing issuer is a real misconfig and still logs.
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

/** The active OIDC provider id ("cognito" | "keycloak"), for callers/UI. */
export const authProvider: OidcProvider = PROVIDER;
