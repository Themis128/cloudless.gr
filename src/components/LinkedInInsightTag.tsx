"use client";

import { useEffect } from "react";
import { useCookieConsent } from "@/context/CookieConsentContext";

/**
 * LinkedIn Insight Tag — consent-gated, CSP-nonce-safe.
 *
 * Mirrors the `ConsentGatedPixel` pattern: the LinkedIn loader is appended to
 * the DOM only after the user accepts marketing cookies, so the tag never
 * runs without consent. No inline <script> tags are used — the LinkedIn
 * library is loaded by URL (allowlisted in CSP script-src as snap.licdn.com).
 *
 * The Insight Tag fires PageView automatically on load. Conversion events are
 * triggered manually via `window.lintrk("track", { conversion_id: NNN })`
 * (see `src/lib/linkedin-track.ts`).
 *
 * Partner ID is exposed at build time via `NEXT_PUBLIC_LINKEDIN_PARTNER_ID`.
 * When unset the component renders nothing — useful for local dev and CI.
 */
export default function LinkedInInsightTag() {
  const { preferences } = useCookieConsent();

  useEffect(() => {
    if (!preferences.marketing) return;

    const partnerId = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
    if (!partnerId) return;

    type Lintrk = ((action: string, payload?: Record<string, unknown>) => void) & {
      q?: unknown[][];
    };
    type LinkedInWindow = Window & {
      _linkedin_data_partner_ids?: string[];
      _linkedin_partner_id?: string;
      lintrk?: Lintrk;
    };
    const w = window as LinkedInWindow;

    // Skip if loader is already present (HMR / second mount in dev).
    if (w.lintrk) return;

    w._linkedin_partner_id = partnerId;
    w._linkedin_data_partner_ids = w._linkedin_data_partner_ids ?? [];
    if (!w._linkedin_data_partner_ids.includes(partnerId)) {
      w._linkedin_data_partner_ids.push(partnerId);
    }

    // Stub lintrk() so calls before the script finishes loading are queued.
    const stub: Lintrk = ((...args: unknown[]) => {
      stub.q = stub.q ?? [];
      stub.q.push(args);
    }) as Lintrk;
    stub.q = [];
    w.lintrk = stub;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    document.head.appendChild(script);
  }, [preferences.marketing]);

  return null;
}
