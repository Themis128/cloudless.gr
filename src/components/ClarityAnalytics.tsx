"use client";

import { useEffect, useRef } from "react";
import { useCookieConsent } from "@/context/CookieConsentContext";

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
  }
}

/**
 * Microsoft Clarity — free session recordings & heatmaps.
 * Only active when NEXT_PUBLIC_CLARITY_PROJECT_ID is set.
 * Consent-gated on `preferences.analytics`: clarity.ms is only injected after
 * the visitor grants analytics consent. On withdrawal we call
 * `clarity('consent', false)` and reload — Clarity's recorder cannot be
 * stopped once loaded, so a reload is the only reliable way to end an active
 * recording (the reloaded page sees consent=false and never re-injects).
 * Mirrors ConsentGatedPixel / the retired HotjarAnalytics.
 */
export default function ClarityAnalytics({ nonce }: { nonce?: string }) {
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  const { preferences } = useCookieConsent();
  const injectedRef = useRef(false);

  useEffect(() => {
    if (!projectId) return;
    if (typeof window === "undefined") return;

    if (!preferences.analytics) {
      try {
        window.clarity?.("consent", false);
      } catch {
        // clarity stub may not exist yet — nothing to pause
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
    if (!w.clarity) {
      const clarity: ((...args: unknown[]) => void) & { q?: unknown[][] } = (
        ...args: unknown[]
      ) => {
        (clarity.q = clarity.q || []).push(args);
      };
      w.clarity = clarity;
    }

    if (!document.querySelector('script[src*="clarity.ms"]')) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.clarity.ms/tag/${projectId}`;
      if (nonce) script.setAttribute("nonce", nonce);
      document.head.appendChild(script);
    }
    injectedRef.current = true;

    try {
      w.clarity("consent", true);
    } catch {
      // consent API is best-effort — collection already gated by injection
    }
  }, [preferences.analytics, projectId, nonce]);

  return null;
}
