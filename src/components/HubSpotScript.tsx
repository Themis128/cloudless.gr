"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const HS_PORTAL_ID = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ?? "";

// Only the real production hostnames. Anything else — localhost, preview
// deployments, the Pi standby — does NOT load HubSpot. This eliminates the
// entire HubSpot+Typekit dependency chain in dev/preview, so home networks
// running ad-blockers (Pi-hole etc.) don't show ERR_NAME_NOT_RESOLVED for
// p.typekit.net, which HubSpot's loader would otherwise pull in.
const PRODUCTION_HOSTS = new Set(["cloudless.gr", "www.cloudless.gr"]);

export function HubSpotScript() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (HS_PORTAL_ID.length === 0) return;
    if (PRODUCTION_HOSTS.has(window.location.hostname)) {
      setShouldLoad(true);
    }
  }, []);

  if (!shouldLoad) return null;

  return (
    <Script
      id="hs-script-loader"
      src={`https://js-eu1.hs-scripts.com/${HS_PORTAL_ID}.js`}
      strategy="afterInteractive"
    />
  );
}
