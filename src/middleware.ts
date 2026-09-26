/**
 * Next.js 15.x middleware entry point.
 *
 * Next.js 15 only recognises `middleware.ts` as the edge middleware file.
 * The actual logic lives in `src/proxy.ts` (the Next.js 16 canonical name).
 * This file re-exports it so the proxy runs under Next.js 15.5.x.
 *
 * When upgrading to Next.js 16, delete this file — `proxy.ts` is canonical
 * and Next.js 16 forbids both files coexisting.
 *
 * IMPORTANT: `config` must be defined HERE as a plain literal. Next's
 * static matcher analysis cannot resolve a re-exported config
 * (`export { config } from "@/proxy"`) nor a `String.raw` tagged template —
 * it silently falls back to `/:path*`, running the middleware on every
 * request including `/_next/image` and breaking the image optimizer.
 * Keep this string identical to `config.matcher` in `src/proxy.ts`.
 */
export { proxy as default } from "@/proxy";

export const config = {
  matcher: [
    "/((?!api/health|_next/static|_next/image|manifest\\.webmanifest|sw\\.js|offline\\.html|\\.well-known|[^?]+\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|map|woff|woff2|ttf|eot|otf|html)).*)",
  ],
};
