/**
 * LinkedIn Insight Tag — mount once in app/layout.tsx, below <body>.
 *
 * Env:
 *   NEXT_PUBLIC_LINKEDIN_PARTNER_ID   numeric ID from Campaign Manager
 *
 * Reference:
 *   https://www.linkedin.com/help/lms/answer/a420537
 */
"use client";

import Script from "next/script";

export function LinkedInInsightTag() {
  const partnerId = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
  if (!partnerId) {
    // Don't render in dev / preview without the env var set.
    return null;
  }

  return (
    <>
      <Script
        id="linkedin-insight-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            _linkedin_partner_id = "${partnerId}";
            window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
            window._linkedin_data_partner_ids.push(_linkedin_partner_id);
          `,
        }}
      />
      <Script
        id="linkedin-insight-loader"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(l) {
              if (!l) {
                window.lintrk = function(a, b) { window.lintrk.q.push([a, b]); };
                window.lintrk.q = [];
              }
              var s = document.getElementsByTagName("script")[0];
              var b = document.createElement("script");
              b.type = "text/javascript"; b.async = true;
              b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
              s.parentNode.insertBefore(b, s);
            })(window.lintrk);
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://px.ads.linkedin.com/collect/?pid=${partnerId}&fmt=gif`}
        />
      </noscript>
    </>
  );
}

/**
 * Fire a custom conversion server-side or client-side.
 * Use when you need to attribute a non-pageload conversion to LinkedIn.
 *
 * Example: lintrkConversion(1234567);
 */
export function lintrkConversion(conversionId: number) {
  const w = window as Window & {
    lintrk?: (action: string, opts: { conversion_id: number }) => void;
  };
  if (typeof window !== "undefined" && w.lintrk) {
    w.lintrk("track", { conversion_id: conversionId });
  }
}
