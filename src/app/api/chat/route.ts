import { NextRequest } from "next/server";
import { escapeHtml } from "@/lib/escape-html";
import { runWorkersAiChatLoop } from "@/lib/workers-ai-chat";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { slackChatNotify } from "@/lib/slack-notify";
import { notifyTeam } from "@/lib/email";

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

You have three tools:
- lookup_product(query): search the storefront for a service or product. Use this when the visitor asks about a specific service, package, or pricing.
- check_calendar_availability(days_ahead?): look up open 30-minute consultation slots. Use this when the visitor asks to book or see availability.
- book_slot(name, email, start, end, notes?): confirm a booking. Call ONLY after the visitor has picked a specific slot from check_calendar_availability AND provided their name and email. Use start/end exactly as returned by check_calendar_availability.

Booking flow: (1) call check_calendar_availability → show slots → (2) ask visitor to pick one and share their name + email → (3) call book_slot → confirm with Meet link. Never invent slot times. Collect name and email before calling book_slot.

When check_calendar_availability returns slots, you MUST output the markdown table exactly as given — with columns # | Day | Time (Athens). Never convert slots to a bullet list or prose. One intro sentence → the table → ask which row and for name + email.

Use tools when their output would be more accurate than your memory (specific prices, real availability). Don't call a tool just to confirm what you already know. After a tool returns, summarize the result in plain language and include any URLs the tool gave you so the visitor can click through.

Keep answers concise (2–4 sentences max, plus a slot table when booking). If someone asks about pricing not surfaced by lookup_product, give the ranges from "Services offered" above and suggest booking a free audit. Never make up specific technical details. If you don't know something, say so and suggest they book a call.

Output format: respond with plain conversational text only (markdown tables allowed for availability). Do NOT include internal reasoning, <thinking> tags, XML markup, or any kind of monologue — only the message you want the visitor to read.`;

const MAX_USER_MESSAGE = 500;
const MAX_TURNS = 10;

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

interface RawMessage {
  role: string;
  content: string;
}

function parseMessages(body: unknown): { role: "user" | "assistant"; content: string }[] {
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
        typeof (m as RawMessage).content === "string"
    )
    .slice(-MAX_TURNS)
    .map((m): { role: "user" | "assistant"; content: string } => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content.slice(0, MAX_USER_MESSAGE).trim(),
    }))
    .filter((m) => m.content.length > 0);

  if (result.length === 0) throw new Error("INVALID_BODY");
  return result;
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
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: piece })}\n\n`));
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
  const rl = rateLimit(`chat:${getClientIp(request)}`, 10, 60_000);
  if (!rl.ok) return rl.response;

  let messages: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await request.json();
    messages = parseMessages(body);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Notify on first message of a conversation (only 1 user message = new chat)
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 1) {
    const ip = getClientIp(request);
    const msg = userMessages[0].content;
    slackChatNotify({ message: msg, ip }).catch(() => {});
    notifyTeam(
      "New Chat Conversation",
      `A visitor started a chat:\n\n"${msg.slice(0, 200)}"\n\nIP: ${ip}`
    ).catch(() => {});
  }

  let finalText: string;
  try {
    finalText = await runWorkersAiChatLoop(SYSTEM_PROMPT, messages);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    // Log name + message only — never the full error object.
    console.error(
      "[chat] workers-ai loop failed:",
      name,
      err instanceof Error ? err.message : String(err)
    );
    // Access/auth errors → config issue on our side; surface as 503.
    // Transient errors → 502.
    if (name === "AccessDeniedException" || name === "UnauthorizedException") {
      return Response.json(
        { error: "Chat not available right now. Please use the Contact page." },
        { status: 503 }
      );
    }
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
