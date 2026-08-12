"use client";

import { useEffect } from "react";
import { useCookieConsent } from "@/context/CookieConsentContext";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag: (...args: any[]) => void;
    dataLayer: unknown[];
  }
}

/**
 * Syncs cookie consent preferences → GA4 Consent Mode v2.
 * Must be mounted inside <CookieConsentProvider>.
 * The gtag scripts in layout.tsx initialize consent as 'denied' by default;
 * this component updates consent whenever the user saves their preferences.
 */
export default function GoogleAnalyticsConsent() {
  const { preferences } = useCookieConsent();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      // Official gtag stub — must push the Arguments object, not a rest array.
      window.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
      };
    }
    window.gtag("consent", "update", {
      analytics_storage: preferences.analytics ? "granted" : "denied",
      ad_storage: preferences.marketing ? "granted" : "denied",
      ad_user_data: preferences.marketing ? "granted" : "denied",
      ad_personalization: preferences.marketing ? "granted" : "denied",
    });
  }, [preferences.analytics, preferences.marketing]);

  return null;
}
