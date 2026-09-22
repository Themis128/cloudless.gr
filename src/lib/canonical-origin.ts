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
  // Strip ALL trailing slashes so a misconfigured `NEXT_PUBLIC_SITE_URL`
  // like `https://cloudless.gr///` (trailing-slash gauntlet from sloppy env
  // copy-paste) still produces a canonical origin without trailing slashes.
  return url.replace(/\/+$/, "");
}

/** True when a forwarded-host header points at a private/internal origin we
 *  should NOT echo back to the browser. */
function isPrivateOriginHost(host: string): boolean {
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return false;
  // Strip port (and IPv6 brackets) before classification
  const bare = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0];
  if (isInternalHostname(bare)) return true;
  return false;
}

/** True when `nextUrl.origin` resolved to a listen-bind or CDN leak
 *  rather than the canonical apex. */
function isProdLeakedOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    )
      return false;
    return isInternalHostname(hostname);
  } catch {
    return false;
  }
}

/** True for hostnames that can never be a public origin: k8s pod names
 *  (single-label, e.g. `cloudless-app-6dc5885cd6-hvlrg`), private/loopback
 *  IPs, `.internal`/`.local` suffixes, CDN edge hosts, and wildcard binds. */
function isInternalHostname(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "0.0.0.0" || h === "::" || h === "") return true;
  if (
    h.endsWith(".cloudfront.net") ||
    h.endsWith(".internal") ||
    h.endsWith(".local") ||
    h.endsWith(".svc")
  )
    return true;
  // Bare single-label host (k8s pod name, container hostname) — public
  // origins always contain at least one dot.
  if (!h.includes(".")) return true;
  // Private / link-local IPv4 literals
  if (
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  )
    return true;
  return false;
}
