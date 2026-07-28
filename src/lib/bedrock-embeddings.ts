import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION || "us-east-1";

export const BEDROCK_TITAN_EMBED_MODEL_ID =
  process.env.BEDROCK_EMBED_MODEL_ID || "amazon.titan-embed-text-v2:0";

export const BEDROCK_EMBED_DIMENSIONS = Number.parseInt(
  process.env.BEDROCK_EMBED_DIMENSIONS || "512",
  10
);

let client: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
  client ??= new BedrockRuntimeClient({ region: REGION });
  return client;
}

export function normalizeEmbeddingInput(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, 50_000);
}

export async function embedTextWithTitan(input: string): Promise<number[]> {
  const inputText = normalizeEmbeddingInput(input);

  if (!inputText) {
    throw new Error("Cannot embed empty text");
  }

  const body = JSON.stringify({
    inputText,
    dimensions: BEDROCK_EMBED_DIMENSIONS,
    normalize: true,
  });

  const res = await getBedrockClient().send(
    new InvokeModelCommand({
      modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    })
  );

  const text = new TextDecoder().decode(res.body as Uint8Array);
  const parsed = JSON.parse(text) as { embedding?: unknown };

  if (!Array.isArray(parsed.embedding)) {
    throw new Error("Titan embedding response did not include embedding[]");
  }

  return parsed.embedding.map((v) => Number(v));
}
