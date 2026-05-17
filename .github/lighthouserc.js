// Chrome flags for GitHub Actions ubuntu-latest runners.
// Playwright Chromium (and system Chrome) both require --no-sandbox inside
// the GitHub runner environment; without it the browser silently hangs on
// startup and LHCI times out waiting for the DevTools connection.
module.exports = {
  ci: {
    collect: {
      settings: {
        chromeFlags: "--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage",
      },
    },
  },
};
