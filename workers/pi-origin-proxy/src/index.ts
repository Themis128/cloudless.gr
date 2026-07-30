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

const HOP_BY_HOP = new Set([
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

const IDEMPOTENT = new Set(["GET", "HEAD", "OPTIONS"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const host = (env.PI_ORIGIN_HOST || "pi-origin.cloudless.gr").replace(/^https?:\/\//, "");
    const target = new URL(url.pathname + url.search, `https://${host}`);

    const headers = new Headers();
    for (const [k, v] of request.headers) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v);
    }
    headers.set("Host", host);
    headers.set("X-Forwarded-Host", url.host);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

    const timeoutMs = Number.parseInt(env.PI_TIMEOUT_MS || "30000", 10);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const idempotent = IDEMPOTENT.has(request.method.toUpperCase());

    try {
      let upstream: Response;
      try {
        upstream = await fetchUpstream(target.toString(), request, headers, controller.signal);
      } catch (firstErr) {
        if (!idempotent || controller.signal.aborted) throw firstErr;
        await sleep(200);
        upstream = await fetchUpstream(target.toString(), request, headers, controller.signal);
      }

      // Tunnel flaps often return 502 HTML from Cloudflare on the pi-origin hop.
      if (idempotent && upstream.status === 502 && !controller.signal.aborted) {
        await sleep(200);
        try {
          const retry = await fetchUpstream(target.toString(), request, headers, controller.signal);
          if (retry.status < 500) upstream = retry;
        } catch {
          // keep original 502
        }
      }

      const out = new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers,
      });
      out.headers.set("x-served-by", "pi-tunnel-proxy");
      if (upstream.status >= 500) {
        out.headers.set("x-pi-origin-status", String(upstream.status));
      }
      return out;
    } catch {
      return new Response("Pi origin unreachable", {
        status: 502,
        headers: {
          "x-served-by": "pi-tunnel-proxy-error",
          "content-type": "text/plain",
          "retry-after": "5",
        },
      });
    } finally {
      clearTimeout(timer);
    }
  },
} satisfies ExportedHandler<Env>;
