import { NextRequest } from "next/server";
import { getAnthropicApiKey } from "@/lib/anthropic";
import { escapeHtml } from "@/lib/escape-html";

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

Keep answers concise (2–4 sentences max). If someone asks about pricing, give ranges and suggest booking a free audit. Never make up specific technical details not listed above. If you don't know something, say so and suggest they book a call.`;

const MAX_USER_MESSAGE = 500;
const MAX_TURNS = 10;
const MAX_TOKENS = 300;
const ANTHROPIC_TIMEOUT_MS = 15_000;
const ROLE_ASSISTANT = "assistant";
const SSE_DATA_PREFIX = "data: ";

const encoder = new TextEncoder();

function forwardSseLine(
  line: string,
  controller: ReadableStreamDefaultController,
): void {
  if (!line.startsWith(SSE_DATA_PREFIX)) return;
  const data = line.slice(SSE_DATA_PREFIX.length).trim();
  if (data === "" || data === "[DONE]") return;
  try {
    const parsed = JSON.parse(data) as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (
      parsed.type === "content_block_delta" &&
      parsed.delta?.type === "text_delta"
    ) {
      const text = escapeHtml(parsed.delta.text ?? "");
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
      );
      return;
    }
    if (parsed.type === "message_stop") {
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    }
  } catch {
    // skip malformed SSE lines
  }
}

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

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
        stream: true,
      }),
      signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[chat] anthropic fetch failed:", err);
    return Response.json({ error: "AI service unavailable." }, { status: 502 });
  }

  if (!anthropicRes.ok || !anthropicRes.body) {
    const status = anthropicRes.status;
    const detail = await anthropicRes.text().catch(() => "");
    console.error(`[chat] anthropic returned ${status}: ${detail.slice(0, 500)}`);
    return Response.json({ error: "AI service unavailable." }, { status: 502 });
  }

  const upstream = anthropicRes.body;

  // Buffer partial SSE lines across TCP chunks. `reader.read()` returns
  // whatever bytes are currently available, which can split a `data: ...`
  // line in two and lose tokens if we don't carry the tail to the next chunk.
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.length > 0) forwardSseLine(buffer, controller);
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          let newlineIdx = buffer.indexOf("\n");
          while (newlineIdx !== -1) {
            const line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            forwardSseLine(line, controller);
            newlineIdx = buffer.indexOf("\n");
          }
        }
      } catch (err) {
        console.error("[chat] stream relay failed:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering so SSE deltas reach the browser immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
