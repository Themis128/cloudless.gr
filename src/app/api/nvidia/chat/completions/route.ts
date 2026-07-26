/** * NVIDIA Chat Completions Endpoint
 * POST /api/nvidia/chat/completions */
import { NextResponse, NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const MAX_TOKENS = 65536;
const REASONING_BUDGET = 16384;
const DEFAULT_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 15;

type NvidiaError = {
  type: "auth_error" | "validation_error" | "api_error" | "feature_disabled";
  code: string;
  message: string;
  param?: string;
};

function createErrorResponse(error: NvidiaError, status: number = 400): NextResponse {
  return NextResponse.json({ error }, { status });
}

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    logger.error("NVIDIA_API_KEY environment variable is not set");
    return false;
  }
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split(" ")[1];
  return token === apiKey;
}

function isFeatureEnabled(): boolean {
  return process.env.ENABLE_NVIDIA_API !== "false";
}

async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isFeatureEnabled()) {
    return NextResponse.json(
      { error: { type: "feature_disabled", code: "api_disabled", message: "NVIDIA API is disabled" } },
      { status: 403 }
    );
  }

  if (!validateAuth(request)) {
    return createErrorResponse(
      { type: "auth_error", code: "invalid_api_key", message: "Invalid or missing API key" },
      401
    );
  }

  const limiter = rateLimit("nvidia-chat-completions", RATE_LIMIT_WINDOW, RATE_LIMIT_MAX);

  try {
    const body = (await request.json()) as {
      messages?: Array<{ role: string; content: string }>;
      model?: string;
      max_tokens?: number;
      reasoning_budget?: number;
      stream?: boolean;
      temperature?: number;
      top_p?: number;
    };

    const messages = body?.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return createErrorResponse(
        { type: "validation_error", code: "missing_messages", message: "messages array is required and cannot be empty", param: "messages" },
        400
      );
    }

    if (messages.some((msg) => !msg.content || !msg.role)) {
      return createErrorResponse(
        { type: "validation_error", code: "invalid_message", message: "Each message must have role and content", param: "messages" },
        400
      );
    }

    const selectedModel = body?.model || DEFAULT_MODEL;
    if (!selectedModel.startsWith("nvidia/")) {
      return createErrorResponse(
        { type: "validation_error", code: "invalid_model", message: "Model must be a valid NVIDIA model ID", param: "model" },
        400
      );
    }

    const maxTokens = body?.max_tokens || MAX_TOKENS;
    if (maxTokens > MAX_TOKENS) {
      return createErrorResponse(
        { type: "validation_error", code: "max_tokens_exceeded", message: `max_tokens cannot exceed ${MAX_TOKENS}` },
        400
      );
    }

    const isStreaming = body?.stream === true;

    const response = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: selectedModel,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: `Hello! I received your message: "${messages[messages.length - 1].content}" This is a mock NVIDIA API response.`
          }
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 50,
        total_tokens: 60
      }
    };

    if (isStreaming) {
      const streamResponse = new NextResponse(
        new ReadableStream({
          start(controller) {
            const chunks = [
              {
                id: response.id,
                object: "chat.completion.chunk",
                created: response.created,
                model: response.model,
                choices: [
                  { index: 0, delta: { content: "Hello!" }, finish_reason: null }
                ]
              }
            ];
            for (const chunk of chunks) {
              const data = `data: ${JSON.stringify(chunk)}\n\n`;
              controller.enqueue(new TextEncoder().encode(data));
            }
            controller.enqueue(new TextEncoder().encode("[DONE]\n\n"));
            controller.close();
          }
        }),
        { headers: { "Content-Type": "text/event-stream" } }
      );
      return streamResponse;
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Chat completion failed:", error);
    return createErrorResponse(
      { type: "api_error", code: "api_failure", message: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: { type: "api_error", code: "method_not_allowed", message: "Use POST method for chat completions" } },
    { status: 405 }
  );
}

export const dynamic = "force-dynamic";