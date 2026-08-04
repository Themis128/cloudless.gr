import { getConfig } from "@/lib/ssm-config";

/**
 * Postiz webhook signature verification — SERVER ONLY.
 *
 * Kept in its own module (NOT in `postiz.ts`) so the client bundle stays
 * clean: `postiz.ts` is imported by the `"use client"` admin page
 * (`src/app/[locale]/admin/postiz/page.tsx`), and webpack statically
 * analyzes literal dynamic imports — a `node:crypto` reference anywhere in
 * that module graph triggers `UnhandledSchemeError` during the client build.
 * This module must only ever be imported from server-side route handlers.
 *
 * For the verification contract itself, see
 * {@link verifyPostizWebhookSignature}.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an inbound Postiz webhook request.
 *
 * Postiz v2.11.2's webhook UI exposes only Name / URL / Integrations — there
 * is no signing-secret field. So we authenticate inbound events two ways and
 * accept EITHER:
 *
 *   1. **URL-secret** (primary in v2): the configured URL is
 *      `https://cloudless.gr/api/webhooks/postiz?secret=<hex>`. The receiver
 *      pulls `secret` from the query string and compares it constant-time
 *      against `POSTIZ_WEBHOOK_SECRET`. The full URL itself is the
 *      capability token; rotate the SSM param and the URL together.
 *
 *   2. **HMAC-SHA256 signature** (forward-compat): if Postiz starts shipping
 *      `X-Postiz-Signature` (or the user runs a downstream fork that does),
 *      we accept a hex digest of the raw body using the same secret.
 *      Lowercase hex, with or without a `sha256=` prefix.
 *
 * Returns `true` only when the secret is configured AND one of the two paths
 * matches. Both comparisons are constant-time.
 *
 * Callers MUST pass the raw body (pre-JSON.parse) so the HMAC arm has the
 * exact bytes Postiz signed if it does sign.
 */
export async function verifyPostizWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  urlSecret?: string | null
): Promise<boolean> {
  const cfg = await getConfig();
  const secret = cfg.POSTIZ_WEBHOOK_SECRET;
  if (!secret) return false;

  // Path 1 — URL secret. Equal-length check first so timingSafeEqual doesn't
  // throw on a mismatch; constant-time compare otherwise.
  if (urlSecret && urlSecret.length === secret.length) {
    if (timingSafeEqual(Buffer.from(urlSecret, "utf8"), Buffer.from(secret, "utf8"))) {
      return true;
    }
  }

  // Path 2 — HMAC-SHA256 over the raw body.
  if (signatureHeader) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const got = signatureHeader.toLowerCase().replace(/^sha256=/, "");
    if (got.length === expected.length) {
      if (timingSafeEqual(Buffer.from(got, "utf8"), Buffer.from(expected, "utf8"))) {
        return true;
      }
    }
  }

  return false;
}
