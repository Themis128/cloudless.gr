/** Shared plumbing for the server-to-server upstream API clients
 *  (`postiz.ts`, `socialauto.ts`) — CF Access service-token parsing and
 *  JSON-body decoding. Intentionally tiny; heavier concerns (retry/backoff,
 *  Sentry) live in `integration-http.ts`. */

export interface CfAccessCreds {
  clientId: string;
  clientSecret: string;
}

/** The pair can be provided two ways: two values (explicit client id +
 *  bare secret) or a single combined `"client_id:client_secret"` token.
 *  Returns null when neither form is present — callers then skip the
 *  Access headers entirely. */
export function splitServiceToken(
  raw: string | null | undefined,
  explicitId: string | null | undefined
): CfAccessCreds | null {
  if (!raw) return null;
  if (explicitId) return { clientId: explicitId, clientSecret: raw };
  const colon = raw.indexOf(":");
  if (colon > 0) return { clientId: raw.slice(0, colon), clientSecret: raw.slice(colon + 1) };
  return null;
}

const ALLOWED_LOOKBACK = new Set([7, 14, 30, 60, 90]);

/** Parses a `?date=` lookback against the shared allowlist (default 7). */
export function parseAnalyticsLookback(raw: string | null): 7 | 14 | 30 | 60 | 90 {
  const n = Number.parseInt(raw ?? "7", 10);
  return (ALLOWED_LOOKBACK.has(n) ? n : 7) as 7 | 14 | 30 | 60 | 90;
}

/** JSON.parse a response body, wrapping failures in the client's domain
 *  error — `makeError` receives the `invalid JSON (…; len=N)` detail and
 *  may append its own context (e.g. content-type). */
export function parseJsonOrThrow<T>(text: string, makeError: (_detail: string) => Error): T {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw makeError(`invalid JSON (${reason}; len=${text.length})`);
  }
}
