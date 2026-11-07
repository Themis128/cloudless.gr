/**
 * Local Playwright uses 4010 so a normal `pnpm dev` on 4000 is left alone.
 * CI keeps 4000 (seed scripts and runners already assume it).
 * Override with E2E_PORT when needed.
 *
 * Host is 127.0.0.1 (not `localhost`) so Node/Playwright do not prefer IPv6
 * `::1` while Next is bound on IPv4 only.
 */
export const E2E_PORT =
  process.env.E2E_PORT?.trim() || (process.env.CI ? "4000" : "4010");

export const E2E_HOST = "127.0.0.1";

export const E2E_ORIGIN = `http://${E2E_HOST}:${E2E_PORT}`;
