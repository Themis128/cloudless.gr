/**
 * Lead attribution — first-touch UTM / referrer capture.
 *
 * Flow:
 *   1. `<AttributionCapture />` (mounted in the locale layout) calls
 *      `captureAttribution()` on every page view. The FIRST page view of the
 *      session that carries any signal (UTM params or an external referrer)
 *      wins and is persisted to sessionStorage — later views never overwrite.
 *   2. The contact form reads the stored value via `getStoredAttribution()`
 *      and sends it with the submission payload.
 *   3. `/api/contact` validates it with `sanitizeAttribution()` and forwards
 *      it to EspoCRM (contact note), Slack, and Meta CAPI.
 *
 * `parseAttribution` is a pure function so it can be unit-tested without a
 * browser environment.
 */

export interface LeadAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landingPage?: string;
}

export const ATTRIBUTION_STORAGE_KEY = "cl_attribution";

/** Max length for any single attribution value — defends storage and APIs. */
const MAX_VALUE_LENGTH = 200;

const UTM_KEYS: ReadonlyArray<[param: string, field: keyof LeadAttribution]> = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_term", "utmTerm"],
  ["utm_content", "utmContent"],
];

function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, MAX_VALUE_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Pure parser: extracts attribution from a page URL + document referrer.
 * Returns null when the view carries no attribution signal at all
 * (no UTM params and no external referrer).
 */
export function parseAttribution(pageUrl: string, referrer?: string): LeadAttribution | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }

  const result: LeadAttribution = {};
  for (const [param, field] of UTM_KEYS) {
    const v = clean(url.searchParams.get(param));
    if (v) result[field] = v;
  }

  const cleanReferrer = clean(referrer);
  if (cleanReferrer) {
    try {
      const refHost = new URL(cleanReferrer).hostname;
      // Internal navigation is not an attribution signal.
      if (refHost !== url.hostname) result.referrer = cleanReferrer;
    } catch {
      // Non-URL referrer strings are ignored.
    }
  }

  const hasSignal = Object.keys(result).length > 0;
  if (!hasSignal) return null;

  result.landingPage = url.pathname.slice(0, MAX_VALUE_LENGTH);
  return result;
}

/**
 * Server-side sanitizer for attribution sent by the client.
 * Accepts unknown input, returns a bounded, string-only object (or null).
 */
export function sanitizeAttribution(input: unknown): LeadAttribution | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const fields: (keyof LeadAttribution)[] = [
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "utmTerm",
    "utmContent",
    "referrer",
    "landingPage",
  ];
  const out: LeadAttribution = {};
  for (const field of fields) {
    const v = raw[field];
    if (typeof v === "string") {
      const cleaned = clean(v);
      if (cleaned) out[field] = cleaned;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Human-readable one-line summary, used in notes and Slack messages. */
export function formatAttribution(attribution: LeadAttribution): string {
  const parts: string[] = [];
  if (attribution.utmSource) parts.push(`source=${attribution.utmSource}`);
  if (attribution.utmMedium) parts.push(`medium=${attribution.utmMedium}`);
  if (attribution.utmCampaign) parts.push(`campaign=${attribution.utmCampaign}`);
  if (attribution.utmTerm) parts.push(`term=${attribution.utmTerm}`);
  if (attribution.utmContent) parts.push(`content=${attribution.utmContent}`);
  if (attribution.referrer) parts.push(`referrer=${attribution.referrer}`);
  if (attribution.landingPage) parts.push(`landing=${attribution.landingPage}`);
  return parts.join(" | ");
}

/**
 * Browser-only: parse the current page and persist first-touch attribution.
 * Safe no-op outside the browser or when storage is unavailable.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)) return; // first touch wins
    const parsed = parseAttribution(window.location.href, document.referrer);
const parsed = parseAttribution(window.location.href, document.referrer);
    if (parsed) {
      window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // Storage blocked (private mode / consent tooling) — attribution is best-effort.
  }
}

/** Browser-only: read stored first-touch attribution, or null. */
export function getStoredAttribution(): LeadAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeAttribution(JSON.parse(raw));
  } catch {
    return null;
  }
}
