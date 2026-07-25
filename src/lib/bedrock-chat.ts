/**
 * Bedrock Converse API wrapper for the Cloudless chat widget.
 *
 * Replaces the former direct-Anthropic-API call in /api/chat.
 * Uses IAM auth (no API key needed) — the Lambda execution role must have
 * bedrock:InvokeModel on the foundation-model resource (granted via
 * sst.config.ts permissions).
 *
 * Model: us.amazon.nova-micro-v1:0 (US cross-region inference)
 *   - Switched from Claude Haiku 4.5 on 2026-06-19 (Marketplace subscription
 *     never enabled on this account; Nova Micro is ~30x cheaper anyway).
 *   - Nova sometimes wraps reasoning in <thinking>…</thinking> XML — we strip
 *     those before returning text to the user. The system prompt also asks
 *     Nova not to emit them, but stripping is the safety net.
 * Region: us-east-1 (Lambda deployment region; falls back to AWS_REGION env var)
 */

import { ConverseCommand } from "@/types/aws-sdk/client-bedrock-runtime";
import { CHAT_TOOLS, runTool } from "@/lib/chat-tools";
import {
  BEDROCK_MODEL_ID,
  buildBedrockToolConfig,
  getBedrockClient,
  type AnyBlock,
  type BedrockMessage,
  type TextBlock,
  type ToolResultBlock,
  type ToolUseBlock,
} from "@/lib/bedrock-shared";

const MAX_TOKENS = 600;
const MAX_TOOL_ITERATIONS = 4;

const BEDROCK_TOOL_CONFIG = buildBedrockToolConfig(CHAT_TOOLS);

// Workers AI binding (provided by wrangler)
interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

interface AiEnv {
  AI: AiBinding;
}

function getAiBinding(): AiBinding | null {
  return (process.env as unknown as AiEnv).AI ?? null;
}

const WORKERS_AI_CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

async function runWorkersAiChat(
  systemPrompt: string,
  messages: BedrockMessage[]
): Promise<string | null> {
  const ai = getAiBinding();
  if (!ai) return null;

  // Convert Bedrock content-array messages to plain strings for Workers AI
  const workersAiMessages = messages.map((m) => ({
    role: m.role,
    content: (m.content as TextBlock[])
      .filter((b): b is TextBlock => "text" in b && typeof b.text === "string")
      .map((b) => b.text)
      .join(""),
  }));

  try {
    const result = (await ai.run(WORKERS_AI_CHAT_MODEL, {
      messages: [{ role: "system", content: systemPrompt }, ...workersAiMessages],
    })) as { response?: string };
    return result.response ?? null;
  } catch (err) {
    console.warn(
      "[chat] Workers AI chat failed, falling back to Bedrock:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// Nova models occasionally emit internal reasoning wrapped in
// <thinking>…</thinking> tags. The system prompt asks them not to, but we
// strip defensively in case they slip through (the alternative is the user
// seeing the chatbot's monologue).
const THINKING_TAG_RE = /<thinking>[\s\S]*?<\/thinking>\s*/gi;
function stripThinkingTags(text: string): string {
  return text.replace(THINKING_TAG_RE, "").trim();
}

// ---------------------------------------------------------------------------
// Core loop
// ---------------------------------------------------------------------------

/**
 * Run the chat loop — Workers AI primary (no tools), Bedrock fallback (with tools).
 * Returns the final assistant text (after any tool calls).
 * Never throws on tool errors — those become tool_result strings.
 * May throw on Bedrock API errors; caller maps them to HTTP status codes.
 */
export async function runBedrockChatLoop(
  systemPrompt: string,
  initialMessages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  // 1. Try Workers AI first (fast, free, no tool support yet)
  const workersAiMessages: BedrockMessage[] = initialMessages.map((m) => ({
    role: m.role,
    content: [{ text: m.content }],
  }));
  const workersAiResponse = await runWorkersAiChat(systemPrompt, workersAiMessages);
  if (workersAiResponse) {
    return workersAiResponse;
  }

  // 2. Fall back to Bedrock Converse with tool-use loop
  const client = getBedrockClient();

  // Convert plain-string messages to Bedrock content arrays.
  const messages: BedrockMessage[] = initialMessages.map((m) => ({
    role: m.role,
    content: [{ text: m.content }],
  }));

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const cmd = new ConverseCommand({
      modelId: BEDROCK_MODEL_ID,
      system: [{ text: systemPrompt }],
      messages,
      toolConfig: BEDROCK_TOOL_CONFIG,
      inferenceConfig: { maxTokens: MAX_TOKENS },
    });

    const response = await client.send(cmd);
    const stopReason = response.stopReason;
    const assistantContent: AnyBlock[] = (response.output?.message?.content as AnyBlock[]) ?? [];

    if (stopReason !== "tool_use") {
      // Extract and concatenate all text blocks, stripping any Nova
      // <thinking>…</thinking> markers before returning to the user.
      const joined = (assistantContent as TextBlock[])
        .filter((b) => typeof b.text === "string")
        .map((b) => b.text)
        .join("");
      return stripThinkingTags(joined);
    }

    // Append assistant turn (may contain both text and toolUse blocks).
    messages.push({ role: "assistant", content: assistantContent });

    // Extract tool-use blocks and execute them in parallel.
    const toolUseBlocks = assistantContent.filter(
      (b): b is ToolUseBlock =>
        "toolUse" in b && typeof (b as ToolUseBlock).toolUse?.toolUseId === "string"
    );

    toolUseBlocks.forEach((b) => console.warn("[chat] tool_use", b.toolUse.name));

    const toolResults: ToolResultBlock[] = await Promise.all(
      toolUseBlocks.map(async (b) => {
        const result = await runTool(b.toolUse.name, b.toolUse.input);
        return {
          toolResult: {
            toolUseId: b.toolUse.toolUseId,
            content: [{ text: result }] as [{ text: string }],
          },
        };
      })
    );

    messages.push({ role: "user", content: toolResults });
  }

  console.warn("[chat] hit MAX_TOOL_ITERATIONS without a final response");
  return "I'm having trouble pulling that together right now. Could you share a bit more detail or use the Contact page to reach Themis directly?";
}
