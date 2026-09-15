"use client";

import { useEffect, useRef } from "react";
import { fireCampaignConversion } from "@/lib/fire-campaign-conversion";

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

    fireCampaignConversion({
      campaign,
      tier,
      orderId,
      conversionId,
    });
  }, [conversionId, campaign, tier, orderId]);

  return null;
}
