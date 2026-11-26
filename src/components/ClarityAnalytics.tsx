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
 * the visitor grants analytics consent, and grant granularity is forwarded
 * via `clarity('consentv2', { ad_Storage, analytics_Storage })` so a denied
 * marketing choice is never reported as granted.
 *
 * The effect is gated on `hasConsented` (consent cookie actually read), not
 * just on render: the provider exposes denied defaults before hydrating the
 * cookie, so acting earlier would end an active Clarity session on every
 * locale-switch remount.
 *
 * On withdrawal we send consentv2 (both denied) and reload — Clarity's
 * recorder cannot be stopped once loaded, so a reload is the only reliable
 * way to end an active recording (the reloaded page sees consent=false and
 * never re-injects). Mirrors ConsentGatedPixel / the retired HotjarAnalytics.
 */
export default function ClarityAnalytics({ nonce }: { nonce?: string }) {
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  const { preferences, hasConsented } = useCookieConsent();
  const injectedRef = useRef(false);

  useEffect(() => {
    if (!projectId) return;
    if (typeof window === "undefined") return;
    if (!hasConsented) return;

    if (!preferences.analytics) {
      const wasInjected =
        injectedRef.current || !!document.querySelector('script[src*="clarity.ms"]');
      try {
        window.clarity?.("consentv2", {
          ad_Storage: "denied",
          analytics_Storage: "denied",
        });
      } catch {
        // clarity stub may not exist yet — nothing to pause
      }
      if (wasInjected) {
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
      w.clarity("consentv2", {
        ad_Storage: preferences.marketing ? "granted" : "denied",
        analytics_Storage: "granted",
      });
    } catch {
      // consent API is best-effort — collection already gated by injection
    }
  }, [hasConsented, preferences.analytics, preferences.marketing, projectId, nonce]);

  return null;
}
