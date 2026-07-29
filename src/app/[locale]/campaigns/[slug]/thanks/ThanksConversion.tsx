"use client";

import { useEffect, useRef } from "react";
import { trackLinkedInConversion } from "@/lib/linkedin-track";
import { getStoredAttribution } from "@/lib/lead-attribution";

/**
 * Dual-fires the LinkedIn conversion exactly once:
 *   1. Browser: window.lintrk("track", { conversion_id })
 *   2. Server:  POST /api/campaigns/conversion → LinkedIn CAPI mirror
 *
 * LinkedIn dedupes the two arrivals by eventId (= the Stripe order ID), so
 * the customer is counted once even if both paths succeed. Reload-safe via
 * the React 18 strict-mode-aware ref guard.
 */
export default function ThanksConversion({
  conversionId,
  campaign,
  tier,
  orderId,
}: {
  conversionId: number | null;
  campaign: string;
  tier: string | null;
  orderId: string | null;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    if (conversionId != null) {
      trackLinkedInConversion(conversionId);
    }

    const attribution = getStoredAttribution();
    const liFatId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("li_fat_id")
        : null;
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
        campaign,
        tier,
        orderId,
        liFatId,
        conversionId,
        url: typeof window !== "undefined" ? window.location.href : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        utm,
      }),
    }).catch(() => {
      // CAPI is purely additive — the browser-side Insight Tag fire above
      // already counts the conversion. Server outages are silent.
    });
  }, [conversionId, campaign, tier, orderId]);

  return null;
}
