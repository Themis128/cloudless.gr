"use client";

import { useEffect } from "react";
import { useCookieConsent } from "@/context/CookieConsentContext";

/**
 * Standard Meta Pixel queue stub. Must exist on window before fbevents.js loads
 * to prevent "fbq is not defined" errors. This matches Meta's official snippet.
 */
function installFbqStub(): void {
  if (window.fbq) return;
  const queue: unknown[][] = [];
  const fbq = (...args: unknown[]) => {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      queue.push(args);
    }
  };
  fbq.queue = queue;
  fbq.callMethod = undefined as ((...a: unknown[]) => void) | undefined;
  window.fbq = fbq as unknown as typeof window.fbq;
}

export default function ConsentGatedPixel({ pixelId, nonce }: { pixelId: string; nonce?: string }) {
  const { preferences } = useCookieConsent();

  useEffect(() => {
    if (!preferences.marketing) return;
    if (typeof window === "undefined" || window.fbq) return;

    installFbqStub();

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js"; // NOSONAR: hardcoded trusted Meta SDK URL
    if (nonce) script.setAttribute("nonce", nonce);
    document.head.appendChild(script); // NOSONAR: intentional third-party pixel injection after consent

    window.fbq!("init", pixelId);
    window.fbq!("track", "PageView");
  }, [preferences.marketing, pixelId, nonce]);

  return null;
}
