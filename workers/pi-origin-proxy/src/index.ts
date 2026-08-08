/**
 * Free-tier origin proxy for cloudless.gr (Workers Free = 3 MiB gzip).
 *
 * Full OpenNext Next.js 16 bundles ~5.5 MiB gzip and cannot deploy on Free.
 * This Worker stays tiny and forwards all methods to the Pi via Tunnel
 * (pi-origin.cloudless.gr → k3s NodePort). App updates ship via deploy-pi.yml.
 *
 * Transient Tunnel / edge 502s are common on the Worker→Tunnel hop; idempotent
 * methods get one retry after a short delay before we surface 502 to clients.
 */
interface Env {
  PI_ORIGIN_HOST: string;
  PI_TIMEOUT_MS?: string;
}

export const REQUEST_HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cf-connecting-ip",
  "cf-ray",
  "cf-visitor",
]);

export const RESPONSE_HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

export const IDEMPOTENT = new Set(["GET", "HEAD", "OPTIONS"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

export function buildForwardHeaders(
  request: Request,
  url: URL,
  host: string,
  preserveUpgrade: boolean,
): Headers {
  const headers = new Headers();
  for (const [k, v] of request.headers) {
    const lower = k.toLowerCase();
    if (REQUEST_HOP_BY_HOP.has(lower)) {
      // Keep Upgrade + Connection for WebSocket handshakes.
      if (preserveUpgrade && (lower === "upgrade" || lower === "connection")) {
        headers.set(k, v);
      }
      continue;
    }
    headers.set(k, v);
  }
  headers.set("Host", host);
  headers.set("X-Forwarded-Host", url.host);
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) {
    const priorXff = request.headers.get("x-forwarded-for");
    headers.set("X-Forwarded-For", priorXff ? `${priorXff}, ${clientIp}` : clientIp);
    headers.set("X-Real-IP", clientIp);
  }
  return headers;
}

const CACHEABLE_STATIC_PREFIXES = ["/_next/static/", "/_next/image", "/icons/", "/images/"];
const CACHEABLE_STATIC_EXACT = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
]);
const CACHEABLE_STATIC_EXT =
  /\.(css|js|mjs|map|woff2?|ttf|eot|jpg|jpeg|png|webp|avif|gif|svg|ico|mp4|webm|txt|xml)$/i;

/**
 * Cache candidates: GET requests for static assets from anonymous clients.
 * Anything with a Cookie/Authorization header is treated as personalized
 * (we do not want to leak one user's data to another via the edge cache).
 * Query strings are part of the cache key, so /_next/image?url=... works.
 */
export function isCacheable(request: Request): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.has("cookie") || request.headers.has("authorization")) return false;
  const path = new URL(request.url).pathname;
  if (CACHEABLE_STATIC_EXACT.has(path)) return true;
  for (const prefix of CACHEABLE_STATIC_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return CACHEABLE_STATIC_EXT.test(path);
}

/**
 * Whether an upstream response is safe to store in the edge cache.
 * We only cache 200 OK, refuse anything with Set-Cookie (personalized),
 * and require an explicit non-negative Cache-Control max-age / s-maxage.
 * The absence of Cache-Control means the origin never opted in, so we skip.
 */
export function isResponseCacheable(response: Response): boolean {
  if (response.status !== 200) return false;
  if (response.headers.has("set-cookie")) return false;
  const cc = (response.headers.get("cache-control") || "").toLowerCase();
  if (!cc) return false;
  if (/\bno-store\b|\bno-cache\b|\bprivate\b/.test(cc)) return false;
  return /\bmax-age=\d+|\bs-maxage=\d+/.test(cc);
}

export function buildResponseHeaders(upstream: Response, url: URL, host: string): Headers {
  const out = new Headers();
  for (const [k, v] of upstream.headers) {
    if (!RESPONSE_HOP_BY_HOP.has(k.toLowerCase())) out.set(k, v);
  }

  // Rewrite Location headers on 3xx that point at the raw origin so the
  // browser stays on the proxy hostname instead of landing on pi-origin.
  if (upstream.status >= 300 && upstream.status < 400) {
    const loc = out.get("Location");
    if (loc) {
      try {
        const locUrl = new URL(loc, `https://${host}`);
        if (locUrl.host === host) {
          locUrl.protocol = url.protocol;
          locUrl.host = url.host;
          out.set("Location", locUrl.toString());
        }
      } catch {
        // leave malformed Location untouched
      }
    }
  }
  return out;
}

