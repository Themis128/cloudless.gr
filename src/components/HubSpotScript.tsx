"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const HS_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ?? "";

// Only the real production hostnames. Anything else — localhost, preview
// deployments, the Pi standby's internal addresses — does NOT load HubSpot.
const PRODUCTION_HOSTS = new Set(["cloudless.gr", "www.cloudless.gr"]);

export function HubSpotScript({ nonce }: Readonly<{ nonce?: string }>) {
  // Mount-deferred to avoid React #418: useSyncExternalStore with
  // getServerSnapshot=false caused null→<Script> mismatch during hydration
  // because getSnapshot ran synchronously on the production hostname.
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (HS_PORTAL_ID.length > 0 && PRODUCTION_HOSTS.has(globalThis.location.hostname)) {
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
