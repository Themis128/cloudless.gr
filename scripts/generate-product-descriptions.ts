/**
 * R21d — GenAI product descriptions via AWS Bedrock Nova.
 *
 * Generates AI-written descriptions for every product in the default catalog,
 * prints them for operator review, and only writes them back to
 * src/lib/store-products.ts when the operator explicitly passes --apply.
 *
 * Usage:
 *   tsx --tsconfig scripts/tsconfig.json scripts/generate-product-descriptions.ts
 *   tsx --tsconfig scripts/tsconfig.json scripts/generate-product-descriptions.ts --apply
 *   tsx --tsconfig scripts/tsconfig.json scripts/generate-product-descriptions.ts --json
 *   tsx --tsconfig scripts/tsconfig.json scripts/generate-product-descriptions.ts --id srv-cloud
 *
 * Environment:
 *   AWS_REGION          — defaults to us-east-1
 *   BEDROCK_MODEL_ID    — defaults to us.amazon.nova-micro-v1:0
 *   NODE_ENV=test       — skips Bedrock, returns stub descriptions (CI)
 */

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, "..");
const PRODUCTS_FILE = resolve(ROOT, "src/lib/store-products.ts");
const REGION = process.env.AWS_REGION ?? "us-east-1";
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "us.amazon.nova-micro-v1:0";
const MAX_TOKENS = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductSummary {
  id: string;
  name: string;
  currentDescription: string;
  features: string[];
  category: string;
  priceEur: string;
}

interface GeneratedDescription {
  id: string;
  name: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Bedrock client (lazy singleton)
// ---------------------------------------------------------------------------

let _client: BedrockRuntimeClient | null = null;
function getClient(): BedrockRuntimeClient {
  _client ??= new BedrockRuntimeClient({ region: REGION });
  return _client;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(product: ProductSummary): string {
  return [
    "You are a conversion copywriter for Cloudless.gr, a cloud consulting and AI-powered digital marketing agency.",
    "Write a compelling product description for the following offering.",
    "",
    `Product: ${product.name}`,
    `Category: ${product.category}`,
    `Price: ${product.priceEur}`,
    `Features: ${product.features.join(", ")}`,
    `Current description: ${product.currentDescription}`,
    "",
    "Rules:",
    "- 1–2 sentences, max 200 characters",
    "- Lead with the primary benefit, not the feature list",
    "- Use active voice and concrete language",
    "- Do NOT repeat the product name in the description",
    "- Do NOT use exclamation marks",
    "- Output ONLY the description text — no quotes, no labels, no markdown",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

async function generateDescription(product: ProductSummary): Promise<string> {
  if (process.env.NODE_ENV === "test") {
    return `[STUB] AI-generated description for ${product.name}.`;
  }

  const client = getClient();
  const cmd = new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: "You are a concise conversion copywriter. Output only the requested text." }],
    messages: [{ role: "user", content: [{ text: buildPrompt(product) }] }],
    inferenceConfig: { maxTokens: MAX_TOKENS, temperature: 0.7 },
  });

  const response = await client.send(cmd);
  const text = (response.output?.message?.content ?? [])
    .filter((b): b is { text: string } => "text" in b && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) throw new Error(`Empty response from Bedrock for product ${product.id}`);
  return text;
}

// ---------------------------------------------------------------------------
// Product extraction from source file
// ---------------------------------------------------------------------------

function extractProducts(source: string): ProductSummary[] {
  // Parse the defaultProducts array from the TS source using regex.
  // This avoids importing the module (which would pull in Stripe/SSM at runtime).
  const productBlocks = source.matchAll(
    /\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?description:\s*"([^"]+)"[\s\S]*?price:\s*(\d+)[\s\S]*?currency:\s*"([^"]+)"[\s\S]*?category:\s*"([^"]+)"[\s\S]*?(?:features:\s*\[([^\]]*)\])?/g
  );

  const products: ProductSummary[] = [];
  for (const match of productBlocks) {
    const [, id, name, description, priceRaw, currency, category, featuresRaw] = match;
    if (!id || !name) continue;

    const priceEur = `€${((Number(priceRaw ?? 0)) / 100).toFixed(2)} ${(currency ?? "eur").toUpperCase()}`;
    const features = (featuresRaw ?? "")
      .split(",")
      .map((f) => f.trim().replace(/^"|"$/g, "").trim())
      .filter(Boolean);

    products.push({
      id: id.trim(),
      name: name.trim(),
      currentDescription: description.trim(),
      features,
      category: category?.trim() ?? "service",
      priceEur,
    });
  }
  return products;
}

// ---------------------------------------------------------------------------
// Apply descriptions back to source file
// ---------------------------------------------------------------------------

function applyDescriptions(source: string, results: GeneratedDescription[]): string {
  let updated = source;
  for (const { id, description } of results) {
    // Replace the description field for the matching product id block.
    // Pattern: after `id: "srv-cloud"` ... find `description: "..."` and replace.
    const escaped = description.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    updated = updated.replace(
      new RegExp(
        `(id:\\s*"${id}"[\\s\\S]*?description:\\s*)"[^"]*"`,
        "m"
      ),
      `$1"${escaped}"`
    );
  }
  return updated;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const applyFlag = args.includes("--apply");
  const jsonFlag = args.includes("--json");
  const idFilter = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;

  const source = readFileSync(PRODUCTS_FILE, "utf8");
  let products = extractProducts(source);

  if (products.length === 0) {
    console.error("No products found in store-products.ts — check the regex.");
    process.exit(1);
  }

  if (idFilter) {
    products = products.filter((p) => p.id === idFilter);
    if (products.length === 0) {
      console.error(`No product found with id "${idFilter}".`);
      process.exit(1);
    }
  }

  if (!jsonFlag) {
    console.error(`\nGenerating descriptions for ${products.length} product(s) via Bedrock ${MODEL_ID}...\n`);
  }

  const results: GeneratedDescription[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const product of products) {
    if (!jsonFlag) process.stderr.write(`  ${product.id} ... `);
    try {
      const description = await generateDescription(product);
      results.push({ id: product.id, name: product.name, description });
      if (!jsonFlag) process.stderr.write("✓\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ id: product.id, error: message });
      if (!jsonFlag) process.stderr.write(`✗ ${message}\n`);
    }
  }

  if (jsonFlag) {
    console.log(JSON.stringify({ results, errors }, null, 2));
    process.exit(errors.length > 0 ? 1 : 0);
  }

  // Human-readable review output
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("  GENERATED DESCRIPTIONS — review before applying");
  console.log("─────────────────────────────────────────────────────────\n");

  for (const { id, name, description } of results) {
    console.log(`[${id}] ${name}`);
    console.log(`  NEW : ${description}`);
    const original = products.find((p) => p.id === id)?.currentDescription ?? "";
    console.log(`  OLD : ${original}`);
    console.log();
  }

  if (errors.length > 0) {
    console.log("─── ERRORS ───────────────────────────────────────────────");
    for (const { id, error } of errors) {
      console.log(`  ${id}: ${error}`);
    }
    console.log();
  }

  if (!applyFlag) {
    console.log("Run with --apply to write these descriptions to store-products.ts.");
    process.exit(errors.length > 0 ? 1 : 0);
  }

  // Apply
  const updated = applyDescriptions(source, results);
  writeFileSync(PRODUCTS_FILE, updated, "utf8");
  console.log(`✓ Applied ${results.length} description(s) to ${PRODUCTS_FILE}`);
  if (errors.length > 0) {
    console.log(`⚠  ${errors.length} product(s) failed — their descriptions were not changed.`);
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
