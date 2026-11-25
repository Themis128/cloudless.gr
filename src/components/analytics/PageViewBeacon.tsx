"use client";

import { useCallback, useEffect, useRef } from "react";
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
    const url = new URL(ref);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    return (
      AI_REFERRER_HOSTS.find((h) => {
        const slash = h.indexOf("/");
        const hostPart = slash === -1 ? h : h.slice(0, slash);
        if (host !== hostPart && !host.endsWith(`.${hostPart}`)) return false;
        return slash === -1 || path.startsWith(h.slice(slash));
      }) ?? null
    );
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
  const pathRef = useRef<string | null>(null);

  // document.referrer persists for the whole session, so the referral is
  // still attributable when consent is granted after landing — even if the
  // user never navigates again.
  const fireAiReferral = useCallback(() => {
    if (aiChecked.current || !hasAnalyticsConsent()) return;
    aiChecked.current = true;
    const source = detectAiReferrer();
    if (source) {
      trackClientEvent("ai_referral", { source, path: pathRef.current });
    }
  }, []);

  useEffect(() => {
    pathRef.current = pathname;
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    trackPageView();
    fireAiReferral();
    if (hasAnalyticsConsent()) {
      sendSocialAutoEvent({
        event: "page_view",
        domain: "cloudless.gr",
        path: pathname,
        locale: document.documentElement.lang || undefined,
      }).catch(() => {});
    }
  }, [pathname, fireAiReferral]);

  useEffect(() => {
    if (aiChecked.current || hasAnalyticsConsent()) {
      fireAiReferral();
      return;
    }
    const timer = setInterval(() => {
      if (hasAnalyticsConsent()) {
        clearInterval(timer);
        fireAiReferral();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [fireAiReferral]);

  return null;
}
