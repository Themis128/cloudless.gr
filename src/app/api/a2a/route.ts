import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { runWorkersAiChatLoop } from "@/lib/workers-ai-chat";
import { SYSTEM_PROMPT } from "@/app/api/chat/route";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface A2ATextPart {
  kind: string;
  text?: string;
}
interface A2AMessage {
  role?: string;
  parts?: A2ATextPart[];
  messageId?: string;
}

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

function extractText(message: A2AMessage | undefined): string {
  if (!message || !Array.isArray(message.parts)) return "";
  return message.parts
    .filter((p) => p.kind === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n")
    .trim();
}

// A2A v0.3 JSON-RPC adapter over the Cloudless chat agent (Workers AI loop).
// message/send returns a completed Message — no task persistence, so
// tasks/get, streaming, and push notifications are intentionally absent
// and advertised as unsupported in the agent card.
export async function POST(request: NextRequest) {
  const rl = rateLimit(`a2a:${getClientIp(request)}`, 10, 60_000);
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

  switch (body.method) {
    case "message/send": {
      const params = (body.params ?? {}) as { message?: A2AMessage; contextId?: string };
      const text = extractText(params.message).slice(0, 500);
      if (!text) return rpcError(body.id ?? null, -32602, "message.parts must contain a text part");
      try {
        const reply = await runWorkersAiChatLoop(SYSTEM_PROMPT, [{ role: "user", content: text }]);
        return rpcResult(body.id ?? null, {
          kind: "message",
          messageId: randomUUID(),
          role: "agent",
          parts: [{ kind: "text", text: reply }],
          contextId: params.contextId ?? randomUUID(),
        });
      } catch {
        return rpcError(body.id ?? null, -32000, "Agent unavailable");
      }
    }
    default:
      return rpcError(body.id ?? null, -32601, `Method not found: ${body.method}`);
  }
}
