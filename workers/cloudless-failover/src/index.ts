/**
 * cloudless-failover — Cloudflare Worker
 *
 * Traffic flow:
 *   User → Cloudflare (proxied CNAME) → this Worker
 *     → Try AWS first (CloudFront → Lambda — primary)
 *       → If AWS returns < 400: serve response (x-served-by: aws-primary)
 *       → If AWS returns >= 400 OR timeout: fall through to Pi
 *     → Pi standby (pi-origin.cloudless.gr via Cloudflare Tunnel)
 *       → x-served-by: pi-standby
 *
 * IMPORTANT: Failover applies to ALL HTTP methods (GET, POST, PUT, DELETE, etc.)
 * The request body is buffered and replayed on retry.
 */

interface Env {
  AWS_FALLBACK_HOST: string;
  PI_ORIGIN_HOST: string;
  PI_TIMEOUT_MS: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Clone the request so the body can be consumed twice (AWS attempt + Pi retry).
    const requestBody = hasBody(request.method) ? await request.arrayBuffer() : null;

    // --- Attempt 1: AWS CloudFront (primary) ---
    const awsResponse = await fetchOrigin(request, url, env.AWS_FALLBACK_HOST, requestBody, 30000);

    if (awsResponse && awsResponse.status < 400) {
      return tagResponse(awsResponse, "aws-primary");
    }

    // --- Attempt 2: Pi standby ---
    const piTimeout = parseInt(env.PI_TIMEOUT_MS || "10000", 10);
    const piResponse = await fetchOrigin(request, url, env.PI_ORIGIN_HOST, requestBody, piTimeout);

    if (piResponse && piResponse.status < 400) {
      return tagResponse(piResponse, "pi-standby");
    }

    // If AWS returned a valid error response (4xx/5xx), serve it rather than
    // a generic 503 — the client gets the real error (auth, validation, etc.)
    if (awsResponse) {
      return tagResponse(awsResponse, "aws-primary");
    }
    if (piResponse) {
      return tagResponse(piResponse, "pi-standby");
    }

    // Both origins unreachable
    return new Response("Service unavailable — both origins failed", {
      status: 503,
      headers: { "x-served-by": "cloudless-failover-error" },
    });
  },
} satisfies ExportedHandler<Env>;

/** HTTP methods that carry a request body. */
function hasBody(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH";
}

/**
 * Forward the original request to a target origin host.
 * Returns the Response on success, or null on timeout/network error.
 */
async function fetchOrigin(
  originalRequest: Request,
  url: URL,
  targetHost: string,
  body: ArrayBuffer | null,
  timeoutMs: number
): Promise<Response | null> {
  const targetUrl = new URL(url.pathname + url.search, `https://${targetHost}`);

  // Build headers: forward all original headers, override Host
  const headers = new Headers(originalRequest.headers);
  headers.set("Host", targetHost);
  // Pass the original host so the origin can generate correct URLs
  headers.set("X-Forwarded-Host", url.host);

  const init: RequestInit = {
    method: originalRequest.method,
    headers,
    redirect: "manual", // Don't follow redirects — pass them through
  };

  if (body !== null) {
    init.body = body;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  init.signal = controller.signal;

  try {
    const response = await fetch(targetUrl.toString(), init);
    clearTimeout(timer);
    return response;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Clone response and add the x-served-by header. */
function tagResponse(response: Response, servedBy: string): Response {
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  newResponse.headers.set("x-served-by", servedBy);
  return newResponse;
}
