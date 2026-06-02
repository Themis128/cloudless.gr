"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const HS_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ?? "";

// Only the real production hostnames. Anything else — localhost, preview
// deployments, the Pi standby's internal addresses — does NOT load HubSpot.
const PRODUCTION_HOSTS = new Set(["cloudless.gr", "www.cloudless.gr"]);

export function HubSpotScript({ nonce }: Readonly<{ nonce?: string }>) {
  // Mount-deferred: SSR and the initial hydration pass both render null.
  // Reading globalThis.location during a lazy useState initializer runs during
  // SSR (server: undefined) AND during client hydration (browser: real hostname),
  // which produces a server/client mismatch and triggers React error #418.
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (HS_PORTAL_ID.length > 0 && PRODUCTION_HOSTS.has(globalThis.location.hostname)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldLoad(true);
    }
  }, []);

  if (!shouldLoad) return null;
  return (
    <Script
      id="hs-script-loader"
      src={`https://js-eu1.hs-scripts.com/${HS_PORTAL_ID}.js`}
      strategy="afterInteractive"
      nonce={nonce}
    />
  );
}
