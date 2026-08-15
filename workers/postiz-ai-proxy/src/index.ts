/**
 * postiz-ai-proxy — OpenAI-compatible proxy for two use cases:
 *
 *   1. Postiz caption generation (POST /v1/chat/completions, no thinking)
 *      Swaps Postiz's hardcoded "gpt-4.1" for NVIDIA_POSTIZ_MODEL.
 *
 *   2. Cloudless chatbot (POST /v1/chat/completions?thinking=1)
 *      Uses NVIDIA_MODEL (nemotron-3.5-lightning-30b-a3b) with extended
 *      thinking enabled. reasoning_content is stripped before returning
 *      so visitors never see the internal monologue.
 *
 * Other handled paths:
 *   POST /v1/images/generations — 501 (NVIDIA has no DALL-E equivalent)
 *   GET  /v1/models             — synthetic list so Postiz health checks pass
 *   *                           — 404
 *
 * NVIDIA key never touches k8s — it lives as a Worker secret.
 * PROXY_TOKEN is a shared secret callers send as their "API key"
 * so random internet callers can't consume NVIDIA credits.
 */

interface Env {
  NVIDIA_API_KEY: string;
  NVIDIA_BASE_URL: string;
  /** Chatbot model — nemotron-3.5-lightning-30b-a3b (with thinking) */
  NVIDIA_MODEL: string;
  /** Postiz caption model — llama-3.3-70b-instruct (no thinking) */
  NVIDIA_POSTIZ_MODEL: string;
  PROXY_TOKEN: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
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

/**
 * Strip reasoning_content from an OpenAI-compatible non-streaming response.
 * nemotron-3.5 returns both fields at the top level of message when thinking
 * is enabled; visitors should only see content.
 */
function stripReasoningContent(responseBody: unknown): unknown {
  if (
    typeof responseBody !== "object" ||
    responseBody === null ||
    !Array.isArray((responseBody as { choices?: unknown }).choices)
  ) {
    return responseBody;
  }
  const body = responseBody as {
    choices: Array<{
      message?: { reasoning_content?: unknown; content?: string };
    }>;
  };
  return {
    ...body,
    choices: body.choices.map((c) => {
      if (!c.message) return c;
      const { reasoning_content: _dropped, ...rest } = c.message;
      void _dropped;
      return { ...c, message: rest };
    }),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const path = url.pathname.replace(/^\/v1/, "");

    // GET /v1/models — synthetic list so Postiz startup checks pass
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
          {
            id: env.NVIDIA_POSTIZ_MODEL,
            object: "model",
            created: 1_700_000_000,
            owned_by: "nvidia",
          },
        ],
      });
    }

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

    if (request.method === "POST" && path === "/chat/completions") {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return json({ error: { message: "invalid_json", type: "invalid_request_error" } }, 400);
      }

      // ?thinking=1 → chatbot path: use nemotron with extended thinking
      const wantThinking = url.searchParams.get("thinking") === "1";

      if (wantThinking) {
        // Chatbot: nemotron-3.5-lightning with reasoning budget
        body.model = env.NVIDIA_MODEL;
        body.stream = false;
        body.extra_body = {
          chat_template_kwargs: { enable_thinking: true },
          reasoning_budget: 4096,
        };
      } else {
        // Postiz: swap hardcoded gpt-4.1 for the caption model (no thinking)
        body.model = env.NVIDIA_POSTIZ_MODEL;
      }

      const upstream = await fetch(`${env.NVIDIA_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!upstream.ok) {
        const errorText = await upstream.text();
        return new Response(errorText, {
          status: upstream.status,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      const responseBody = await upstream.json();

      const cleaned = wantThinking ? stripReasoningContent(responseBody) : responseBody;

      return new Response(JSON.stringify(cleaned), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return json({ error: { message: "not_found", type: "invalid_request_error" } }, 404);
  },
};
