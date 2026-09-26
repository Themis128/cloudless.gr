/**
 * postiz-ai-proxy — OpenAI-compatible proxy for two use cases:
 *
 *   1. Postiz AI (POST /v1/chat/completions — captions, copilot, content gen)
 *      Swaps Postiz's hardcoded "gpt-4.1" for NVIDIA_POSTIZ_MODEL.
 *      Supports both streaming (SSE passthrough) and non-streaming.
 *
 *   2. Cloudless chatbot (POST /v1/chat/completions?thinking=1)
 *      Uses NVIDIA_MODEL with extended thinking. Forces non-streaming so
 *      reasoning_content can be stripped before returning.
 *
 * Other handled paths:
 *   POST /v1/images/generations — proxied to Pollinations.ai (free Flux)
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
  /** Chatbot model — nemotron-3-super-120b-a12b (with thinking) */
  NVIDIA_MODEL: string;
  /** Postiz caption model — nemotron-3-super-120b-a12b (no thinking) */
  NVIDIA_POSTIZ_MODEL: string;
  PROXY_TOKEN: string;
  /** Optional Pollinations API key for higher rate limits (free tier works without) */
  POLLINATIONS_API_KEY?: string;
  /** Image model for Pollinations (default: flux) */
  POLLINATIONS_IMAGE_MODEL?: string;
}

const CORS_HEADERS: Record<string, string> = {
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
 * Strip reasoning_content from a non-streaming response.
 * NVIDIA models return both reasoning_content and content; callers
 * should only see content.
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

/**
 * Transform an SSE stream to strip reasoning_content from delta chunks.
 * Each SSE line `data: {...}` may contain `choices[].delta.reasoning_content`.
 */
function stripReasoningFromStream(readable: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      const reader = readable.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.length > 0) {
              controller.enqueue(encoder.encode(buffer));
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const chunk = JSON.parse(line.slice(6));
                if (chunk.choices) {
                  for (const c of chunk.choices) {
                    if (c.delta) {
                      delete c.delta.reasoning_content;
                    }
                  }
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n`));
                continue;
              } catch {
                // not valid JSON — pass through as-is
              }
            }
            controller.enqueue(encoder.encode(line + "\n"));
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * Base64-encode bytes without the O(n²) string-concat loop — a multi-MB
 * image encoded char-by-char exceeds the free CPU limit and throws an
 * uncaught exception (shows up as scriptThrewException).
 */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      // Nothing may escape as an unhandled exception — the watchdog counts
      // scriptThrewException, so always fail as a JSON 500 instead.
      console.error("unhandled fetch error:", err);
      return json({
        error: {
          message: `internal_error: ${err instanceof Error ? err.message : String(err)}`,
          type: "server_error",
        },
      }, 500);
    }
  },
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
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

    // POST /v1/images/generations — proxy to Pollinations.ai free URL endpoint
    if (request.method === "POST" && path === "/images/generations") {
      let imgBody: Record<string, unknown>;
      try {
        imgBody = (await request.json()) as Record<string, unknown>;
      } catch {
        return json({ error: { message: "invalid_json", type: "invalid_request_error" } }, 400);
      }

      const prompt = String(imgBody.prompt ?? "");
      if (!prompt) {
        return json({ error: { message: "prompt is required", type: "invalid_request_error" } }, 400);
      }

      const sizeStr = String(imgBody.size ?? "1024x1024");
      const [w, h] = sizeStr.split("x").map(Number);
      const width = w && w > 0 ? Math.min(w, 1280) : 1024;
      const height = h && h > 0 ? Math.min(h, 1280) : 1024;
      const model = env.POLLINATIONS_IMAGE_MODEL ?? "flux";
      const seed = Math.floor(Math.random() * 2_147_483_647);

      const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
        `?width=${width}&height=${height}&model=${model}&nologo=true&seed=${seed}`;

      let imgBytes: Uint8Array;
      try {
        const imgResp = await fetch(imgUrl);
        if (!imgResp.ok) {
          return json({
            error: { message: `Image generation failed: ${imgResp.status}`, type: "server_error" },
          }, 502);
        }
        imgBytes = new Uint8Array(await imgResp.arrayBuffer());
      } catch (err) {
        return json({
          error: {
            message: `Image upstream unreachable: ${err instanceof Error ? err.message : String(err)}`,
            type: "server_error",
          },
        }, 502);
      }
      const b64 = bytesToBase64(imgBytes);

      return json({
        created: Math.floor(Date.now() / 1000),
        data: [{ b64_json: b64, revised_prompt: prompt }],
      });
    }

    if (request.method === "POST" && path === "/chat/completions") {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return json({ error: { message: "invalid_json", type: "invalid_request_error" } }, 400);
      }

      const wantThinking = url.searchParams.get("thinking") === "1";
      const wantStream = body.stream === true;

      if (wantThinking) {
        body.model = env.NVIDIA_MODEL;
        body.stream = false;
        body.reasoning_budget = 4096;
      } else {
        body.model = env.NVIDIA_POSTIZ_MODEL;
      }

      let upstream: Response;
      try {
        upstream = await fetch(`${env.NVIDIA_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        return json({
          error: {
            message: `Upstream unreachable: ${err instanceof Error ? err.message : String(err)}`,
            type: "server_error",
          },
        }, 502);
      }

      if (!upstream.ok) {
        const errorText = await upstream.text();
        return new Response(errorText, {
          status: upstream.status,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      // Streaming: pass the SSE stream through, stripping reasoning_content
      if (wantStream && !wantThinking && upstream.body) {
        const cleaned = stripReasoningFromStream(upstream.body);
        return new Response(cleaned, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            ...CORS_HEADERS,
          },
        });
      }

      // Non-streaming: parse, strip reasoning_content, return
      let responseBody: unknown;
      try {
        responseBody = await upstream.json();
      } catch {
        return json({
          error: { message: "Upstream returned invalid JSON", type: "server_error" },
        }, 502);
      }
      const cleaned = stripReasoningContent(responseBody);

      return new Response(JSON.stringify(cleaned), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    return json({ error: { message: "not_found", type: "invalid_request_error" } }, 404);
}
