export const dynamic = "force-dynamic";

/* Baked in at build time so it's available in Lambda (unlike npm_package_version). */
const APP_VERSION = globalThis.process?.env.APP_VERSION ?? "0.1.0";

export async function GET() {
  const headers = new Headers({
    "cache-control": "no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Permissions-Policy": [
      "accelerometer=()",
      "autoplay=(self)",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "hid=()",
      "idle-detection=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=(self)",
      "picture-in-picture=()",
      "publickey-credentials-get=(self)",
      "screen-wake-lock=()",
      "serial=()",
      "usb=()",
      "web-share=(self)",
      "xr-spatial-tracking=()",
    ].join(", "),
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.com https://connect.facebook.net https://browser.sentry-cdn.com https://js.hsforms.net https://js.hs-scripts.com https://js-eu1.hs-scripts.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://p.typekit.net",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com https://use.typekit.net",
      "connect-src 'self' ws: wss: http://localhost:* http://172.* https://api.stripe.com https://m.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://www.facebook.com https://auth.cloudless.gr https://api.hubapi.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://www.facebook.com",
      "worker-src 'self' blob:",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://www.facebook.com https://connect.facebook.net",
      "frame-ancestors 'none'",
      "report-uri /api/csp-report",
      "report-to csp-endpoint",
    ].join("; "),
    "Report-To": JSON.stringify({
      group: "csp-endpoint",
      max_age: 86400,
      endpoints: [{ url: "/api/csp-report" }],
      include_subdomains: true,
    }),
  });

  return globalThis.Response.json(
    { status: "ok", timestamp: new Date().toISOString(), version: APP_VERSION },
    { headers }
  );
}
