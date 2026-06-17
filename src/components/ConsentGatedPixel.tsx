"use client";

import { useEffect } from "react";
import { useCookieConsent } from "@/context/CookieConsentContext";

export default function ConsentGatedPixel({ pixelId, nonce }: { pixelId: string; nonce?: string }) {
  const { preferences } = useCookieConsent();

  useEffect(() => {
    if (!preferences.marketing) return;
    if (typeof window !== "undefined" && (window as { fbq?: unknown }).fbq) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    if (nonce) script.setAttribute("nonce", nonce);
    script.onload = () => {
      const w = window as { fbq?: (...a: unknown[]) => void };
      if (w.fbq) {
        w.fbq("init", pixelId);
        w.fbq("track", "PageView");
      }
    };
    document.head.appendChild(script);
  }, [preferences.marketing, pixelId, nonce]);

  return null;
}
