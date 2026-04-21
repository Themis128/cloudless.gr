/**
 * Meta Conversions API (CAPI) — server-side event helper.
 *
 * STATUS: Staged but not yet wired up. Activated once all of these are done:
 *   1. Pixel created in Events Manager (Phase C of meta-account-runbook.md).
 *   2. CAPI access token generated from the Pixel settings.
 *   3. Env vars populated:
 *        NEXT_PUBLIC_META_PIXEL_ID   (SSM /cloudless/production/NEXT_PUBLIC_META_PIXEL_ID)
 *        META_CAPI_ACCESS_TOKEN      (SSM /cloudless/production/META_CAPI_ACCESS_TOKEN — SecureString)
 *   4. sendLeadEvent called from src/app/api/contact/route.ts after the
 *      SES send succeeds (see runbook step C.6).
 *
 * Until the env vars are populated, every call short-circuits and returns
 * { ok: false, skipped: true } — safe to import and call early.
 *
 * PII handling: email and phone are SHA-256 hashed per Meta requirements
 * before transmission. Raw values never leave this module.
 *
 * Reference:
 *   https://developers.facebook.com/docs/marketing-api/conversions-api
 *   https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 */

import crypto from "node:crypto";

const GRAPH_API_VERSION = "v19.0";
const CAPI_REQUEST_TIMEOUT_MS = 5000;

type CapiResult =
  | { ok: true; eventsReceived: number }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; status: number; error: string };

type SendEventOptions = {
  /** Required. Matches the eventID passed to the browser pixel for dedup. */
  eventId: string;
  /** Unix seconds; defaults to now. */
  eventTime?: number;
  /** Page URL where the event happened; defaults to https://cloudless.gr. */
  eventSourceUrl?: string;
  /** End-user data — all PII is hashed before send. */
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  country?: string; // ISO-3166-1 alpha-2, e.g. "gr"
  city?: string;
  /** Request context — helps matching. Pass from route handler. */
  clientIpAddress?: string;
  clientUserAgent?: string;
  /** Meta browser cookies if available (fbp = _fbp cookie, fbc = _fbc or from fbclid). */
  fbp?: string;
  fbc?: string;
  /** Event-specific custom data (value, currency, content_name, etc.). */
  customData?: Record<string, unknown>;
};

function sha256(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

function hashMaybe(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? sha256(trimmed) : undefined;
}

/**
 * Strip non-digit characters from a phone number per Meta's CAPI spec
 * (E.164 without the leading "+", spaces, dashes, or parentheses).
 *
 * Examples:
 *   normalizePhone("+30 210 1234567") -> "302101234567"
 *   normalizePhone("(617) 555-0100")  -> "6175550100"
 */
function normalizePhone(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function hashPhoneMaybe(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = normalizePhone(value);
  return digits.length > 0 ? sha256(digits) : undefined;
}

/**
 * Best-effort, fire-and-forget Sentry capture. We never await the dynamic
 * import so a missing/broken Sentry SDK can't take down the CAPI call.
 */
function captureCapiError(err: unknown, context: Record<string, string>): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs")
    .then(({ captureException, withScope }) => {
      withScope((scope) => {
        scope.setTag("integration", "meta-capi");
        for (const [k, v] of Object.entries(context)) scope.setTag(k, v);
        captureException(err);
      });
    })
    .catch(() => {});
}

/**
 * Check whether CAPI is configured. Useful before calling to avoid the
 * short-circuit path — though sendCapiEvent itself is also safe to call
 * when unconfigured.
 */
export function isCapiConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN,
  );
}

/**
 * Send a single server-side event to the Meta Conversions API.
 *
 * This is the low-level primitive — most callers should use one of the
 * typed wrappers below (sendLeadEvent, sendContactEvent, etc.).
 */
export async function sendCapiEvent(
  eventName: string,
  opts: SendEventOptions,
): Promise<CapiResult> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !token) {
    return { ok: false, skipped: true, reason: "CAPI not configured" };
  }

  if (!opts.eventId || opts.eventId.trim().length === 0) {
    return { ok: false, skipped: true, reason: "missing eventId" };
  }

  const userData: Record<string, unknown> = {};
  const emailHash = hashMaybe(opts.email);
  const phoneHash = hashPhoneMaybe(opts.phone);
  const firstNameHash = hashMaybe(opts.firstName);
  const lastNameHash = hashMaybe(opts.lastName);
  const countryHash = hashMaybe(opts.country);
  const cityHash = hashMaybe(opts.city);
  if (emailHash) userData.em = [emailHash];
  if (phoneHash) userData.ph = [phoneHash];
  if (firstNameHash) userData.fn = [firstNameHash];
  if (lastNameHash) userData.ln = [lastNameHash];
  if (countryHash) userData.country = [countryHash];
  if (cityHash) userData.ct = [cityHash];
  if (opts.clientIpAddress) userData.client_ip_address = opts.clientIpAddress;
  if (opts.clientUserAgent) userData.client_user_agent = opts.clientUserAgent;
  if (opts.fbp) userData.fbp = opts.fbp;
  if (opts.fbc) userData.fbc = opts.fbc;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: opts.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: opts.eventId,
        action_source: "website",
        event_source_url: opts.eventSourceUrl ?? "https://cloudless.gr",
        user_data: userData,
        custom_data: opts.customData ?? {},
      },
    ],
  };

  // Sending the token in the request body (rather than as a query
  // parameter) keeps it out of CloudWatch / Sentry / proxy URL logs.
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CAPI_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, access_token: token }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "");
      const safeBody = rawBody
        .replaceAll(token, "[redacted-token]")
        .slice(0, 500);
      captureCapiError(new Error(`CAPI ${eventName} failed: ${res.status}`), {
        event_name: eventName,
        status: String(res.status),
      });
      return { ok: false, status: res.status, error: safeBody };
    }

    const json = (await res.json()) as { events_received?: number };
    return { ok: true, eventsReceived: json.events_received ?? 1 };
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("aborted"));
    captureCapiError(err, {
      event_name: eventName,
      reason: isAbort ? "timeout" : "network_error",
    });
    return {
      ok: false,
      status: 0,
      error: isAbort
        ? `Request aborted after ${CAPI_REQUEST_TIMEOUT_MS}ms`
        : err instanceof Error
          ? err.message
          : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lead event — a form submission with contact intent (contact form, quote
 * request, consultation booking). Call AFTER the form has been accepted
 * (e.g. after SES send in /api/contact).
 */
export function sendLeadEvent(
  opts: SendEventOptions & { source?: string },
): Promise<CapiResult> {
  const { source, ...rest } = opts;
  return sendCapiEvent("Lead", {
    ...rest,
    customData: {
      ...(opts.customData ?? {}),
      ...(source ? { lead_source: source } : {}),
    },
  });
}

/**
 * Contact event — lighter-touch than Lead. Use for newsletter signups or
 * any engagement that expresses interest without a fully-qualified lead.
 */
export function sendContactEvent(opts: SendEventOptions): Promise<CapiResult> {
  return sendCapiEvent("Contact", opts);
}

/**
 * Purchase event — call from the Stripe webhook after
 * payment_intent.succeeded. Must include value + currency in customData.
 */
export function sendPurchaseEvent(
  opts: SendEventOptions & {
    value: number;
    currency: string;
    contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  },
): Promise<CapiResult> {
  const { value, currency, contents, ...rest } = opts;
  return sendCapiEvent("Purchase", {
    ...rest,
    customData: {
      ...(opts.customData ?? {}),
      value,
      currency,
      ...(contents ? { contents, content_type: "product" } : {}),
    },
  });
}
