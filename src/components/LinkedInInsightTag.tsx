/**
 * LinkedIn Insight Tag — conversion tracking foundation for LinkedIn Ads.
 *
 * Loads the official tag only when NEXT_PUBLIC_LINKEDIN_PARTNER_ID is set
 * (the partner ID lives in Campaign Manager → Analyze → Insight Tag). Until
 * then the component renders nothing, so the site ships dark-safe.
 *
 * Same CSP contract as GoogleTagManager: a plain nonce'd inline <script>
 * injects the external loader — script-src 'strict-dynamic' trusts it, and
 * connect-src already allows snap.licdn.com / px.ads.linkedin.com.
 */
const PARTNER_ID = (process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID ?? "").trim();

export function LinkedInInsightTag({ nonce }: { nonce?: string }) {
  if (!PARTNER_ID) return null;

  const scriptNonce = nonce?.trim() ? nonce : undefined;

  return (
    // eslint-disable-next-line @next/next/next-script-for-ga -- intentional; see file header
    <script
      id="linkedin-insight-tag"
      {...(scriptNonce ? { nonce: scriptNonce } : {})}
      dangerouslySetInnerHTML={{
        __html: `
_linkedin_partner_id = "${PARTNER_ID}";
window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
window._linkedin_data_partner_ids.push(_linkedin_partner_id);
(function(l) {
  if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
  window.lintrk.q=[]}
  var s = document.getElementsByTagName("script")[0];
  var b = document.createElement("script");
  b.type = "text/javascript";b.async = true;
  b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
  s.parentNode.insertBefore(b, s);
})(window.lintrk);
`,
      }}
    />
  );
}
