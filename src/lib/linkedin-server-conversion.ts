import "server-only";

/**
 * Server-side LinkedIn conversion fires via SocialAuto.
 *
 * SocialAuto owns the LinkedIn Marketing API token and the
 * `CONVERSIONS_API`-typed conversion rules (auto-provisioned daily by the
 * `linkedin-conversion-ensure` beat). This helper POSTs named events to
 * `POST {SOCIALAUTO_API_URL}/api/v1/webhooks/linkedin-conversion`, which
 * resolves the rule URN and streams the event with SHA256 email matching.
 *
 * Events map to `linkedin_advanced.CONVERSION_EVENTS`:
 *   contact_created | consultation_booked | signup | purchase | lead_created | audit_booked
 *
 * Auth: `X-Conversion-Key` must equal SocialAuto's `LINKEDIN_CONVERSION_INGEST_KEY`
 * (config `SOCIALAUTO_CONVERSION_KEY` here). When either side is unset the
 * call is a no-op — conversions degrade silently, never block the request.
 *
 * Always fire-and-forget: callers use `void fireLinkedInServerConversion(...)`.
 */

import { getConfig } from "@/lib/ssm-config";

export type LinkedInServerEvent =
  | "contact_created"
  | "consultation_booked"
  | "signup"
  | "purchase"
  | "lead_created"
  | "audit_booked";

export interface LinkedInServerConversionInput {
  event: LinkedInServerEvent;
  email?: string | null;
  value?: number | null;
  currency?: string | null;
  eventId?: string | null;
}

export async function fireLinkedInServerConversion(
  input: LinkedInServerConversionInput
): Promise<void> {
  try {
    const cfg = await getConfig();
    const base = (
      process.env.SOCIALAUTO_API_URL ||
      cfg.SOCIALAUTO_API_URL ||
      "https://social.cloudless.gr"
    ).replace(/\/+$/, "");
    // Wrangler secret / env only — not part of the typed AppConfig surface.
    const key = process.env.SOCIALAUTO_CONVERSION_KEY || "";

    await fetch(`${base}/api/v1/webhooks/linkedin-conversion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Omitted when unset — SocialAuto accepts open ingest until
        // LINKEDIN_CONVERSION_INGEST_KEY is configured on its side.
        ...(key ? { "X-Conversion-Key": key } : {}),
      },
      body: JSON.stringify({
        event: input.event,
        email: input.email ?? null,
        value: input.value ?? null,
        currency: input.currency ?? null,
        event_id: input.eventId ?? null,
      }),
      // Never let a slow SocialAuto stall the user's success path.
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Additive analytics — swallow everything.
  }
}
