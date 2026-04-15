/**
 * Next.js middleware entry point.
 *
 * Delegates to src/proxy.ts which handles:
 *   - Rate limiting on public POST routes
 *   - CORS headers (production + localhost dev)
 *   - Security headers (HSTS, X-Frame-Options, etc.)
 *   - next-intl locale routing for page routes
 */
export { proxy as middleware, config } from "@/proxy";
