import { NextRequest } from "next/server";
import { getAnthropicApiKey } from "@/lib/anthropic";
import { escapeHtml } from "@/lib/escape-html";

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
const ROLE_ASSISTANT = "assistant";

function forwardSseLine(
  line: string,
  controller: ReadableStreamDefaultController,
): void {
  if (!line.startsWith("data: ")) return;
  const data = line.slice(6).trim();
  if (data === "[DONE]") return;
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
        new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`),
      );
    }
    if (parsed.type === "message_stop") {
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
    }
  } catch {
    // skip malformed SSE lines
  }
}

export async function POST(request: NextRequest) {
  let messages: { role: "user" | "assistant"; content: string }[]; // NOSONAR — type annotation
  try {
    const body = await request.json();
    if (!Array.isArray(body.messages)) throw new Error("messages required");
    messages = body.messages
      .filter(
        (m: unknown): m is { role: string; content: string } =>
          typeof m === "object" && m !== null && "role" in m && "content" in m,
      )
      .slice(-10) // keep last 10 turns for context
      .map((m: { role: string; content: string }) => ({
        role: m.role === ROLE_ASSISTANT ? ROLE_ASSISTANT : "user",
        content: String(m.content).slice(0, MAX_USER_MESSAGE),
      }));
    if (messages.length === 0) throw new Error("No valid messages");
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid request" },
      { status: 400 },
    );
  }

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "Chat not available right now. Please use the Contact page." },
      { status: 503 },
    );
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages,
      stream: true,
    }),
  });

  if (!anthropicRes.ok || !anthropicRes.body) {
    return Response.json({ error: "AI service unavailable." }, { status: 502 });
  }

  // Forward the SSE stream directly to the client
  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body!.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            forwardSseLine(line, controller);
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
