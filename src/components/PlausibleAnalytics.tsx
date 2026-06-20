import Script from "next/script";

/**
 * Plausible Analytics — privacy-first, cookie-free.
 * Only renders when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set.
 * No consent banner required.
 */
export default function PlausibleAnalytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
