import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/admin-assistant-tools";
import { callGemini, getGeminiApiKey, isGeminiConfigured } from "@/lib/gemini-admin";

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

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
};

function convertToGeminiHistory(messages: AssistantMessage[]) {
  return messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
  }));
}

function extractFunctionCalls(parts: GeminiPart[]): ToolUseBlock[] {
  const calls: ToolUseBlock[] = [];
  for (const part of parts ?? []) {
    if (part?.functionCall) {
      calls.push({
        type: "tool_use",
        id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: part.functionCall.name,
        input: part.functionCall.args,
      });
    }
  }
  return calls;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  if (!(await isGeminiConfigured())) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured." },
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

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "API key unavailable" }, { status: 503 });
  }

  const toolsUsed: string[] = [];
  const currentMessages = [...messages];

  // Build function declarations for Gemini tool use
  const functionDeclarations = ASSISTANT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }));

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const history = convertToGeminiHistory(currentMessages);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: SYSTEM_PROMPT,
          contents: history,
          generationConfig: { maxOutputTokens: 2000 },
          tools: [{ functionDeclarations: functionDeclarations }],
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      console.error("[assistant] Gemini error", response.status, err);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = (await response.json()) as GeminiResponse;
    const parts = data.candidates?.[0]?.content?.parts ?? [];

    // Check if there are function calls
    const functionCalls = extractFunctionCalls(parts);

    if (functionCalls.length === 0) {
      // No function calls - return the text response
      const text = parts.find((p) => p.text)?.text ?? "";
      return NextResponse.json({ response: text, toolsUsed });
    }

    // Process function calls
    for (const fc of functionCalls) {
      const name = fc.name;
      const input = fc.input;
      if (!toolsUsed.includes(name)) toolsUsed.push(name);
      const result = await runAssistantTool(name, input);
      
      // Add function response to conversation
      currentMessages.push({
        role: "assistant",
        content: `Called tool ${name} with result: ${result}`,
      });
    }
  }

  return NextResponse.json({
    response: "I hit the tool-use limit without a final answer. Please try rephrasing your request.",
    toolsUsed,
  });
}