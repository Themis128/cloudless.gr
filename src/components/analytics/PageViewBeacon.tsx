"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { trackPageView, hasAnalyticsConsent } from "@/lib/funnel-client";
import { sendSocialAutoEvent } from "@/lib/socialauto-analytics";
import { trackClientEvent } from "@/lib/track-client-event";

/** Referrer host fragments that mark an AI-engine click-through. */
const AI_REFERRER_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "you.com",
  "phind.com",
  "kagi.com",
  "mistral.ai",
  "grok.x.ai",
  "x.com/i/grok",
];

function detectAiReferrer(): string | null {
  if (typeof document === "undefined") return null;
  const ref = document.referrer;
  if (!ref) return null;
  try {
    const host = new URL(ref).hostname.toLowerCase();
    return AI_REFERRER_HOSTS.find((h) => host.endsWith(h)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Sitewide page_view beacon — consent-gated (cookieConsent.analytics),
 * fires once per SPA navigation so D1 `analytics_events` feeds the
 * acquisition_funnel / attribution gold sections, and mirrors to the
 * SocialAuto web-events hub (socialauto-web-events → social_attribution).
 * Also fires a one-time `ai_referral` event when the session's referrer
 * is an AI engine — this is what makes zero-click AI visibility measurable.
 */
export default function PageViewBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  const aiChecked = useRef(false);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    trackPageView();
    if (hasAnalyticsConsent()) {
      sendSocialAutoEvent({
        event: "page_view",
        domain: "cloudless.gr",
        path: pathname,
        locale: document.documentElement.lang || undefined,
      }).catch(() => {});
      if (!aiChecked.current) {
        aiChecked.current = true;
        const source = detectAiReferrer();
        if (source) {
          trackClientEvent("ai_referral", { source, path: pathname });
        }
      }
    }
  }, [pathname]);

  return null;
}
