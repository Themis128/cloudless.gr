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
  ConverseCommand,
  type ToolConfiguration,
} from "@aws-sdk/client-bedrock-runtime";

const DEFAULT_REGION = "us-east-1";
// Switched 2026-06-19 from us.anthropic.claude-haiku-4-5-20251001-v1:0 to Nova
// Micro: Haiku 4.5 Marketplace subscription was never enabled on this account,
// and Nova Micro is ~30x cheaper ($0.035/M in, $0.14/M out) while still
// supporting the Bedrock Converse tool-use loop the chat widget + booking
// agent depend on. IAM grants in sst.config.ts must match this model.
const DEFAULT_MODEL_ID = "us.amazon.nova-micro-v1:0";

export const BEDROCK_REGION = process.env.AWS_REGION ?? DEFAULT_REGION;
export const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL_ID;

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
   
  content: any[];
}

// ---------------------------------------------------------------------------
// Lazy singleton — created once per Lambda cold start.
// ---------------------------------------------------------------------------

let _client: BedrockRuntimeClient | null = null;

export function getBedrockClient(): BedrockRuntimeClient {
  _client ??= new BedrockRuntimeClient({ region: BEDROCK_REGION });
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
  tools: ReadonlyArray<AnthropicShapedTool>
): ToolConfiguration {
  return {
    tools: tools.map((t) => ({
      toolSpec: {
        name: t.name,
        description: t.description,
        inputSchema: {
           
          json: t.input_schema as unknown as Record<string, any>,
        },
      },
    })) as ToolConfiguration["tools"],
  };
}

// ---------------------------------------------------------------------------
// Turn helpers — thin wrappers around ConverseCommand that two or more agent
// loops share. Pulling these out keeps the per-agent loop body small enough
// that Sonar's duplicate-token detector doesn't flag the two files as a
// near-clone of each other.
// ---------------------------------------------------------------------------

export interface RunBedrockTurnOptions {
  client: BedrockRuntimeClient;
  system: string;
  messages: BedrockMessage[];
  /** Omit (or pass an empty tools array) for plain text generation —
   *  Bedrock 400s on `toolConfig: { tools: [] }`. */
  toolConfig?: ToolConfiguration;
  maxTokens?: number;
}

/**
 * Run one Bedrock Converse turn and return the assistant's content blocks.
 * Callers handle the loop, tool dispatch, and termination conditions.
 */
export async function runBedrockTurn(opts: RunBedrockTurnOptions): Promise<AnyBlock[]> {
  // Only attach toolConfig when there is at least one tool — Bedrock 400s on
  // an empty tools array.
  const hasTools = !!opts.toolConfig?.tools?.length;
  const cmd = new ConverseCommand({
    modelId: BEDROCK_MODEL_ID,
    system: [{ text: opts.system }],
    messages: opts.messages,
    ...(hasTools ? { toolConfig: opts.toolConfig } : {}),
    inferenceConfig: { maxTokens: opts.maxTokens ?? 400 },
  });
  const response = await opts.client.send(cmd);
  return (response.output?.message?.content as AnyBlock[]) ?? [];
}

/** Filter an assistant content array to just the tool-use blocks. */
export function pickToolUseBlocks(content: AnyBlock[]): ToolUseBlock[] {
  return content.filter(
    (b): b is ToolUseBlock => "toolUse" in b && typeof b.toolUse?.toolUseId === "string"
  );
}

/** Join the text fragments of an assistant turn into a single trimmed string. */
export function joinAssistantText(content: AnyBlock[]): string {
  return content
    .filter((b): b is TextBlock => "text" in b && typeof b.text === "string")
    .map((b) => b.text)
    .join(" ")
    .trim();
}
