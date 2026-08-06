#!/usr/bin/env tsx
/**
 * GenAI Product Description Generator
 *
 * One-shot script: Workers AI generates description drafts for products.
 * Uses Cloudflare Workers AI (preferred) or falls back to Bedrock.
 * Output goes to a Notion table for operator approval before publish.
 *
 * Usage:
 *   npx tsx scripts/generate-product-descriptions.ts
 *
 * Prerequisites:
 *   - CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (Workers AI)
 *   - MEILI_HOST + MEILI_SEARCH_KEY (for reindexing after approval)
 *
 * Fallback: BEDROCK_MODEL_ID if Workers AI credentials not available.
 */

import type { StoreProduct } from "@/lib/store-products";
import { getProducts } from "@/lib/store-products";

const REGION = process.env.AWS_REGION || "us-east-1";
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const MODEL_ID = process.env.BEDROCK_PRD_DESC_MODEL_ID || "us.amazon.nova-micro-v1:0";
const CF_MODEL = process.env.WORKERS_AI_PRD_DESC_MODEL || "@cf/meta/llama-3.1-8b-instruct";

type AiResult = {
  errors?: Array<{ message?: string }>;
};

async function generateWithWorkersAI(prompt: string): Promise<string> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error("Workers AI credentials not configured");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as AiResult;
    throw new Error(`Workers AI failed: ${response.status} ${data.errors?.[0]?.message ?? "unknown"}`);
  }

  const result = await response.json();
  return result.result?.response ?? "";
}

async function generateWithBedrock(prompt: string): Promise<string> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
  
  const client = new BedrockRuntimeClient({ region: REGION });
  const body = JSON.stringify({
    prompt,
    max_tokens: 250,
    temperature: 0.7,
  });

  const res = await client.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    })
  );

  const text = new TextDecoder().decode(res.body as Uint8Array);
  const parsed = JSON.parse(text) as {
    results?: Array<{ text?: string }>;
    error?: string;
  };
  return parsed.results?.[0]?.text ?? "";
}

const SYSTEM_PROMPT = `You are a product copywriter for Cloudless.gr, a Cloudflare-native SaaS company.
Generate clear, compelling product descriptions (3-5 sentences) that:
- Explain what the product/service delivers
- Mention key benefits for the target customer (startups/SMBs)
- Include a subtle call-to-action

Tone: professional but approachable, technical but not salesy.
Format: plain text (no markdown formatting).`;

interface GeneratedDescription {
  productId: string;
  product: string;
  generated: string;
  status: "draft";
}

async function generateDescriptionForProduct(product: StoreProduct): Promise<string> {
  const prompt = `${SYSTEM_PROMPT}\n\nProduct: ${product.name}\nCategory: ${product.category}\nCurrent description: ${product.description}`;

  // Try Workers AI first
  if (CF_ACCOUNT_ID && CF_API_TOKEN) {
    return generateWithWorkersAI(prompt);
  }

  // Fallback to Bedrock
  return generateWithBedrock(prompt);
}

async function main(): Promise<void> {
  console.log("Fetching products...");
  const products = await getProducts();

  console.log(`Generating descriptions for ${products.length} products...\n`);

  const results: GeneratedDescription[] = [];

  for (const product of products) {
    console.log(`- ${product.name} (${product.id})...`);

    try {
      const generated = await generateDescriptionForProduct(product);

      results.push({
        productId: product.id,
        product: product.name,
        generated,
        status: "draft",
      });

      console.log(`  Generated (${generated.length} chars)\n`);
    } catch (err) {
      console.error(`  Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\n--- RESULTS ---\n");
  console.log(JSON.stringify(results, null, 2));

  console.log("\n--- NEXT STEPS ---");
  console.log("1. Review generated descriptions above");
  console.log("2. Copy approved descriptions into Notion product database");
  console.log("3. Run reindex: curl -X POST /api/admin/search/reindex -H 'x-cron-secret: ...'");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { generateDescriptionForProduct };