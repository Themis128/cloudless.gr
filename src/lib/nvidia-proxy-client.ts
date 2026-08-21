import { recordAdminAiCall } from "@/lib/admin-ai-usage";

export function isNvidiaProxyConfigured(): boolean {
  return Boolean(process.env.NVIDIA_PROXY_URL && process.env.NVIDIA_PROXY_TOKEN);
}

export async function callNvidiaProxyChat(
  messages: { role: string; content: string }[],
  opts?: { maxTokens?: number }
): Promise<string> {
  const proxyUrl = process.env.NVIDIA_PROXY_URL;
  const proxyToken = process.env.NVIDIA_PROXY_TOKEN;
  if (!proxyUrl || !proxyToken) {
    const err = new Error("NVIDIA proxy not configured");
    err.name = "UnauthorizedException";
    throw err;
  }

  const started = Date.now();
  try {
    const response = await fetch(`${proxyUrl}/chat/completions?thinking=1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${proxyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        max_tokens: opts?.maxTokens ?? 600,
        temperature: 0.6,
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      const err = new Error(`NVIDIA proxy HTTP ${response.status}: ${text.slice(0, 200)}`);
      err.name =
        response.status === 401 || response.status === 403 ? "UnauthorizedException" : "AiError";
      recordAdminAiCall({
        ok: false,
        model: "nvidia/nemotron-3.5-lightning-30b-a3b",
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
      model: "nvidia/nemotron-3.5-lightning-30b-a3b",
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
      model: "nvidia/nemotron-3.5-lightning-30b-a3b",
      viaGateway: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "NVIDIA proxy request failed",
    });
    throw err;
  }
}
