#!/usr/bin/env node
/**
 * ollama-mcp — Web search + fetch + local Ollama bridge
 *
 * Provides free web search (DuckDuckGo), web content fetching, and
 * local Ollama inference as MCP tools. Replaces the paid web_search /
 * web_fetch system tools (which return 402).
 *
 * Tools exposed:
 *   search_web     — DuckDuckGo HTML search (no API key, no payment)
 *   read_url       — fetch a URL and extract readable text
 *   ollama_chat    — multi-turn chat with local Ollama model
 *   ollama_generate— single-shot completion via Ollama
 *   ollama_list_models — list pulled Ollama models
 *
 * Ollama must be running: `systemctl start ollama` or `ollama serve`
 * Ollama OpenAI-compat endpoint: http://localhost:11434/v1
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
  body?: unknown,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_BASE}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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

/** DuckDuckGo HTML search — no API key, no payment, no rate limits (for casual use). */
async function ddgSearch(query: string, maxResults = 10): Promise<string> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed: ${res.status}`);
  }

  const html = await res.text();

  // Parse result links — DuckDuckGo HTML results use class="result__a"
  const linkRegex = /<a\s[^>]*?class\s*=\s*["']result__a["'][^>]*?href\s*=\s*["']([^"']*)["'][^>]*?>([\s\S]*?)<\/a>/gi;
  const results: Array<{ title: string; url: string }> = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
    results.push({
      url: decodeURIComponent(match[1].replace(/.*\/\//, "").replace(/\/$/, "")),
      title: match[2].replace(/<\/?[^>]+(>|$)/g, "").trim(),
    });
  }

  if (!results.length) {
    return `No results found for "${query}". Try rephrasing or use read_url on a specific page.`;
  }

  const lines = results.map(
    (r, i) =>
      `${i + 1}. [${r.title}](${r.url})`,
  );
  return `## Search results for: ${query}\n\n${lines.join("\n")}`;
}

/** Fetch a URL and extract readable text (basic HTML tag stripping). */
async function fetchUrlText(url: string, maxChars = 8000): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  let text = await res.text();

  // Strip script/style blocks
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Extract title
  const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Extract meta description
  const descMatch = text.match(/<meta\b[^>]*?name\s*=\s*["']description["'][^>]*?content\s*=\s*["']([^"']*)["']/i);
  const description = descMatch ? descMatch[1].trim() : "";

  // Strip all HTML tags
  text = text.replace(/<\/?[^>]+(>|$)/g, " ");

  // Clean whitespace
  text = text.replace(/\s+/g, " ").trim();

  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + "... [truncated]";
  }

  let result = `## ${title || "(no title)"}\n\n`;
  if (description) result += `**${description}**\n\n`;
  result += text;

  return result;
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new McpServer({ name: "ollama-mcp", version: "1.0.0" });

// ── Tool: search_web ───────────────────────────────────────────────────────

server.tool(
  "search_web",
  `Search the web using DuckDuckGo (free, no API key required).
Returns top results with titles and URLs. Use read_url to then fetch article content.`,
  {
    query: z.string().describe("Search query"),
    max_results: z.number().int().min(1).max(20).optional().describe("Max results to return (default: 10)"),
  },
  async ({ query, max_results }) => {
    try {
      const text = await ddgSearch(query, max_results);
      return ok(text);
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Tool: read_url ─────────────────────────────────────────────────────────

server.tool(
  "read_url",
  `Fetch a URL and return readable text content (title, meta description, body text).
Strips HTML tags, scripts, and styles. Good for reading blog posts, docs, news articles.`,
  {
    url: z.string().url().describe("Full URL to fetch (e.g. https://example.com/article)"),
    max_chars: z.number().int().min(100).max(20000).optional().describe("Max characters to return (default: 8000)"),
  },
  async ({ url, max_chars }) => {
    try {
      const text = await fetchUrlText(url, max_chars);
      return ok(text);
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Tool: ollama_chat ──────────────────────────────────────────────────────

server.tool(
  "ollama_chat",
  `Send a multi-turn chat request to the local Ollama model (qwen2.5-coder by default).
Supports tool-calling. Use this for reasoning, code review, Q&A with context.`,
  {
    prompt: z.string().describe("User message to send"),
    model: z.string().optional().describe(`Model name (default: ${DEFAULT_MODEL})`),
    system: z.string().optional().describe("System prompt override"),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
      .optional()
      .describe("Prior conversation turns for context"),
    temperature: z.number().min(0).max(2).optional().describe("Sampling temperature (default: 0.1)"),
    max_tokens: z.number().int().min(1).max(32768).optional().describe("Max tokens (default: 4096)"),
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
Best for: code generation from a spec, summarisation, one-off transformations.`,
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
      const data = (await ollamaFetch("/api/tags")) as { models?: Array<{ name: string; size: number; details?: { parameter_size?: string; quantization_level?: string } }> };

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
      return ok(`Pulled ${model}\nStatus: ${lastStatus}\nDigest: ${digest || "n/a"}`);
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
