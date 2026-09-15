/**
 * Client-side dual-fire for campaign conversions (Insight Tag + CAPI mirror).
 *
 * Used by the thanks page, TierTable inline lead form, and contact form when
 * a campaign query param is present. Keeps lintrk + POST body shape in one
 * place so the three paths cannot drift.
 */

import { trackLinkedInConversion } from "@/lib/linkedin-track";
import { getStoredAttribution } from "@/lib/lead-attribution";

export type FireCampaignConversionInput = {
  campaign: string;
  tier?: string | null;
  orderId?: string | null;
  conversionId?: number | null;
  customer?: { name?: string; email?: string; phone?: string };
};

/**
 * Fire-and-forget. Safe when Insight Tag is absent (no consent / no partner
 * ID) — lintrk no-ops and the server CAPI mirror still runs.
 */
export function fireCampaignConversion(input: FireCampaignConversionInput): void {
  if (typeof window === "undefined") return;

  if (input.conversionId != null) {
    trackLinkedInConversion(input.conversionId);
  }

  const attribution = getStoredAttribution();
  const liFatId = new URLSearchParams(window.location.search).get("li_fat_id");
  const utm = attribution
    ? {
        source: attribution.utmSource,
        medium: attribution.utmMedium,
        campaign: attribution.utmCampaign,
        content: attribution.utmContent,
        term: attribution.utmTerm,
      }
    : null;

  fetch("/api/campaigns/conversion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campaign: input.campaign,
      tier: input.tier ?? null,
      orderId: input.orderId ?? null,
      conversionId: input.conversionId ?? null,
      customer: input.customer,
      liFatId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      utm,
    }),
  }).catch(() => {
    // CAPI / CRM mirror is additive — never block the UI on failure.
  });
}
