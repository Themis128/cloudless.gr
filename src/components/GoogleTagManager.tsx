import Script from "next/script";

/**
 * Google Tag Manager (container + Consent Mode default).
 * Paste targets from GTM install: head script + body noscript.
 * Consent defaults to denied; CookieConsent updates via gtag("consent","update").
 */
const GTM_ID = (process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-W7N3J3TV").trim();

export function GoogleTagManagerHead({ nonce }: { nonce?: string }) {
  if (!GTM_ID) return null;

  return (
    <Script
      id="google-tag-manager"
      strategy="beforeInteractive"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: `
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{
  analytics_storage:'denied',
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  wait_for_update:500
});
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');
`,
      }}
    />
  );
}

export function GoogleTagManagerNoscript() {
  if (!GTM_ID) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height={0}
        width={0}
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
