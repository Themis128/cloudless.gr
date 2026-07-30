/**
 * @deprecated — Bedrock Converse removed (Cloudflare Workers AI cutover).
 *
 * Keeps pure helpers + fail-closed stubs so existing imports/tests compile.
 * Never constructs BedrockRuntimeClient; never imports @aws-sdk/client-bedrock*.
 */

export const BEDROCK_REGION = process.env.AWS_REGION ?? "us-east-1";
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ??
  process.env.WORKERS_AI_CHAT_MODEL ??
  "@cf/meta/llama-3.1-8b-instruct";

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

export type ToolConfiguration = {
  tools?: Array<{
    toolSpec: {
      name: string;
      description: string;
      inputSchema: { json: Record<string, unknown> };
    };
  }>;
};

const DISABLED_MSG =
  "Bedrock is disabled — use Workers AI (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN)";

/**
 * Fail-closed stub. Callers must use Workers AI instead.
 */
export function getBedrockClient(): never {
  throw new Error(DISABLED_MSG);
}

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
          json: t.input_schema as Record<string, unknown>,
        },
      },
    })),
  };
}

export interface RunBedrockTurnOptions {
  /** Ignored — Bedrock client is never used. */
  client?: unknown;
  system: string;
  messages: BedrockMessage[];
  toolConfig?: ToolConfiguration;
  maxTokens?: number;
}

/**
 * Fail-closed stub. Agent loops must call Workers AI directly.
 */
export async function runBedrockTurn(_opts: RunBedrockTurnOptions): Promise<AnyBlock[]> {
  throw new Error(DISABLED_MSG);
}

export function pickToolUseBlocks(content: AnyBlock[]): ToolUseBlock[] {
  return content.filter(
    (b): b is ToolUseBlock => "toolUse" in b && typeof b.toolUse?.toolUseId === "string"
  );
}

export function joinAssistantText(content: AnyBlock[]): string {
  return content
    .filter((b): b is TextBlock => "text" in b && typeof b.text === "string")
    .map((b) => b.text)
    .join(" ")
    .trim();
}
