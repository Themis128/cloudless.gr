import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, bookConsultation } from "@/lib/cal-com";
import { isValidEmail } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { runWorkersAiChatLoop } from "@/lib/workers-ai-chat";
import { SYSTEM_PROMPT } from "@/app/api/chat/route";
import { slackBookingNotify } from "@/lib/slack-notify";
import { recordNotification } from "@/lib/admin-notifications";
import { invalidateConsultationCache } from "@/lib/content-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "cloudless-gr", title: "Cloudless.gr Agent Server", version: "1.0.0" };

const TOOLS = [
  {
    name: "check_availability",
    description:
      "Check available 30-minute consultation slots with Themistoklis Baltzakis at Cloudless.gr. Returns ISO start/end times.",
    inputSchema: {
      type: "object",
      properties: {
        days_ahead: { type: "integer", description: "Days ahead to search (1-30)", default: 7 },
      },
    },
  },
  {
    name: "book_consultation",
    description:
      "Book a 30-minute consultation slot. Requires a start/end pair returned by check_availability, plus the visitor's name and email.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Visitor full name" },
        email: { type: "string", description: "Visitor email address" },
        start: { type: "string", description: "Slot start (ISO 8601)" },
        end: { type: "string", description: "Slot end (ISO 8601)" },
        notes: { type: "string", description: "Optional booking notes" },
      },
      required: ["name", "email", "start", "end"],
    },
  },
  {
    name: "ask_cloudless_assistant",
    description:
      "Ask the Cloudless.gr assistant about services, pricing, or the free cloud audit. Returns a plain-text answer and can surface product/slot information.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The visitor's question (max 500 chars)" },
      },
      required: ["message"],
    },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 200 });
}

function toolText(text: string, isError = false) {
  return { content: [{ type: "text", text }], isError };
}

async function callTool(name: string, args: Record<string, unknown>, ip: string) {
  try {
    if (name === "check_availability") {
      const days = Math.max(1, Math.min(Number(args.days_ahead ?? 7) || 7, 30));
      const slots = await getAvailableSlots(days);
      return toolText(JSON.stringify({ slots }));
    }
    if (name === "book_consultation") {
      // Same booking-specific rate limit as POST /api/calendar/book.
      const rl = rateLimit(`calendar-book:${ip}`, 5, 10 * 60_000);
      if (!rl.ok) return toolText("Rate limit exceeded. Try later.", true);
      const asStr = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
      const vname = asStr(args.name);
      const email = asStr(args.email);
      const start = asStr(args.start);
      const end = asStr(args.end);
      const notes = args.notes == null ? undefined : asStr(args.notes);
      if (!vname || !email || !start || !end || !isValidEmail(email)) {
        return toolText("Missing or invalid name/email/start/end.", true);
      }
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (
        isNaN(startDate.getTime()) ||
        isNaN(endDate.getTime()) ||
        startDate < new Date() ||
        endDate <= startDate
      ) {
        return toolText("Invalid or past slot times.", true);
      }
      const result = await bookConsultation({ name: vname, email, start, end, notes });
      if (!result) return toolText("Failed to create booking.", true);
      // Same side effects as POST /api/calendar/book.
      invalidateConsultationCache();
      slackBookingNotify({ name: vname, email, start, notes }).catch(() => {});
      recordNotification({
        category: "booking",
        type: "success",
        title: `New consultation booked: ${vname}`,
        message: `${vname} (${email}) booked ${start}`,
        actor: email,
        route: "/api/mcp",
        metadata: { start, notes: notes ? notes.slice(0, 500) : null },
      });
      return toolText(JSON.stringify({ success: true, booking: result }));
    }
    if (name === "ask_cloudless_assistant") {
      const message = String(args.message ?? "")
        .slice(0, 500)
        .trim();
      if (!message) return toolText("Empty message.", true);
      const text = await runWorkersAiChatLoop(SYSTEM_PROMPT, [{ role: "user", content: message }]);
      return toolText(text);
    }
    return toolText(`Unknown tool: ${name}`, true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return toolText(`Tool error: ${msg.slice(0, 200)}`, true);
  }
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(`mcp:${getClientIp(request)}`, 30, 60_000);
  if (!rl.ok) return rl.response;

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  if (typeof body !== "object" || body === null) {
    return rpcError(null, -32600, "Invalid Request");
  }
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcError(body.id ?? null, -32600, "Invalid Request");
  }

  // Notifications carry no id — acknowledge and stop.
  if (body.id === undefined) {
    return new NextResponse(null, { status: 202 });
  }

  switch (body.method) {
    case "initialize":
      return rpcResult(body.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    case "ping":
      return rpcResult(body.id, {});
    case "tools/list":
      return rpcResult(body.id, { tools: TOOLS });
    case "tools/call": {
      const params = body.params ?? {};
      const name = typeof params.name === "string" ? params.name : "";
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      return rpcResult(body.id, await callTool(name, args, getClientIp(request)));
    }
    default:
      return rpcError(body.id, -32601, `Method not found: ${body.method}`);
  }
}

// MCP Streamable HTTP GET normally opens an SSE stream for server pushes.
// This server is stateless request/response — return the descriptor instead.
export async function GET() {
  return NextResponse.json({
    ...SERVER_INFO,
    transport: { type: "streamable-http", endpoint: "https://cloudless.gr/api/mcp" },
    capabilities: { tools: TOOLS.map((t) => t.name) },
  });
}