async function fetchUpstream(
  target: string,
  request: Request,
  headers: Headers,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
    signal,
  });
}

async function fetchWithTimeout(
  target: string,
  request: Request,
  headers: Headers,
  deadline: number,
): Promise<Response> {
  const remaining = Math.max(0, deadline - Date.now());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    return await fetchUpstream(target, request, headers, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function proxyWebSocket(
  target: string,
  request: Request,
  headers: Headers,
): Promise<Response> {
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    // No timeout / no retry: WS handshakes must not be retried.
  });
  // Cloudflare's Response accepts `webSocket` in the init when the upstream
  // returned a 101 with an attached socket. TS libs don't model it.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
    // deno-lint-ignore no-explicit-any
    webSocket: (upstream as unknown as { webSocket?: WebSocket }).webSocket,
  } as ResponseInit & { webSocket?: WebSocket });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const host = (env.PI_ORIGIN_HOST || "pi-origin.cloudless.gr").replace(/^https?:\/\//, "");
    const target = new URL(url.pathname + url.search, `https://${host}`);
    const targetStr = target.toString();

    if (isWebSocketUpgrade(request)) {
      const wsHeaders = buildForwardHeaders(request, url, host, true);
      try {
        return await proxyWebSocket(targetStr, request, wsHeaders);
      } catch (err) {
        console.error("pi-tunnel-proxy: websocket upgrade failed", err);
        return new Response("WebSocket origin unreachable", {
          status: 502,
          headers: {
            "x-served-by": "pi-tunnel-proxy-error",
            "content-type": "text/plain",
          },
        });
      }
    }

    // Edge cache lookup for static assets. Cache key uses the original URL so
    // apex + www share the same cached copy for identical paths (browsers
    // don't distinguish those hosts for _next/static anyway).
    const cache = caches.default;
    const cacheable = isCacheable(request);
    const cacheKey = cacheable ? new Request(request.url, { method: "GET" }) : null;
    if (cacheKey) {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const cached = new Response(hit.body, hit);
        cached.headers.set("x-served-by", "pi-tunnel-proxy-cache");
        return cached;
      }
    }

    const headers = buildForwardHeaders(request, url, host, false);

    const timeoutMs = Number.parseInt(env.PI_TIMEOUT_MS || "30000", 10);
    const deadline = Date.now() + (Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000);
    const idempotent = IDEMPOTENT.has(request.method.toUpperCase());

    try {
      let upstream: Response;
      try {
        upstream = await fetchWithTimeout(targetStr, request, headers, deadline);
      } catch (firstErr) {
        if (!idempotent || Date.now() >= deadline) throw firstErr;
        console.error("pi-tunnel-proxy: first attempt failed, retrying", firstErr);
        await sleep(200);
        upstream = await fetchWithTimeout(targetStr, request, headers, deadline);
      }

      // Tunnel flaps often return 502 HTML from Cloudflare on the pi-origin hop.
      if (idempotent && upstream.status === 502 && Date.now() < deadline) {
        await sleep(200);
        try {
          const retry = await fetchWithTimeout(targetStr, request, headers, deadline);
          if (retry.status < 500) upstream = retry;
        } catch (retryErr) {
          console.error("pi-tunnel-proxy: 502 retry failed", retryErr);
        }
      }

      const outHeaders = buildResponseHeaders(upstream, url, host);
      outHeaders.set("x-served-by", "pi-tunnel-proxy");
      if (upstream.status >= 500) {
        outHeaders.set("x-pi-origin-status", String(upstream.status));
      }
      const proxied = new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: outHeaders,
      });

      // Populate the edge cache from the same response we're about to return.
      // clone() must run BEFORE the response body is streamed to the client, so
      // do it here and hand the clone off via waitUntil so we don't block.
      if (cacheKey && isResponseCacheable(upstream)) {
        ctx.waitUntil(cache.put(cacheKey, proxied.clone()));
      }
      return proxied;
    } catch (err) {
      console.error("pi-tunnel-proxy: origin unreachable", err);
      return new Response("Pi origin unreachable", {
        status: 502,
        headers: {
          "x-served-by": "pi-tunnel-proxy-error",
          "content-type": "text/plain",
          "retry-after": "5",
        },
      });
    }
  },
} satisfies ExportedHandler<Env>;
