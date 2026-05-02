"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";

const HS_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ?? "";

// Only the real production hostnames. Anything else — localhost, preview
// deployments, the Pi standby's internal addresses — does NOT load HubSpot.
// This eliminates the entire HubSpot+Typekit dependency chain in dev/preview,
// so home networks running ad-blockers (Pi-hole etc.) don't show
// ERR_NAME_NOT_RESOLVED for p.typekit.net, which HubSpot's loader otherwise
// pulls in.
const PRODUCTION_HOSTS = new Set(["cloudless.gr", "www.cloudless.gr"]);

// useSyncExternalStore is the hydration-safe way to read browser-only state:
// SSR + first client render both return getServerSnapshot() (false), so the
// initial DOM matches; after hydration React swaps in getSnapshot() (true on
// production hostnames). No setState-in-effect, no cascading renders, no
// hydration mismatch.
const subscribe = (): (() => void) => () => undefined;
const getSnapshot = (): boolean =>
  HS_PORTAL_ID.length > 0 && PRODUCTION_HOSTS.has(window.location.hostname);
const getServerSnapshot = (): boolean => false;

export function HubSpotScript() {
  const shouldLoad = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!shouldLoad) return null;
  return (
    <Script
      id="hs-script-loader"
      src={`https://js-eu1.hs-scripts.com/${HS_PORTAL_ID}.js`}
      strategy="afterInteractive"
    />
  );
}
