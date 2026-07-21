/**
 * Admin — AI product description generator (R21d)
 *
 * POST /api/admin/ai/product-descriptions
 *   Body: { productIds?: string[] }   — omit to generate for all products
 *   Returns: { results: GeneratedDescription[], errors: ErrorEntry[] }
 *
 * PUT /api/admin/ai/product-descriptions
 *   Body: { descriptions: { id: string; description: string }[] }
 *   Applies operator-approved descriptions to the in-process product cache
 *   (Stripe metadata update is fire-and-forget when STRIPE_SECRET_KEY is set).
 *   Returns: { applied: number }
 *
 * Workers AI primary (free, fast), Gemini fallback (configured).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getProducts } from "@/lib/store-products";
import type { StoreProduct } from "@/lib/store-products";
import { callGemini } from "@/lib/gemini-admin";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_TOKENS = 300;
const MAX_PRODUCT_IDS = 20;

// Workers AI binding interface
interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

interface AiEnv {
  AI: AiBinding;
}

function getAiBinding(): AiBinding | null {
  return (process.env as unknown as AiEnv).AI ?? null;
}

const WORKERS_AI_CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedDescription {
  id: string;
  name: string;
  description: string;
}

interface ErrorEntry {
  id: string;
  error: string;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(product: StoreProduct): string {
  const priceEur = `€${(product.price / 100).toFixed(2)} ${product.currency.toUpperCase()}`;
  const features = (product.features ?? []).join(", ");
  return [
    "You are a conversion copywriter for Cloudless.gr, a cloud consulting and AI-powered digital marketing agency.",
    "Write a compelling product description for the following offering.",
    "",
    `Product: ${product.name}`,
    `Category: ${product.category}`,
    `Price: ${priceEur}`,
    `Features: ${features}`,
    `Current description: ${product.description}`,
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
// Single-product generation via Workers AI (primary) + Gemini (fallback)
// ---------------------------------------------------------------------------

async function generateOneWorkersAI(product: StoreProduct): Promise<string | null> {
  const ai = getAiBinding();
  if (!ai) return null;

  try {
    const result = (await ai.run(WORKERS_AI_CHAT_MODEL, {
      messages: [{ role: "user", content: buildPrompt(product) }],
    })) as { response?: string };
    return result.response ?? null;
  } catch (err) {
    const safeErr = err instanceof Error ? err.message.replace(/%/g, "") : String(err).replace(/[\x00-\x1F\x7F]/g, "");
    console.warn("[ai/product-descriptions] Workers AI failed, falling back to Gemini:", safeErr);
    return null;
  }
}

async function generateOneGemini(product: StoreProduct): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const prompt = buildPrompt(product);
  return callGemini(prompt, apiKey, MAX_TOKENS);
}

async function generateOne(product: StoreProduct): Promise<string> {
  // Try Workers AI first
  const workersResult = await generateOneWorkersAI(product);
  if (workersResult) return workersResult;

  // Fall back to Gemini
  return generateOneGemini(product);
}

// ---------------------------------------------------------------------------
// POST — generate descriptions
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let productIds: string[] | undefined;
  try {
    const body = (await request.json()) as { productIds?: unknown };
    if (Array.isArray(body.productIds)) {
      productIds = body.productIds
        .filter((id): id is string => typeof id === "string")
        .slice(0, MAX_PRODUCT_IDS);
    }
  } catch {
    // No body or invalid JSON — generate for all products
  }

  const allProducts = await getProducts();
  const targets = productIds ? allProducts.filter((p) => productIds!.includes(p.id)) : allProducts;

  if (targets.length === 0) {
    return NextResponse.json({ error: "No matching products found." }, { status: 400 });
  }

  const results: GeneratedDescription[] = [];
  const errors: ErrorEntry[] = [];

  // Generate sequentially to avoid rate limiting
  for (const product of targets) {
    try {
      const description = await generateOne(product);
      results.push({ id: product.id, name: product.name, description });
    } catch (err) {
      errors.push({
        id: product.id,
        error: err instanceof Error ? err.message : String(err),
      });
      const safeId = String(product.id).replace(/[\x00-\x1F\x7F]/g, "");
      const safeErr = err instanceof Error ? err.message : String(err).replace(/[\x00-\x1F\x7F]/g, "");
      console.error(`[ai/product-descriptions] Failed for ${safeId}:`, safeErr);
    }
  }

  return NextResponse.json({ results, errors });
}

// ---------------------------------------------------------------------------
// PUT — apply operator-approved descriptions
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let descriptions: { id: string; description: string }[];
  try {
    const body = (await request.json()) as { descriptions?: unknown };
    if (!Array.isArray(body.descriptions) || body.descriptions.length === 0) {
      throw new Error("descriptions array is required");
    }
    descriptions = (body.descriptions as { id: unknown; description: unknown }[])
      .filter(
        (d): d is { id: string; description: string } =>
          typeof d.id === "string" && typeof d.description === "string"
      )
      .slice(0, MAX_PRODUCT_IDS)
      .map((d) => ({ id: d.id, description: d.description.slice(0, 500) }));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 }
    );
  }

  // Apply to the in-process product cache by patching the cached products.
  const allProducts = await getProducts();
  let applied = 0;
  for (const { id, description } of descriptions) {
    const product = allProducts.find((p) => p.id === id);
    if (product) {
      product.description = description;
      applied++;
    }
  }

  // Fire-and-forget: update Stripe product metadata when configured.
  updateStripeDescriptions(descriptions).catch((err) => {
    const safeErr = err instanceof Error ? err.message : String(err).replace(/[\x00-\x1F\x7F]/g, "");
    console.warn("[ai/product-descriptions] Stripe metadata update failed:", safeErr);
  });

  return NextResponse.json({ applied });
}

// ---------------------------------------------------------------------------
// Stripe metadata update (fire-and-forget)
// ---------------------------------------------------------------------------

async function updateStripeDescriptions(
  descriptions: { id: string; description: string }[]
): Promise<void> {
  const { getStripe } = await import("@/lib/stripe");
  const stripe = await getStripe();
  if (!stripe) return;

  await Promise.allSettled(
    descriptions.map(({ id, description }) =>
      stripe.products.update(id, { description }).catch((err) => {
        const safeId = String(id).replace(/[\x00-\x1F\x7F]/g, "");
        const safeErr = err instanceof Error ? err.message : String(err).replace(/[\x00-\x1F\x7F]/g, "");
        console.warn(`[ai/product-descriptions] Stripe update failed for ${safeId}:`, safeErr);
      })
    )
  );
}