// Chrome flags for GitHub Actions / self-hosted runners.
// Playwright Chromium (and system Chrome) both require --no-sandbox inside
// containerized/CI environments; without it the browser silently hangs on
// startup and LHCI times out waiting for the DevTools connection.
//
// Block Cloudflare challenge-platform scripts — they inject deprecations +
// Permissions-Policy violations that tank Best Practices (~79) even when
// Bot Fight Mode is off (managed JS detection / cdn-cgi/challenge-platform).
//
// X-Forwarded-Proto: https — Pi NodePort audits hit the app over plain HTTP.
// src/proxy.ts 308-redirects when forwarded-proto is http (Next injects it),
// rewriting the host to HOSTNAME=0.0.0.0. The Tunnel always sends https.
module.exports = {
  ci: {
    collect: {
      settings: {
        chromeFlags: "--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage",
        extraHeaders: JSON.stringify({
          "X-Forwarded-Proto": "https",
        }),
        blockedUrlPatterns: [
          "*cdn-cgi/challenge-platform*",
          "*cdn-cgi/challenge-platform/*",
          "*challenges.cloudflare.com*",
        ],
      },
    },
  },
};
