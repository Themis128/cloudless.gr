/**
 * Shared Bedrock Converse plumbing used by every agent loop in this repo.
 *
 * Consumers:
 *   - src/lib/bedrock-chat.ts (the public chat widget)
 *   - src/lib/agent-book.ts   (the authenticated booking agent)
 *
 * Centralizes the block-type definitions, lazy client singleton, and the
 * Anthropic-shaped → Bedrock toolSpec conversion so both loops stay in sync
 * (and SonarCloud's duplication detector stays happy).
 */
import {
  BedrockRuntimeClient,
  type ToolConfiguration,
} from "@aws-sdk/client-bedrock-runtime";

const DEFAULT_REGION = "us-east-1";
const DEFAULT_MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0";

export const BEDROCK_REGION = process.env.AWS_REGION ?? DEFAULT_REGION;
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL_ID;

// ---------------------------------------------------------------------------
// Content block types — narrow shape of what we actually read / write.
// ---------------------------------------------------------------------------

export type TextBlock = { text: string };

export type ToolUseBlock = {
  toolUse: {
    toolUseId: string;
    name: string;
    input: Record<string, unknown>;
  };
};

export type ToolResultBlock = {
  toolResult: {
    toolUseId: string;
    content: [{ text: string }];
  };
};

export type AnyBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface BedrockMessage {
  role: "user" | "assistant";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any[];
}

// ---------------------------------------------------------------------------
// Lazy singleton — created once per Lambda cold start.
// ---------------------------------------------------------------------------

let _client: BedrockRuntimeClient | null = null;

export function getBedrockClient(): BedrockRuntimeClient {
  if (!_client) _client = new BedrockRuntimeClient({ region: BEDROCK_REGION });
  return _client;
}

// ---------------------------------------------------------------------------
// Tool-config builder — convert our Anthropic-shaped tool list to a Bedrock
// ToolConfiguration. The SDK uses smithy-generated discriminated unions, so
// we annotate the result and cast the input_schema document.
// ---------------------------------------------------------------------------

interface AnthropicShapedTool {
  readonly name: string;
  readonly description: string;
  readonly input_schema: unknown;
}

export function buildBedrockToolConfig(
  tools: ReadonlyArray<AnthropicShapedTool>,
): ToolConfiguration {
  return {
    tools: tools.map((t) => ({
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
}
