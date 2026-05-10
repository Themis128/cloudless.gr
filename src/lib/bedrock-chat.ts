/**
 * Bedrock Converse API wrapper for the Cloudless chat widget.
 *
 * Replaces the former direct-Anthropic-API call in /api/chat.
 * Uses IAM auth (no API key needed) — the Lambda execution role must have
 * bedrock:InvokeModel on the foundation-model resource (granted via
 * sst.config.ts permissions).
 *
 * Model: us.anthropic.claude-3-5-haiku-20241022-v1:0 (US cross-region inference)
 * Region: us-east-1 (Lambda deployment region; falls back to AWS_REGION env var)
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ToolConfiguration,
} from "@aws-sdk/client-bedrock-runtime";
import { CHAT_TOOLS, runTool } from "@/lib/chat-tools";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BEDROCK_REGION = process.env.AWS_REGION ?? "us-east-1";
const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ??
  "us.anthropic.claude-3-5-haiku-20241022-v1:0";

const MAX_TOKENS = 600;
const MAX_TOOL_ITERATIONS = 4;

// Lazy singleton — created once per Lambda cold start.
let _client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (!_client) _client = new BedrockRuntimeClient({ region: BEDROCK_REGION });
  return _client;
}

// ---------------------------------------------------------------------------
// Tool config — convert Anthropic input_schema format → Bedrock toolSpec
// ---------------------------------------------------------------------------
// The Bedrock SDK represents Tool/ToolInputSchema as smithy-generated
// discriminated unions that require an explicit `$unknown` member for
// forward-compatibility. We satisfy the type by annotating as ToolConfiguration
// and casting the input_schema to the expected document type.

const BEDROCK_TOOL_CONFIG: ToolConfiguration = {
  tools: CHAT_TOOLS.map((t) => ({
    toolSpec: {
      name: t.name,
      description: t.description,
      inputSchema: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        json: t.input_schema as unknown as Record<string, any>,
      },
    },
  })) as ToolConfiguration["tools"],
};

// ---------------------------------------------------------------------------
// Narrow content-block types (only what we read / write)
// ---------------------------------------------------------------------------

type TextBlock = { text: string };
type ToolUseBlock = {
  toolUse: {
    toolUseId: string;
    name: string;
    input: Record<string, unknown>;
  };
};
type ToolResultBlock = {
  toolResult: {
    toolUseId: string;
    content: [{ text: string }];
  };
};

type AnyBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface BedrockMessage {
  role: "user" | "assistant";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any[];
}

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
  initialMessages: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const client = getClient();

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
    const assistantContent: AnyBlock[] =
      (response.output?.message?.content as AnyBlock[]) ?? [];

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
        "toolUse" in b &&
        typeof (b as ToolUseBlock).toolUse?.toolUseId === "string",
    );

    toolUseBlocks.forEach((b) =>
      console.warn("[chat] tool_use", b.toolUse.name),
    );

    const toolResults: ToolResultBlock[] = await Promise.all(
      toolUseBlocks.map(async (b) => {
        const result = await runTool(b.toolUse.name, b.toolUse.input);
        return {
          toolResult: {
            toolUseId: b.toolUse.toolUseId,
            content: [{ text: result }] as [{ text: string }],
          },
        };
      }),
    );

    messages.push({ role: "user", content: toolResults });
  }

  console.warn("[chat] hit MAX_TOOL_ITERATIONS without a final response");
  return "I'm having trouble pulling that together right now. Could you share a bit more detail or use the Contact page to reach Themis directly?";
}
