"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { trackPageView } from "@/lib/funnel-client";

/**
 * Sitewide page_view beacon — consent-gated (cookieConsent.analytics),
 * fires once per SPA navigation so D1 `analytics_events` feeds the
 * acquisition_funnel / attribution gold sections.
 */
export default function PageViewBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    trackPageView();
  }, [pathname]);

  return null;
}
