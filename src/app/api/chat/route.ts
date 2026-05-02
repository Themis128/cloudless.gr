import { NextRequest } from "next/server";
import { getAnthropicApiKey, getAnthropicChatModel } from "@/lib/anthropic";
import { escapeHtml } from "@/lib/escape-html";
import { CHAT_TOOLS, runTool } from "@/lib/chat-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

You have two tools:
- lookup_product(query): search the storefront for a service or product. Use this when the visitor asks about a specific service, package, or pricing.
- check_calendar_availability(days_ahead): look up open consultation slots. Use this when the visitor asks to book or see availability.

Use tools when their output would be more accurate than your memory (specific prices, real availability). Don't call a tool just to confirm what you already know. After a tool returns, summarize the result in plain language and include any URLs the tool gave you so the visitor can click through.

Keep answers concise (2–4 sentences max). If someone asks about pricing not surfaced by lookup_product, give the ranges from "Services offered" above and suggest booking a free audit. Never make up specific technical details. If you don't know something, say so and suggest they book a call.`;

const MAX_USER_MESSAGE = 500;
const MAX_TURNS = 10;
const MAX_TOKENS = 600;
const MAX_TOOL_ITERATIONS = 4;
const ANTHROPIC_TIMEOUT_MS = 20_000;
const ROLE_ASSISTANT = "assistant";

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Anthropic message-shape types — narrow versions of the SDK's Message type.
// We only model what we read.
// ---------------------------------------------------------------------------

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: unknown;
    };

type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};

interface AnthropicResponse {
  stop_reason?: string;
  content?: ContentBlock[];
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[] | ToolResultBlock[];
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

interface RawMessage {
  role: string;
  content: string;
}

function parseMessages(
  body: unknown,
): { role: "user" | "assistant"; content: string }[] {
  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { messages?: unknown }).messages)
  ) {
    throw new Error("INVALID_BODY");
  }

  const raw = (body as { messages: unknown[] }).messages;
  const result = raw
    .filter(
      (m): m is RawMessage =>
        typeof m === "object" &&
        m !== null &&
        "role" in m &&
        "content" in m &&
        typeof (m as RawMessage).content === "string",
    )
    .slice(-MAX_TURNS)
    .map((m): { role: "user" | "assistant"; content: string } => ({
      role: m.role === ROLE_ASSISTANT ? "assistant" : "user",
      content: m.content.slice(0, MAX_USER_MESSAGE).trim(),
    }))
    .filter((m) => m.content.length > 0);

  if (result.length === 0) throw new Error("INVALID_BODY");
  return result;
}

// ---------------------------------------------------------------------------
// Tool-use loop — non-streaming, calls Anthropic until stop_reason !== tool_use
// ---------------------------------------------------------------------------

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: ConversationMessage[],
): Promise<AnthropicResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: CHAT_TOOLS,
      messages,
    }),
    signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(
      `[chat] anthropic returned ${res.status}: ${detail.slice(0, 500)}`,
    );
    throw new Error(`ANTHROPIC_${res.status}`);
  }

  return (await res.json()) as AnthropicResponse;
}

async function executeToolBlocks(
  blocks: ContentBlock[],
): Promise<ToolResultBlock[]> {
  const toolUses = blocks.filter(
    (b): b is Extract<ContentBlock, { type: "tool_use" }> =>
      b.type === "tool_use",
  );
  return Promise.all(
    toolUses.map(async (b) => ({
      type: "tool_result" as const,
      tool_use_id: b.id,
      content: await runTool(b.name, b.input),
    })),
  );
}

function extractFinalText(blocks: ContentBlock[] | undefined): string {
  if (!blocks) return "";
  return blocks
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function runChatLoop(
  apiKey: string,
  model: string,
  initialMessages: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const messages: ConversationMessage[] = [...initialMessages];
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await callAnthropic(apiKey, model, messages);
    const blocks = response.content ?? [];

    if (response.stop_reason !== "tool_use") {
      return extractFinalText(blocks);
    }

    messages.push({ role: "assistant", content: blocks });
    const toolResults = await executeToolBlocks(blocks);
    messages.push({ role: "user", content: toolResults });
  }

  // Hit iteration cap without a final answer.
  console.warn("[chat] hit MAX_TOOL_ITERATIONS without a final response");
  return "I'm having trouble pulling that together right now. Could you share a bit more detail or use the Contact page to reach Themis directly?";
}

// ---------------------------------------------------------------------------
// SSE response helpers — match the existing client contract
// ---------------------------------------------------------------------------

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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: piece })}\n\n`),
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let messages: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await request.json();
    messages = parseMessages(body);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "Chat not available right now. Please use the Contact page." },
      { status: 503 },
    );
  }

  const model = await getAnthropicChatModel();

  let finalText: string;
  try {
    finalText = await runChatLoop(apiKey, model, messages);
  } catch (err) {
    console.error("[chat] tool-use loop failed:", err);
    return Response.json({ error: "AI service unavailable." }, { status: 502 });
  }

  return new Response(sseStreamFromText(finalText), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
