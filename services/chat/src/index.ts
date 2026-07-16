import { WorkerEntrypoint } from "cloudflare:workers";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import {
  BEDROCK_MODEL_ID,
  buildBedrockToolConfig,
  getBedrockClient,
  type AnyBlock,
  type BedrockMessage,
  type TextBlock,
  type ToolResultBlock,
  type ToolUseBlock,
} from "../../../src/lib/bedrock-shared";
import { CHAT_TOOLS, runTool } from "../../../src/lib/chat-tools";
import { rateLimit, getClientIp } from "../../../src/lib/rate-limit";
import { escapeHtml } from "../../../src/lib/escape-html";
import { slackChatNotify } from "../../../src/lib/slack-notify";
import { notifyTeam } from "../../../src/lib/email";

const SYSTEM_PROMPT = `You are Cloudless Assistant, a helpful pre-sales assistant for Cloudless.gr — a cloud computing, serverless architecture, and AI-powered digital marketing agency run by Themistoklis Baltzakis (AWS Certified Cloud Architect, 8+ years experience).

Services offered:
- Cloud Architecture & Migration (AWS, GCP, Azure) — from €2,000
- Serverless Starter Package (Lambda, API Gateway, CI/CD) — from €2,400
- Data Analytics & Dashboards (ETL, BI, real-time) — from €2,400
- AI Growth Engine — monthly retainer from €800/mo
- Digital products: playbooks, templates, courses

Key facts:
- Month-to-month contracts, no lock-in
- First results in 14 days
- Free 30-minute cloud audit for new prospects
- Serves startups and SMBs (2–20 person teams)
- Based in Greece, serves EU and international clients
- Contact: via the Contact page or book a free audit

You have three tools:
- lookup_product(query): search the storefront for a service or product. Use this when the visitor asks about a specific service, package, or pricing.
- check_calendar_availability(days_ahead?): look up open 30-minute consultation slots. Use this when the visitor asks to book or see availability.
- book_slot(name, email, start, end, notes?): confirm a booking. Call ONLY after the visitor has picked a specific slot from check_calendar_availability AND provided their name and email. Use start/end exactly as returned by check_calendar_availability.

Booking flow: (1) call check_calendar_availability → show slots → (2) ask visitor to pick one and share their name + email → (3) call book_slot → confirm with Meet link. Never invent slot times. Collect name and email before calling book_slot.

Use tools when their output would be more accurate than your memory (specific prices, real availability). Don't call a tool just to confirm what you already know. After a tool returns, summarize the result in plain language and include any URLs the tool gave you so the visitor can click through.

Keep answers concise (2–4 sentences max). If someone asks about pricing not surfaced by lookup_product, give the ranges from "Services offered" above and suggest booking a free audit. Never make up specific technical details. If you don't know something, say so and suggest they book a call.

Output format: respond with plain conversational text only. Do NOT include internal reasoning, <thinking> tags, XML markup, or any kind of monologue — only the message you want the visitor to read.`;

const MAX_USER_MESSAGE = 500;
const MAX_TURNS = 10;
const MAX_TOKENS = 600;
const MAX_TOOL_ITERATIONS = 4;
const WORKERS_AI_CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const encoder = new TextEncoder();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Bedrock models occasionally emit internal reasoning wrapped in
// <thinking>…</thinking> tags
const THINKING_TAG_RE = /<thinking>[\s\S]*?<\/thinking>\s*/gi;
function stripThinkingTags(text: string): string {
  return text.replace(THINKING_TAG_RE, "").trim();
}

