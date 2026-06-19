/**
 * Canonical origin resolver for redirects and absolute URLs.
 *
 * Why: `NextRequest.nextUrl.origin` returns whatever Host header the Lambda /
 * Pi pod sees — which on the production stack is the CloudFront subdomain
 * (`d3k7muo3c6lw6s.cloudfront.net`), NOT the Cloudflare-fronted apex
 * `cloudless.gr`. That made `/api/checkout` 302 the visitor's browser to a
 * CloudFront URL that then renders correctly but lives at the wrong host —
 * users see `d3k7muo3c6lw6s.cloudfront.net` in their address bar instead of
 * `cloudless.gr`. PR #989 wired the funnel-data part of `/api/checkout`; this
 * helper closes the URL-bar leak.
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_SITE_URL` (env / build arg). Already used elsewhere in
 *      the codebase (see `[locale]/layout.tsx` BASE_URL constant). Single
 *      source of truth across the app.
 *   2. `x-forwarded-host` header — what SST and proxy environments set when
 *      they want the inner route to construct correct absolute URLs.
 *   3. `request.nextUrl.origin` — the existing (buggy in prod, correct in
 *      dev) fallback. Keeps localhost workflows working.
 *
 * Always returns a string with a scheme but no trailing slash, so callers
 * can `${canonical}${pathname}${search}` without re-thinking the join.
 */

import { NextRequest } from "next/server";

const HARDCODED_FALLBACK = "https://cloudless.gr";

export function canonicalOrigin(request: NextRequest): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost && !isPrivateOriginHost(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // In dev `nextUrl.origin` resolves to `http://localhost:3000` which is
  // what we want for local workflows. In prod it's the CloudFront URL — the
  // condition below routes that to the hardcoded apex instead.
  const requestOrigin = request.nextUrl.origin;
  if (isProdLeakedOrigin(requestOrigin)) {
    return HARDCODED_FALLBACK;
  }
  return trimTrailingSlash(requestOrigin);
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/** True when a forwarded-host header points at a private/internal origin we
 *  should NOT echo back to the browser. */
function isPrivateOriginHost(host: string): boolean {
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return false;
  if (host.endsWith(".cloudfront.net")) return true;
  if (host.endsWith(".internal")) return true;
  return false;
}

/** True when `nextUrl.origin` resolved to the prod-leaked CloudFront origin
 *  rather than the canonical apex. */
function isProdLeakedOrigin(origin: string): boolean {
  return origin.includes(".cloudfront.net");
}
