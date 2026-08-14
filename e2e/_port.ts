/**
 * Local Playwright uses 4010 so a normal `pnpm dev` on 4000 is left alone.
 * CI keeps 4000 (seed scripts and runners already assume it).
 * Override with E2E_PORT when needed.
 *
 * Host is `localhost` (not 127.0.0.1) so storageState cookies with
 * `domain: "localhost"` match the browser origin.
 */
export const E2E_PORT =
  process.env.E2E_PORT?.trim() || (process.env.CI ? "4000" : "4010");

export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;
