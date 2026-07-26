/**
 * Stub for next-intl/middleware used in Vitest.
 *
 * next-intl v4's real middleware module tries to import `next/server` via
 * ESM bare specifiers, which Vitest/JSDOM cannot resolve. Tests that import
 * src/proxy.ts only need the `config` export (the matcher pattern), so we
 * provide a no-op middleware factory here.
 */
export default function createIntlMiddleware(_routing) {
  return function intlMiddleware(_request) {
    return null;
  };
}
