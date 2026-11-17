"use client";

import { useEffect, useRef } from "react";
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
 * visitor grants analytics consent. On withdrawal we call `hj('consent',
 * false)` and reload — Hotjar's recorder cannot be stopped once loaded, so a
 * reload is the only reliable way to end an active recording (the reloaded
 * page sees consent=false and never re-injects). Mirrors ConsentGatedPixel.
 */
export default function HotjarAnalytics({ nonce }: { nonce?: string }) {
  const { preferences } = useCookieConsent();
  const injectedRef = useRef(false);

  useEffect(() => {
    if (!Number.isInteger(HOTJAR_HJID) || HOTJAR_HJID <= 0) return;
    if (typeof window === "undefined") return;

    if (!preferences.analytics) {
      try {
        window.hj?.("consent", false);
      } catch {
        // hj stub may not exist yet — nothing to pause
      }
      if (injectedRef.current) {
        injectedRef.current = false;
        /* v8 ignore start -- jsdom cannot navigate; reload is browser-only */
        window.location.reload();
        /* v8 ignore stop */
      }
      return;
    }

    const w = window;
    if (!w.hj) {
      const hj: ((...args: unknown[]) => void) & { q?: unknown[][] } = (...args: unknown[]) => {
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
    injectedRef.current = true;

    try {
      w.hj("consent", true);
    } catch {
      // consent API is best-effort — collection already gated by injection
    }
  }, [preferences.analytics, nonce]);

  return null;
}
