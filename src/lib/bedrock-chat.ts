/**
 * Bedrock Converse API wrapper for the Cloudless chat widget.
 *
 * Replaces the former direct-Anthropic-API call in /api/chat.
 * Uses IAM auth (no API key needed) — the Lambda execution role must have
 * bedrock:InvokeModel on the foundation-model resource (granted via
 * sst.config.ts permissions).
 *
 * Model: us.anthropic.claude-haiku-4-5-20251001-v1:0 (US cross-region inference)
 * Region: us-east-1 (Lambda deployment region; falls back to AWS_REGION env var)
 */

import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
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

// ---------------------------------------------------------------------------
// Core loop
// ---------------------------------------------------------------------------

/**
 * Run the chat-tool loop against Bedrock Converse API.
 * Returns the final assistant text (after any tool calls).
 * Never throws on tool errors — those become tool_result strings.
 * May throw on Bedrock API errors; caller maps them to HTTP status codes.
 */
export async function runBedrockChatLoop(
  systemPrompt: string,
  initialMessages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
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
      // Extract and concatenate all text blocks.
      return (assistantContent as TextBlock[])
        .filter((b) => typeof b.text === "string")
        .map((b) => b.text)
        .join("");
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
