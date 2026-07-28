/**
 * Google Gemini AI provider for cloudless.gr chat.
 * Replaces AWS Bedrock as the primary AI provider for chat functionality.
 * Supports function calling/tool use via Gemini's native tool support.
 */

// Gemini model configuration
export const GEMINI_MODEL_ID = "gemini-1.5-flash";

// Function to get Gemini API key from environment
export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

// Check if Gemini is available (API key configured)
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// Generate response using Gemini REST API with optional system instruction
export async function generateGeminiResponse(
  messages: Array<{ role: "user" | "model"; content: string }>,
  maxTokens: number = 600,
  tools?: Array<{ name: string; description: string; parameters: unknown }>,
  systemInstruction?: string
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  // Convert messages to Gemini format
  const contents = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  // Build request body
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  };

  // Add system instruction if provided
  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  // Add tools if provided (Gemini function calling)
  if (tools && tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ];
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
        }>;
      };
    }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Tool use support for Gemini
export function extractFunctionCalls(
  data: unknown
): Array<{ name: string; args: Record<string, unknown> }> {
  const candidates = (data as { candidates?: unknown[] })?.candidates;
  if (!candidates) return [];

  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const candidate of candidates) {
    const parts = (candidate as { content?: { parts?: unknown[] } })?.content?.parts;
    if (parts) {
      for (const part of parts) {
        const fc = (part as Record<string, unknown>).functionCall as
          { name: string; args: Record<string, unknown> } | undefined;
        if (fc?.name) {
          calls.push({ name: fc.name, args: fc.args });
        }
      }
    }
  }
  return calls;
}
