import Script from "next/script";

/**
 * Swetrix CE — self-hosted, cookieless analytics (analytics.cloudless.gr).
 * Only renders when NEXT_PUBLIC_SWETRIX_PROJECT_ID is set.
 * No consent banner required (no cookies, no personal data sold).
 */
export default function SwetrixAnalytics({ nonce }: { nonce?: string }) {
  const projectId = process.env.NEXT_PUBLIC_SWETRIX_PROJECT_ID;
  if (!projectId) return null;

  return (
    <>
      <Script src="https://swetrix.org/swetrix.js" strategy="lazyOnload" {...(nonce ? { nonce } : {})} />
      <Script id="swetrix-init" strategy="lazyOnload" {...(nonce ? { nonce } : {})}>{`
        if (typeof swetrix === "undefined") return;
        swetrix.init(${JSON.stringify(projectId)}, {
          apiURL: "https://analytics.cloudless.gr/backend/v1/log",
        });
        swetrix.trackViews();
      `}</Script>
    </>
  );
}
