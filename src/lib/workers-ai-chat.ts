/**
 * Cloudflare Workers AI chat loop — replaces Bedrock Converse for /api/chat.
 *
 * Uses the same REST pattern as /api/admin/ai/generate. Tool calling is done
 * via a lightweight JSON protocol in the model reply (TOOL_CALL / TOOL_RESULT)
 * so we do not depend on Bedrock-specific Converse APIs.
 */

import { CHAT_TOOLS, runTool } from "@/lib/chat-tools";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_TOKENS = 600;
const MAX_TOOL_ITERATIONS = 4;

const THINKING_TAG_RE = /<thinking>[\s\S]*?<\/thinking>\s*/gi;

function stripThinkingTags(text: string): string {
  return text.replace(THINKING_TAG_RE, "").trim();
}

function toolCatalog(): string {
  return CHAT_TOOLS.map(
    (t) =>
      `- ${t.name}: ${t.description}\n  args schema: ${JSON.stringify(t.input_schema)}`
  ).join("\n");
}

const TOOL_PROTOCOL = `
When you need a tool, reply with ONLY a single JSON object (no markdown):
{"tool":"<name>","args":{...}}
After you receive tool results in the conversation, answer the user in plain text.
Never invent tool results. Available tools:
${toolCatalog()}
`;

interface CfAiResult {
  result?: { response?: string };
  errors?: { message?: string }[];
}

async function callWorkersAi(
  messages: { role: string; content: string }[]
): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    const err = new Error("Workers AI not configured");
    err.name = "UnauthorizedException";
    throw err;
  }

  const model = process.env.WORKERS_AI_CHAT_MODEL || DEFAULT_MODEL;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        max_tokens: MAX_TOKENS,
      }),
    }
  );

  const data = (await response.json()) as CfAiResult;
  if (!response.ok) {
    const err = new Error(data.errors?.[0]?.message ?? `Workers AI HTTP ${response.status}`);
    err.name = response.status === 401 || response.status === 403 ? "UnauthorizedException" : "AiError";
    throw err;
  }

  return stripThinkingTags(data.result?.response ?? "");
}

function parseToolCall(text: string): { name: string; args: Record<string, unknown> } | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*"tool"[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { tool?: string; args?: Record<string, unknown> };
    if (!parsed.tool || typeof parsed.tool !== "string") return null;
    return { name: parsed.tool, args: parsed.args ?? {} };
  } catch {
    return null;
  }
}

/**
 * Run the chat-tool loop against Cloudflare Workers AI.
 * May throw on config/API errors; caller maps them to HTTP status codes.
 */
export async function runWorkersAiChatLoop(
  systemPrompt: string,
  initialMessages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const messages: { role: string; content: string }[] = [
    { role: "system", content: `${systemPrompt}\n\n${TOOL_PROTOCOL}` },
    ...initialMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const reply = await callWorkersAi(messages);
    const toolCall = parseToolCall(reply);
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
