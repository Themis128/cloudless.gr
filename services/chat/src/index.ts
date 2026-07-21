import { WorkerEntrypoint } from "cloudflare:workers";
import {
  GEMINI_MODEL_ID,
  generateGeminiResponse,
  isGeminiConfigured,
  getGeminiApiKey,
} from "../../../src/lib/gemini-shared";
import { CHAT_TOOLS } from "../../../src/lib/chat-tools";
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

const encoder = new TextEncoder();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

// Type for Gemini API messages
type GeminiMessage = {
  role: "user" | "model";
  content: string;
};

// ---------------------------------------------------------------------------
// ChatEntrypoint - RPC-style service binding
// ---------------------------------------------------------------------------

export class ChatAgent extends WorkerEntrypoint<Env> {
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

    const sanitizedMessages = messages
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

    // Try Workers AI first
    const ai = this.getAIBinding();
    if (ai) {
      try {
        const geminiMessages = sanitizedMessages.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          content: m.content,
        })) as GeminiMessage[];
        const result = await generateGeminiResponse(geminiMessages, MAX_TOKENS);
        return { response: result, model: GEMINI_MODEL_ID };
      } catch (err) {
        console.warn("[chat] Gemini failed, falling back:", err instanceof Error ? err.message : err);
      }
    }

    throw new Error("Gemini API key not configured");
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

    const sanitizedMessages = messages
      .slice(-MAX_TURNS)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content.slice(0, MAX_USER_MESSAGE).trim(),
      }))
      .filter((m) => m.content.length > 0);

    if (sanitizedMessages.length === 0) {
      throw new Error("No valid messages provided");
    }

    if (clientIp) {
      const msg = sanitizedMessages.find((m) => m.role === "user")?.content ?? "";
      slackChatNotify({ message: msg, ip: clientIp }).catch(() => {});
      notifyTeam("New Chat Conversation", `A visitor started a chat:\n\n"${msg.slice(0, 200)}"\n\nIP: ${clientIp}`).catch(() => {});
    }

    const geminiMessages = sanitizedMessages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      content: m.content,
    })) as GeminiMessage[];
    const result = await generateGeminiResponse(geminiMessages, MAX_TOKENS);
    return sseStreamFromText(result);
  }

  async healthCheck(): Promise<{ status: string; model: string }> {
    const configured = isGeminiConfigured();
    return { status: configured ? "ok" : "needs-gemini-key", model: GEMINI_MODEL_ID };
  }
}

interface Env {
  AI: Ai;
  SITE_BASE_URL: string;
}

// Default export for HTTP fetch compatibility
const chatWorker = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      const headers = Object.fromEntries(request.headers.entries());
      const body = (await request.json()) as { messages?: ChatMessage[] };
      if (!body.messages?.length) {
        return Response.json({ error: "Invalid request: messages array required" }, { status: 400 });
      }

      try {
        const geminiMessages = body.messages.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          content: m.content,
        })) as GeminiMessage[];
        const result = await generateGeminiResponse(geminiMessages, 600);
        return new Response(sseStreamFromText(result), {
          headers: { "Content-Type": "text/event-stream" },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Chat failed";
        return Response.json({ error: message }, { status: 500 });
      }
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ status: "ok", worker: "cloudless-gr-chat", model: GEMINI_MODEL_ID });
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
};

export default chatWorker;