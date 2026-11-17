"use client";

import { useEffect } from "react";
import { useCookieConsent } from "@/context/CookieConsentContext";

const HOTJAR_SITE_ID = (process.env.NEXT_PUBLIC_HOTJAR_ID ?? "6507725").trim();
const HOTJAR_HJID = Number(HOTJAR_SITE_ID);

declare global {
  interface Window {
    hj?: ((...args: unknown[]) => void) & { q?: unknown[][] };
    _hjSettings?: { hjid: number; hjsv: number };
  }
}

/**
 * Hotjar — session recordings & heatmaps (site id 6507725).
 * Consent-gated on `preferences.analytics`: hj.js is only injected after the
 * visitor grants analytics consent, and withdrawal calls Hotjar's consent API
 * (`hj('consent', false)`) to pause collection. Mirrors ConsentGatedPixel.
 */
export default function HotjarAnalytics({ nonce }: { nonce?: string }) {
  const { preferences } = useCookieConsent();

  useEffect(() => {
    if (!Number.isInteger(HOTJAR_HJID) || HOTJAR_HJID <= 0) return;
    if (typeof window === "undefined") return;

    if (!preferences.analytics) {
      try {
        window.hj?.("consent", false);
      } catch {
        // hj stub may not exist yet — nothing to pause
      }
      return;
    }

    const w = window;
    if (!w.hj) {
      const hj: ((...args: unknown[]) => void) & { q?: unknown[][] } = (
        ...args: unknown[]
      ) => {
        (hj.q = hj.q || []).push(args);
      };
      w.hj = hj;
    }
    w._hjSettings = { hjid: HOTJAR_HJID, hjsv: 6 };

    if (!document.querySelector('script[src*="static.hotjar.com"]')) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://static.hotjar.com/c/hotjar-${HOTJAR_HJID}.js?sv=6`;
      if (nonce) script.setAttribute("nonce", nonce);
      document.head.appendChild(script);
    }

    try {
      w.hj("consent", true);
    } catch {
      // consent API is best-effort — collection already gated by injection
    }
  }, [preferences.analytics, nonce]);

  return null;
}
