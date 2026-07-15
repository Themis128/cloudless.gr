#!/usr/bin/env tsx
/**
 * R21d: GenAI Product Description Generator
 *
 * One-shot script: Bedrock Nova generates description drafts for products.
 * Output goes to a Notion table for operator approval before publish.
 *
 * Usage:
 *   npx tsx scripts/generate-product-descriptions.ts
 *
 * Prerequisites:
 *   - BEDROCK_MODEL_ID (defaults to us.amazon.nova-micro-v1:0)
 *   - MEILI_HOST + MEILI_SEARCH_KEY (for reindexing after approval)
 */

import type { StoreProduct } from "@/lib/store-products";
import { getProducts } from "@/lib/store-products";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID = process.env.BEDROCK_PRD_DESC_MODEL_ID || "us.amazon.nova-micro-v1:0";

function getBedrockClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({ region: REGION });
}

const SYSTEM_PROMPT = `You are a product copywriter for Cloudless.gr, an AWS serverless consulting business.
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
  const client = getBedrockClient();

  const body = JSON.stringify({
    system: [{ text: SYSTEM_PROMPT }],
    messages: [
      {
        role: "user",
        content: [{ text: `Product: ${product.name}\nCategory: ${product.category}\nCurrent description: ${product.description}` }],
      },
    ],
    inferenceConfig: { maxTokens: 250, temperature: 0.7 },
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
  const parsed = JSON.parse(text) as { output?: { message?: { content?: [{ text?: string }[]]? } } };

  return parsed.output?.message?.content?.[0]?.[0]?.text ?? "";
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