"use client";

import { useEffect, useRef } from "react";
import { trackLinkedInConversion } from "@/lib/linkedin-track";

/**
 * Fires the LinkedIn Insight Tag conversion event exactly once, then posts to
 * `/api/campaigns/conversion` so the same event can be sent server-side via
 * the Conversions API (CAPI). LinkedIn deduplicates events that arrive via
 * both channels, so dual-firing is the recommended pattern — see
 * `docs/linkedin-campaigns.md`.
 *
 * The component renders nothing. The duplicate-fire guard uses a ref so a
 * React 18 strict-mode double mount in dev does not double-count.
 */
export default function ThanksConversion({
  conversionId,
  tier,
  orderId,
}: {
  conversionId: number | null;
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

    // Server-side CAPI ping. Failures are silent — the client-side Insight
    // Tag conversion above is enough on its own; CAPI is purely additive.
    fetch("/api/campaigns/conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign: "shop-online",
        tier,
        orderId,
        conversionId,
        // Browser-side fields LinkedIn CAPI accepts as hints.
        url: typeof window !== "undefined" ? window.location.href : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      }),
    }).catch(() => {});
  }, [conversionId, tier, orderId]);

  return null;
}