function chunkText(text: string, size = 80): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function sseStreamFromText(text: string): ReadableStream<Uint8Array> {
  const safe = escapeHtml(text);
  return new ReadableStream({
    start(controller) {
      for (const piece of chunkText(safe)) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: piece })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// ChatEntrypoint - RPC-style service binding
// ---------------------------------------------------------------------------

export class ChatEntrypoint extends WorkerEntrypoint<Env> {
  // Access AI binding via this.env in WorkerEntrypoint context
  protected getAIBinding(): Ai | null {
    return this.env.AI ?? null;
  }

  async chat(
    messages: ChatMessage[],
    _headers?: Record<string, string>,
  ): Promise<{ response: string; model?: string }> {
    const clientIp = _headers ? getClientIp({ headers: { get: (k: string) => _headers[k.toLowerCase()] } } as Request) : undefined;
    if (clientIp) {
      const rl = rateLimit(`chat:${clientIp}`, 10, 60_000);
      if (!rl.ok) {
        throw new Error("Rate limit exceeded");
      }
    }

    const sanitizedMessages: ChatMessage[] = messages
      .slice(-MAX_TURNS)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content.slice(0, MAX_USER_MESSAGE).trim(),
      }))
      .filter((m) => m.content.length > 0);

    if (sanitizedMessages.length === 0) {
      throw new Error("No valid messages provided");
    }

    // Notify on first message
    const userMessages = sanitizedMessages.filter((m) => m.role === "user");
    if (userMessages.length === 1 && clientIp) {
      const msg = userMessages[0].content;
      slackChatNotify({ message: msg, ip: clientIp }).catch(() => {});
      notifyTeam("New Chat Conversation", `A visitor started a chat:\n\n"${msg.slice(0, 200)}"\n\nIP: ${clientIp}`).catch(() => {});
    }

    // Run chat loop
    const result = await this.runChatLoop(SYSTEM_PROMPT, sanitizedMessages);
    return { response: result };
  }

  async chatStream(
    messages: ChatMessage[],
    _headers?: Record<string, string>,
  ): Promise<ReadableStream<Uint8Array>> {
    const clientIp = _headers ? getClientIp({ headers: { get: (k: string) => _headers[k.toLowerCase()] } } as Request) : undefined;
    if (clientIp) {
      const rl = rateLimit(`chat:${clientIp}`, 10, 60_000);
      if (!rl.ok) {
        throw new Error("Rate limit exceeded");
      }
    }

    const sanitizedMessages: ChatMessage[] = messages
      .slice(-MAX_TURNS)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content.slice(0, MAX_USER_MESSAGE).trim(),
      }))
      .filter((m) => m.content.length > 0);

    if (sanitizedMessages.length === 0) {
      throw new Error("No valid messages provided");
    }

    const userMessages = sanitizedMessages.filter((m) => m.role === "user");
    if (userMessages.length === 1 && clientIp) {
      const msg = userMessages[0].content;
      slackChatNotify({ message: msg, ip: clientIp }).catch(() => {});
      notifyTeam("New Chat Conversation", `A visitor started a chat:\n\n"${msg.slice(0, 200)}"\n\nIP: ${clientIp}`).catch(() => {});
    }

    const result = await this.runChatLoop(SYSTEM_PROMPT, sanitizedMessages);
    return sseStreamFromText(result);
  }

  async healthCheck(): Promise<{ status: string; model: string }> {
    return { status: "ok", model: "nova-micro-v1" };
  }

  // Core chat loop with Workers AI fallback
  private async runChatLoop(
    systemPrompt: string,
    initialMessages: { role: "user" | "assistant"; content: string }[],
  ): Promise<string> {
    const ai = this.getAIBinding();
    const bedrockMessages: BedrockMessage[] = initialMessages.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    }));

    // Try Workers AI first (fast, free, no tool support yet)
    if (ai) {
      const workersAiMessages = bedrockMessages.map((m) => ({
        role: m.role,
        content: (m.content as TextBlock[])
          .filter((b): b is TextBlock => "text" in b && typeof b.text === "string")
          .map((b) => b.text)
          .join(""),
      }));

      try {
        const result = (await ai.run(WORKERS_AI_CHAT_MODEL, {
          messages: [{ role: "system", content: systemPrompt }, ...workersAiMessages],
        })) as { response?: string };
        if (result.response) return result.response;
      } catch (err) {
        console.warn("[chat] Workers AI chat failed, falling back to Bedrock:", err instanceof Error ? err.message : err);
      }
    }

    // Fall back to Bedrock Converse with tool-use loop
    const client = getBedrockClient();
    const messages: BedrockMessage[] = bedrockMessages;
    const BEDROCK_TOOL_CONFIG = buildBedrockToolConfig(CHAT_TOOLS);

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const cmd = new ConverseCommand({
        modelId: BEDROCK_MODEL_ID,
        system: [{ text: systemPrompt }],
        messages,
        toolConfig: BEDROCK_TOOL_CONFIG,
        inferenceConfig: { maxTokens: MAX_TOKENS },
      });

      const response = await client.send(cmd);
      const stopReason = response.stopReason;
      const assistantContent: AnyBlock[] = (response.output?.message?.content as AnyBlock[]) ?? [];

      if (stopReason !== "tool_use") {
        const joined = (assistantContent as TextBlock[])
          .filter((b) => typeof b.text === "string")
          .map((b) => b.text)
          .join("");
        return stripThinkingTags(joined);
      }

      messages.push({ role: "assistant", content: assistantContent });

      const toolUseBlocks = assistantContent.filter(
        (b): b is ToolUseBlock =>
          "toolUse" in b && typeof (b as ToolUseBlock).toolUse?.toolUseId === "string"
      );

      toolUseBlocks.forEach((b) => console.warn("[chat] tool_use", b.toolUse.name));

      const toolResults: ToolResultBlock[] = await Promise.all(
        toolUseBlocks.map(async (b) => {
          const result = await runTool(b.toolUse.name, b.toolUse.input);
          return {
            toolResult: {
              toolUseId: b.toolUse.toolUseId,
              content: [{ text: result }] as [{ text: string }],
            },
          };
        })
      );

      messages.push({ role: "user", content: toolResults });
    }

    console.warn("[chat] hit MAX_TOOL_ITERATIONS without a final response");
    return "I'm having trouble pulling that together right now. Could you share a bit more detail or use the Contact page to reach Themis directly?";
  }
}

interface Env {
  AI: Ai;
  SITE_BASE_URL: string;
}

// Default export for HTTP fetch compatibility (also useful for local dev)
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatStream(request, env);
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ status: "ok", worker: "cloudless-gr-chat" });
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
};

async function handleChatStream(request: Request, env: Env): Promise<Response> {
  const headers = Object.fromEntries(request.headers.entries());

  let messages: ChatMessage[];
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    if (!body.messages || !Array.isArray(body.messages)) {
      return Response.json({ error: "Invalid request: messages array required" }, { status: 400 });
    }
    messages = body.messages;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entrypoint = new ChatEntrypoint();
  (entrypoint as unknown as { env: Env }).env = env;

  try {
    const stream = await entrypoint.chatStream(messages, headers);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    return Response.json({ error: message }, { status: 500 });
  }
}