#!/usr/bin/env node
/**
 * mcp-ollama-server  —  Amazon Q ↔ local Ollama bridge
 *
 * Exposes local Ollama inference as MCP tools so Amazon Q's agent
 * can delegate tasks to the locally-running model (qwen2.5-coder by default).
 *
 * Ollama must be running: `systemctl start ollama` or `ollama serve`
 * OpenAI-compat endpoint: http://localhost:11434/v1
 *
 * Tools exposed:
 *   ollama_chat          — multi-turn chat with tool-calling support
 *   ollama_generate      — single-shot completion (faster, no history)
 *   ollama_list_models   — list pulled models
 *   ollama_pull_model    — pull a model from the Ollama registry
 *   ollama_show_model    — show model metadata / system prompt / template
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Config ─────────────────────────────────────────────────────────────────

const OLLAMA_BASE = process.env.OLLAMA_URL ?? "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5-coder";
const DEFAULT_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT_MS ?? "120000", 10);

// ── Helpers ────────────────────────────────────────────────────────────────

function ok(text: string) {
  return { content: [{ type: "text" as const, text: text || "(empty response)" }] };
}
function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}

async function ollamaFetch(
  path: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function ollamaGet(path: string): Promise<unknown> {
  const res = await fetch(`${OLLAMA_BASE}${path}`);
  if (!res.ok) throw new Error(`Ollama GET ${path} → ${res.status}`);
  return res.json();
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new McpServer({ name: "mcp-ollama-server", version: "0.1.0" });

// ── Tool: ollama_chat ──────────────────────────────────────────────────────

server.tool(
  "ollama_chat",
  `Send a multi-turn chat request to the local Ollama model.
Supports tool-calling (the model must have the 'tools' capability — qwen2.5-coder does).
Use this when you want the local model to reason, write code, or answer questions.
Returns the assistant message content.`,
  {
    prompt: z.string().describe("User message to send"),
    model: z.string().optional().describe(`Model name (default: ${DEFAULT_MODEL})`),
    system: z.string().optional().describe("System prompt override"),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
      .optional()
      .describe("Prior conversation turns to include for context"),
    temperature: z.number().min(0).max(2).optional().describe("Sampling temperature (default: 0.1)"),
    max_tokens: z.number().int().min(1).max(32768).optional().describe("Max tokens to generate (default: 4096)"),
  },
  async ({ prompt, model, system, history, temperature, max_tokens }) => {
    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (system) messages.push({ role: "system", content: system });
      for (const h of history ?? []) messages.push(h);
      messages.push({ role: "user", content: prompt });

      const data = (await ollamaFetch("/v1/chat/completions", {
        model: model ?? DEFAULT_MODEL,
        messages,
        temperature: temperature ?? 0.1,
        max_tokens: max_tokens ?? 4096,
        stream: false,
      })) as { choices?: Array<{ message?: { content?: string } }> };

      const content = data?.choices?.[0]?.message?.content ?? "(no content)";
      return ok(content);
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Tool: ollama_generate ──────────────────────────────────────────────────

server.tool(
  "ollama_generate",
  `Single-shot text completion via Ollama (no chat history, faster).
Best for: code generation from a spec, summarisation, one-off transformations.
Returns the raw completion text.`,
  {
    prompt: z.string().describe("Prompt text"),
    model: z.string().optional().describe(`Model name (default: ${DEFAULT_MODEL})`),
    system: z.string().optional().describe("System prompt"),
    temperature: z.number().min(0).max(2).optional().describe("Sampling temperature (default: 0.1)"),
    max_tokens: z.number().int().min(1).max(32768).optional().describe("Max tokens (default: 4096)"),
  },
  async ({ prompt, model, system, temperature, max_tokens }) => {
    try {
      const data = (await ollamaFetch("/api/generate", {
        model: model ?? DEFAULT_MODEL,
        prompt,
        system: system ?? "",
        options: {
          temperature: temperature ?? 0.1,
          num_predict: max_tokens ?? 4096,
        },
        stream: false,
      })) as { response?: string };

      return ok(data?.response ?? "(no response)");
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Tool: ollama_list_models ───────────────────────────────────────────────

server.tool(
  "ollama_list_models",
  "List all models currently pulled in the local Ollama instance.",
  {},
  async () => {
    try {
      const data = (await ollamaGet("/api/tags")) as {
        models?: Array<{ name: string; size: number; details?: { parameter_size?: string; quantization_level?: string } }>;
      };
      const models = data?.models ?? [];
      if (!models.length) return ok("No models pulled yet. Use ollama_pull_model to pull one.");
      const lines = models.map((m) => {
        const gb = (m.size / 1024 ** 3).toFixed(1);
        const params = m.details?.parameter_size ?? "?";
        const quant = m.details?.quantization_level ?? "?";
        return `• ${m.name}  (${params}, ${quant}, ${gb} GB)`;
      });
      return ok(`## Local Ollama models\n\n${lines.join("\n")}`);
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Tool: ollama_pull_model ────────────────────────────────────────────────

server.tool(
  "ollama_pull_model",
  `Pull a model from the Ollama registry (ollama.com/library).
This streams progress server-side; the tool waits for completion and returns a summary.
Common models: qwen2.5-coder, llama3.1, mistral, codellama, deepseek-coder-v2`,
  {
    model: z.string().describe("Model name, e.g. qwen2.5-coder or llama3.1:8b"),
  },
  async ({ model }) => {
    try {
      // Ollama pull streams NDJSON — consume until done/error
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 600_000); // 10 min for large models
      let lastStatus = "";
      let digest = "";
      try {
        const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, stream: true }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`Pull request failed: ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line) as { status?: string; digest?: string; error?: string };
              if (obj.error) throw new Error(obj.error);
              if (obj.status) lastStatus = obj.status;
              if (obj.digest) digest = obj.digest;
            } catch {
              // ignore parse errors on partial lines
            }
          }
        }
      } finally {
        clearTimeout(timer);
      }
      return ok(`✅ Pulled **${model}**\nStatus: ${lastStatus}\nDigest: ${digest || "n/a"}`);
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Tool: ollama_show_model ────────────────────────────────────────────────

server.tool(
  "ollama_show_model",
  "Show metadata, system prompt, and template for a pulled Ollama model.",
  {
    model: z.string().optional().describe(`Model name (default: ${DEFAULT_MODEL})`),
  },
  async ({ model }) => {
    try {
      const data = (await ollamaFetch("/api/show", { model: model ?? DEFAULT_MODEL }, 15_000)) as {
        modelfile?: string;
        parameters?: string;
        template?: string;
        details?: Record<string, unknown>;
      };
      const parts: string[] = [];
      if (data.details) parts.push(`## Details\n\`\`\`json\n${JSON.stringify(data.details, null, 2)}\n\`\`\``);
      if (data.parameters) parts.push(`## Parameters\n\`\`\`\n${data.parameters}\n\`\`\``);
      if (data.template) parts.push(`## Template\n\`\`\`\n${data.template}\n\`\`\``);
      return ok(parts.join("\n\n") || "(no metadata)");
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
