/**
 * Sentry beforeSend / beforeBreadcrumb scrubbers.
 *
 * Redacts secret-shaped values from error events and breadcrumbs before they
 * leave the runtime. The Sentry replay integration already masks DOM text;
 * this catches the server-side path (request bodies, query params, env-var
 * dumps in stack frames) and any client-side fetch URLs that include tokens.
 */

import type { ErrorEvent, EventHint, Breadcrumb } from "@sentry/core";

const REDACT = "[REDACTED]";

// Header names that are always sensitive. Match is case-insensitive.
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-cron-secret",
  "x-hub-signature",
  "x-hub-signature-256",
  "stripe-signature",
  "x-hubspot-signature",
  "x-hubspot-signature-v3",
  "x-notion-signature",
]);

// Query / body keys whose values are always sensitive.
const SENSITIVE_KEY_RE =
  /^(password|token|secret|key|api_-?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|webhook[_-]?secret|signature|otp|code|nonce|bearer)$/i;

// Free-text patterns: anything that looks like a Bearer token, AKIA…, JWT, etc.
function looksLikeToken(value: string): boolean {
  if (value.length < 12) return false;
  // AWS access key id
  if (/^AKIA[0-9A-Z]{16}$/.test(value)) return true;
  // AWS secret access key (40 chars, base64-ish)
  if (/^[A-Za-z0-9/+]{40}$/.test(value)) return true;
  // JWT (three base64url segments separated by dots)
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return true;
  // GitHub PAT / OAuth token shapes
  if (/^gh[pousr]_[A-Za-z0-9]{30,}$/.test(value)) return true;
  // Stripe live keys
  if (/^sk_live_[A-Za-z0-9]{20,}$/.test(value)) return true;
  // Notion v2 secret
  if (/^secret_[A-Za-z0-9]{40,}$/.test(value)) return true;
  return false;
}

function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(name.toLowerCase())) {
      out[name] = REDACT;
    } else {
      out[name] = value;
    }
  }
  return out;
}

function redactRecord(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? REDACT : redactObject(v);
  }
  return out;
}

function redactObject(input: unknown): unknown {
  if (typeof input === "string") return looksLikeToken(input) ? REDACT : input;
  if (Array.isArray(input)) return input.map(redactObject);
  if (input !== null && typeof input === "object") {
    return redactRecord(input as Record<string, unknown>);
  }
  return input;
}

function redactQueryString(qs: string): string {
  // Lightweight scrub: parse "k=v&k2=v2" and redact sensitive keys.
  return qs
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq < 0) return pair;
      const k = decodeURIComponent(pair.slice(0, eq));
      const v = pair.slice(eq + 1);
      if (SENSITIVE_KEY_RE.test(k) || looksLikeToken(decodeURIComponent(v))) {
        return `${pair.slice(0, eq)}=${REDACT}`;
      }
      return pair;
    })
    .join("&");
}

function redactUrl(url: string): string {
  const qIdx = url.indexOf("?");
  if (qIdx < 0) return url;
  return `${url.slice(0, qIdx)}?${redactQueryString(url.slice(qIdx + 1))}`;
}

function redactCookies(cookies: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(cookies)) out[k] = REDACT;
  return out;
}

function scrubRequest(req: NonNullable<ErrorEvent["request"]>): void {
  if (req.headers) req.headers = redactHeaders(req.headers);
  if (typeof req.url === "string") req.url = redactUrl(req.url);
  if (typeof req.query_string === "string") {
    req.query_string = redactQueryString(req.query_string);
  }
  if (req.data !== undefined) req.data = redactObject(req.data);
  if (req.cookies !== undefined) req.cookies = redactCookies(req.cookies);
}

export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.request) scrubRequest(event.request);
  if (event.extra) event.extra = redactObject(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = redactObject(event.contexts) as typeof event.contexts;
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (!breadcrumb.data) return breadcrumb;
  // fetch/xhr/console breadcrumbs commonly contain url + body
  const data = { ...breadcrumb.data };
  if (typeof data.url === "string") data.url = redactUrl(data.url);
  if (data.body !== undefined) data.body = redactObject(data.body);
  if (data.headers) data.headers = redactObject(data.headers);
  breadcrumb.data = data;
  return breadcrumb;
}
