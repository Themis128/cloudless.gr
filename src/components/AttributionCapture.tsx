"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";
import { captureAttribution } from "@/lib/lead-attribution";

/**
 * Invisible client component that records first-touch attribution
 * (UTM params / external referrer / landing page) into sessionStorage.
 * Mounted once in the locale layout; re-runs on route changes so a
 * mid-session campaign link still gets captured if nothing was stored yet.
 */
export default function AttributionCapture() {
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution();
  }, [pathname]);

  return null;
}
