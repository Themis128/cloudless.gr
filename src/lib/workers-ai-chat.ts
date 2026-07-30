/**
 * Cloudflare Workers AI chat loop — replaces Bedrock Converse for /api/chat.
 *
 * Uses the same REST pattern as /api/admin/ai/generate. Tool calling is done
 * via a lightweight JSON protocol in the model reply (TOOL_CALL / TOOL_RESULT)
 * so we do not depend on Bedrock-specific Converse APIs.
 */

import { CHAT_TOOLS, runTool } from "@/lib/chat-tools";
import {
  buildWorkersAiToolProtocol,
  callWorkersAiChat,
  parseWorkersAiToolCall,
} from "@/lib/workers-ai-client";

const MAX_TOKENS = 600;
const MAX_TOOL_ITERATIONS = 4;

/**
 * Run the chat-tool loop against Cloudflare Workers AI.
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

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const reply = await callWorkersAiChat(messages, { maxTokens: MAX_TOKENS });
    const toolCall = parseWorkersAiToolCall(reply);
    if (!toolCall) return reply || "Sorry — I could not generate a reply.";

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
