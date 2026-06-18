"use client";

import { useEffect } from "react";
import { useCookieConsent } from "@/context/CookieConsentContext";

export default function ConsentGatedPixel({ pixelId, nonce }: { pixelId: string; nonce?: string }) {
  const { preferences } = useCookieConsent();

  useEffect(() => {
    if (!preferences.marketing) return;
    if (typeof window !== "undefined" && (window as { fbq?: unknown }).fbq) return;

    // Create the fbq stub that Meta's SDK expects to exist before loading.
    const w = window as unknown as {
      fbq?: (...args: unknown[]) => void;
      _fbq?: (...args: unknown[]) => void;
    };
    if (!w.fbq) {
      const q: unknown[][] = [];
      const fbq = (...args: unknown[]) => {
        q.push(args);
      };
      (fbq as unknown as { queue: unknown[][]; loaded: boolean; version: string }).queue = q;
      (fbq as unknown as { loaded: boolean }).loaded = true;
      (fbq as unknown as { version: string }).version = "2.0";
      w.fbq = w._fbq = fbq;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    if (nonce) script.setAttribute("nonce", nonce);
    script.onload = () => {
      if (w.fbq) {
        w.fbq("init", pixelId);
        w.fbq("track", "PageView");
      }
    };
    document.head.appendChild(script);
  }, [preferences.marketing, pixelId, nonce]);

  return null;
}
