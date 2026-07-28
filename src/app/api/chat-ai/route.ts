import { NextRequest, NextResponse } from "next/server";
import type { ChatRequest } from "@cloudless/ai";
import { requireAuth } from "../lib/auth-middleware";

// Chat AI endpoint supporting multiple providers for free tier coverage
// Workers AI: 100K tokens/day | Gemini: 1500 requests/day (free)

// Static export compatibility - Worker handles API routes
export const dynamic = "force-static";
export const revalidate = 3600;

interface ChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  max_tokens?: number;
  provider?: "workers-ai" | "gemini";
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

// Gemini free model
const GEMINI_MODEL = "gemini-1.5-flash";

function convertToGeminiHistory(messages: Array<{ role: string; content: string }>) {
  return messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
}

async function callGemini(messages: ChatRequest["messages"], max_tokens: number) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const history = convertToGeminiHistory(messages);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: history,
        generationConfig: { maxOutputTokens: max_tokens },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = (await response.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = (await request.json()) as ChatRequest;
    const { messages, max_tokens = 512, provider = "gemini" } = body;

    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let response: string;
    let model: string;

    if (provider === "gemini") {
      response = await callGemini(messages, max_tokens);
      model = GEMINI_MODEL;
    } else {
      // Workers AI not available in Next.js export - redirect to Worker endpoint
      return new Response(
        JSON.stringify({
          error: "Workers AI requires Cloudflare Worker deployment",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ response, model }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Chat failed",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
