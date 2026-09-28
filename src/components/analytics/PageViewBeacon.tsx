"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { trackPageView, hasAnalyticsConsent } from "@/lib/funnel-client";
import { sendSocialAutoEvent } from "@/lib/socialauto-analytics";

/**
 * Sitewide page_view beacon — consent-gated (cookieConsent.analytics),
 * fires once per SPA navigation so D1 `analytics_events` feeds the
 * acquisition_funnel / attribution gold sections, and mirrors to the
 * SocialAuto web-events hub (socialauto-web-events → social_attribution).
 */
export default function PageViewBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    trackPageView();
    if (hasAnalyticsConsent()) {
      sendSocialAutoEvent({
        event: "page_view",
        domain: "cloudless.gr",
        path: pathname,
        locale: document.documentElement.lang || undefined,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
