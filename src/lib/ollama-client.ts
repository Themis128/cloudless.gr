import { recordAdminAiCall } from "@/lib/admin-ai-usage";

export function isOllamaConfigured(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL);
}

export async function callOllamaChat(
  messages: { role: string; content: string }[],
  opts?: { maxTokens?: number }
): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL;
  if (!baseUrl) {
    const err = new Error("Ollama not configured");
    err.name = "UnauthorizedException";
    throw err;
  }
  const model = process.env.OLLAMA_MODEL || "qwen2.5-coder:latest";
  const started = Date.now();

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts?.maxTokens ?? 600,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      const err = new Error(`Ollama HTTP ${response.status}: ${text.slice(0, 200)}`);
      err.name = "AiError";
      recordAdminAiCall({
        ok: false,
        model,
        viaGateway: false,
        latencyMs: Date.now() - started,
        error: err.message,
      });
      throw err;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    recordAdminAiCall({
      ok: true,
      model,
      viaGateway: false,
      latencyMs: Date.now() - started,
    });
    return text || "Sorry — I could not generate a reply.";
  } catch (err) {
    if (err instanceof Error && (err.name === "UnauthorizedException" || err.name === "AiError")) {
      throw err;
    }
    recordAdminAiCall({
      ok: false,
      model,
      viaGateway: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Ollama request failed",
    });
    throw err;
  }
}
