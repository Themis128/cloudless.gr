import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { adminAiNotConfiguredResponse, isAdminAiConfiguredAsync } from "@/lib/admin-ai";
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/admin-assistant-tools";
import {
  buildWorkersAiToolProtocol,
  callWorkersAiChat,
  parseWorkersAiToolCall,
  isWorkersAiConfigured,
} from "@/lib/workers-ai-client";
import { isNvidiaProxyConfigured, callNvidiaProxyChat } from "@/lib/nvidia-proxy-client";
import { isOllamaConfigured, callOllamaChat } from "@/lib/ollama-client";
import { generateAdminAiText } from "@/lib/admin-ai";
import { retrieveAdminRagContext } from "@/lib/admin-rag";

const MAX_ITERATIONS = 4;

const SYSTEM_PROMPT = `You are a helpful admin assistant for cloudless.gr, a digital marketing agency in Greece. You have access to tools:
- search_notion: search lake-synced CMS docs (Vectorize / AppFlowy RAG) and gold SEO keywords
- get_datalake_section: read gold datalake sections (stripe_revenue, top_keywords, …)
- get_lake_insight: read materialized LLM insights (seo, revenue, executive, …)
- get_recent_orders: summarize stripe_revenue gold rows (not live Stripe)
- draft_email: compose or send a team email

Prefer lake tools for metrics and insights. Do not assume live vendor APIs. Be concise and actionable.`;

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

function lastUserText(messages: AssistantMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && typeof messages[i].content === "string") {
      return messages[i].content;
    }
  }
  return "";
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  if (!(await isAdminAiConfiguredAsync())) {
    return adminAiNotConfiguredResponse();
  }

  let messages: AssistantMessage[];
  try {
    const body = (await req.json()) as { messages: AssistantMessage[] };
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const toolsUsed: string[] = [];
  const query = lastUserText(messages);
  const rag = await retrieveAdminRagContext(query).catch(() => "");
  const systemWithRag = rag ? `${SYSTEM_PROMPT}\n\nRelevant site content:\n${rag}` : SYSTEM_PROMPT;

  // Tool loop — pick first available backend: NVIDIA → Workers AI → Ollama
  const useNvidia = isNvidiaProxyConfigured();
  const useWorkersAi = !useNvidia && isWorkersAiConfigured();
  const useOllama = !useNvidia && !useWorkersAi && isOllamaConfigured();

  if (useNvidia || useWorkersAi || useOllama) {
    const provider = useNvidia ? "nvidia-proxy" : useWorkersAi ? "workers-ai" : "ollama";
    const callBackend = (msgs: { role: string; content: string }[]) =>
      useNvidia
        ? callNvidiaProxyChat(msgs, { maxTokens: 2000 })
        : useWorkersAi
          ? callWorkersAiChat(msgs, { maxTokens: 2000 })
          : callOllamaChat(msgs, { maxTokens: 2000 });

    const loopMessages: { role: string; content: string }[] = [
      {
        role: "system",
        content: `${systemWithRag}\n\n${buildWorkersAiToolProtocol(ASSISTANT_TOOLS)}`,
      },
      ...messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
    ];

    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const reply = await callBackend(loopMessages);
        const toolCall = parseWorkersAiToolCall(reply);
        if (!toolCall) {
          return NextResponse.json({ response: reply, toolsUsed, provider });
        }
        if (!toolsUsed.includes(toolCall.name)) toolsUsed.push(toolCall.name);
        loopMessages.push({ role: "assistant", content: reply });
        const result = await runAssistantTool(toolCall.name, toolCall.args);
        loopMessages.push({
          role: "user",
          content: `Tool ${toolCall.name} result:\n${result}`,
        });
      }
      return NextResponse.json({
        response:
          "I hit the tool-use limit without a final answer. Please try rephrasing your request.",
        toolsUsed,
        provider,
      });
    } catch (err) {
      console.warn(`[assistant] ${provider} tool loop failed, falling back to Gemini:`, err);
    }
  }

  // Gemini / single-turn fallback (no native tools — answer with RAG only)
  try {
    const { text, provider } = await generateAdminAiText(
      `${query}\n\n(Answer using any context provided in the system prompt. You cannot call tools in this mode.)`,
      { maxTokens: 1500, system: systemWithRag }
    );
    return NextResponse.json({ response: text, toolsUsed, provider });
  } catch (e) {
    console.error("[assistant] generation failed:", e);
    return NextResponse.json({ error: "AI service error" }, { status: 502 });
  }
}
