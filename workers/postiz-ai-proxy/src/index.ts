/**
 * postiz-ai-proxy — OpenAI-compatible proxy for Postiz AI features.
 *
 * Postiz hardcodes "gpt-4.1" as the model name. This Worker replaces it
 * with NVIDIA_MODEL (meta/llama-3.3-70b-instruct) and forwards to NVIDIA's
 * OpenAI-compatible API. The NVIDIA key never touches k8s — it lives as a
 * Worker secret. Postiz sends PROXY_TOKEN as its "API key" so random callers
 * can't consume NVIDIA credits.
 *
 * Handled paths:
 *   POST /v1/chat/completions   — model swap + proxy to NVIDIA
 *   POST /v1/images/generations — 501 (NVIDIA has no DALL-E equivalent)
 *   GET  /v1/models             — synthetic list so Postiz health checks pass
 *   *                           — 404
 */

interface Env {
  NVIDIA_API_KEY: string;
  NVIDIA_BASE_URL: string;
  NVIDIA_MODEL: string;
  PROXY_TOKEN: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://postiz.cloudless.gr",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function unauthorized(): Response {
  return json({ error: { message: "invalid_api_key", type: "auth_error" } }, 401);
}

function verifyToken(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token === env.PROXY_TOKEN;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Strip /v1 prefix to get the path segment
    const path = url.pathname.replace(/^\/v1/, "");

    // GET /v1/models — synthetic response so Postiz startup checks don't fail
    if (request.method === "GET" && path === "/models") {
      return json({
        object: "list",
        data: [
          {
            id: env.NVIDIA_MODEL,
            object: "model",
            created: 1_700_000_000,
            owned_by: "nvidia",
          },
        ],
      });
    }

    // All write paths require auth
    if (!verifyToken(request, env)) {
      return unauthorized();
    }

    // POST /v1/images/generations — NVIDIA has no DALL-E; return 501
    if (request.method === "POST" && path === "/images/generations") {
      return json(
        {
          error: {
            message: "Image generation is not available via the NVIDIA proxy.",
            type: "not_implemented",
          },
        },
        501
      );
    }

    // POST /v1/chat/completions — swap model, forward to NVIDIA
    if (request.method === "POST" && path === "/chat/completions") {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return json({ error: { message: "invalid_json", type: "invalid_request_error" } }, 400);
      }

      // Always use the configured NVIDIA model regardless of what Postiz sent
      body.model = env.NVIDIA_MODEL;

      const upstream = await fetch(`${env.NVIDIA_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const responseBody = await upstream.text();
      return new Response(responseBody, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
          ...CORS_HEADERS,
        },
      });
    }

    return json({ error: { message: "not_found", type: "invalid_request_error" } }, 404);
  },
};
