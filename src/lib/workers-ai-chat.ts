/**
 * Chat loop for /api/chat (Cloudless Assistant).
 *
 * Primary backend: NVIDIA postiz-ai-proxy Worker (nemotron-3.5-lightning-30b-a3b
 * with extended thinking). Reasoning content is stripped in the Worker before
 * returning, so visitors only see the final reply.
 *
 * Fallback: Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct) when
 * NVIDIA_PROXY_URL / NVIDIA_PROXY_TOKEN are not set in the pod env.
 *
 * Tool calling uses the same lightweight JSON protocol (TOOL_CALL/TOOL_RESULT)
 * regardless of which backend is active.
 */

import { CHAT_TOOLS, runTool } from "@/lib/chat-tools";
import {
  buildWorkersAiToolProtocol,
  callWorkersAiChat,
  parseWorkersAiToolCall,
} from "@/lib/workers-ai-client";
import { isNvidiaProxyConfigured, callNvidiaProxyChat } from "@/lib/nvidia-proxy-client";
import { isOllamaConfigured, callOllamaChat } from "@/lib/ollama-client";

const MAX_TOKENS = 600;
const MAX_TOOL_ITERATIONS = 4;

// Detect when the model outputs reasoning instead of a visitor-facing reply
const REASONING_PATTERNS =
  /^(we need to|i need to|let me|the user|we should|to book|looking at|it seems|we must|however we|given the|since we|the slot|need iso|the tool|let's assume)/i;

function looksLikeLeakedReasoning(text: string): boolean {
  const t = text.trim();
  return (
    REASONING_PATTERNS.test(t) ||
    (t.length > 250 &&
      /we need to|i need to|let me think|we should call|we must|the model/i.test(t))
  );
}

async function callChatBackend(messages: { role: string; content: string }[]): Promise<string> {
  if (isNvidiaProxyConfigured()) {
    return callNvidiaProxyChat(messages, { maxTokens: MAX_TOKENS });
  }
  // Try Workers AI directly; if credentials are absent it throws UnauthorizedException
  // which we catch to fall through to the next backend.
  try {
    return await callWorkersAiChat(messages, { maxTokens: MAX_TOKENS });
  } catch (e) {
    if (!(e instanceof Error && e.name === "UnauthorizedException")) throw e;
  }
  if (isOllamaConfigured()) {
    return callOllamaChat(messages, { maxTokens: MAX_TOKENS });
  }
  const err = new Error("No chat backend configured");
  err.name = "UnauthorizedException";
  throw err;
}

/**
 * Run the chat-tool loop.
 * May throw on config/API errors; caller maps them to HTTP status codes.
 */
export async function runWorkersAiChatLoop(
  systemPrompt: string,
  initialMessages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const messages: { role: string; content: string }[] = [
    {
      role: "system",
      content: `${systemPrompt}\n\n${buildWorkersAiToolProtocol(CHAT_TOOLS)}`,
    },
    ...initialMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let reasoningRetried = false;
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const reply = await callChatBackend(messages);
    const toolCall = parseWorkersAiToolCall(reply);
    if (!toolCall) {
      // If the model leaked reasoning as plain text, give it one silent retry
      if (!reasoningRetried && looksLikeLeakedReasoning(reply)) {
        reasoningRetried = true;
        messages.push({ role: "assistant", content: reply });
        messages.push({
          role: "user",
          content:
            "Please send your final reply to the visitor now. No reasoning — just the message they should read.",
        });
        continue;
      }
      return reply || "Sorry — I could not generate a reply.";
    }

    messages.push({ role: "assistant", content: reply });
    const toolResult = await runTool(toolCall.name, toolCall.args);
    messages.push({
      role: "user",
      content: `TOOL_RESULT for ${toolCall.name}:\n${toolResult}`,
    });
  }

  return "I hit a tool-call limit — please try again with a simpler question, or use the Contact page.";
}

/** @deprecated name kept for gradual call-site migration */
export const runBedrockChatLoop = runWorkersAiChatLoop;
