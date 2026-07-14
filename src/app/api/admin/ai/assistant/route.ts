import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAnthropicApiKey, isAnthropicConfigured } from "@/lib/anthropic";
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/admin-assistant-tools";

const MAX_ITERATIONS = 4;

const SYSTEM_PROMPT = `You are a helpful admin assistant for cloudless.gr, a digital marketing agency in Greece. You have access to three tools:
- search_notion: find pages, projects, tasks, and docs in the Notion workspace
- get_recent_orders: look up recent Stripe orders
- draft_email: compose or send a team email

Use tools when the request needs live data. For general questions, answer directly. Be concise and actionable.`;

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface AssistantMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface AnthropicResponse {
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | string;
  content: ContentBlock[];
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  if (!(await isAnthropicConfigured())) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured in AWS SSM." },
      { status: 503 }
    );
  }

  let messages: AssistantMessage[];
  try {
    const body = (await req.json()) as any as { messages: AssistantMessage[] };
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "API key unavailable" }, { status: 503 });
  }

  const toolsUsed: string[] = [];
  const currentMessages = [...messages];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await globalThis.fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: ASSISTANT_TOOLS,
        messages: currentMessages,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[assistant] Anthropic error", res.status, err);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = (await res.json()) as any as AnthropicResponse;

    if (data.stop_reason === "end_turn") {
      const text =
        (data.content.find((b) => b.type === "text") as TextBlock | undefined)?.text ?? "";
      return NextResponse.json({ response: text, toolsUsed });
    }

    if (data.stop_reason === "tool_use") {
      currentMessages.push({ role: "assistant", content: data.content });

      const toolResults: ToolResultBlock[] = [];
      for (const block of data.content) {
        if (block.type !== "tool_use") continue;
        const { id, name, input } = block as ToolUseBlock;
        if (!toolsUsed.includes(name)) toolsUsed.push(name);
        const result = await runAssistantTool(name, input);
        toolResults.push({ type: "tool_result", tool_use_id: id, content: result });
      }
      currentMessages.push({ role: "user", content: toolResults });
    }
  }

  return NextResponse.json({
    response:
      "I hit the tool-use limit without a final answer. Please try rephrasing your request.",
    toolsUsed,
  });
}
