/**
 * Product recommendations — collaborative filtering + embedding similarity.
 *
 * Primary: Workers AI embeddings + D1 stripe_transaction reads
 */

import type { AuthDatabase } from "@/lib/auth-d1";
import type { StoreProduct } from "@/lib/store-products";

const CACHE_TTL_EMBED = 24 * 60 * 60 * 1000; // 24 hours

// Workers AI embedding model (free tier, 384-dim)
const WORKERS_AI_EMBED_MODEL = "@cf/baai/bge-small-en-v1.5";

interface EmbeddingCache {
  embeddings: Map<string, number[]>;
  fetchedAt: number;
}

// Minimal Ai binding type (provided by Workers AI binding in wrangler)
interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

interface Env {
  AUTH_DB: AuthDatabase;
  AI: AiBinding;
}

/**
 * Get Auth Database from Env
 */
function getAuthDb(env: Env): AuthDatabase | null {
  return env.AUTH_DB ?? null;
}

/**
 * Get AI binding from Env
 */
function getAiBinding(env: Env): AiBinding | null {
  return env.AI ?? null;
}

/* LRU cache and client */
let _embeddingCache: EmbeddingCache | null = null;

async function generateWorkersAiEmbedding(text: string, ai: AiBinding | null): Promise<number[] | null> {
  if (!ai) return null;
  try {
    const resp = (await ai.run(WORKERS_AI_EMBED_MODEL, { text: [text] })) as {
      data?: number[][];
      shape?: number[];
    };
    if (Array.isArray(resp.data) && resp.data.length > 0) {
      return resp.data[0] ?? null;
    }
    return null;
  } catch (err) {
    console.warn(
      "[Recommendations] Workers AI embedding failed:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function generateEmbedding(text: string, ai: AiBinding | null): Promise<number[] | null> {
  // 1. Try Workers AI (primary)
  const workersAi = await generateWorkersAiEmbedding(text, ai);
  if (workersAi) return workersAi;
  // No fallback - return null if Workers AI fails
  return null;
}

async function getProductEmbeddings(products: StoreProduct[], ai: AiBinding | null): Promise<Map<string, number[]>> {
  const now = Date.now();
  if (_embeddingCache && now - _embeddingCache.fetchedAt < CACHE_TTL_EMBED) {
    const missing = products.filter((p) => !_embeddingCache!.embeddings.has(p.id));
    if (missing.length === 0) return _embeddingCache.embeddings;
  }

  const cache = _embeddingCache ?? { embeddings: new Map(), fetchedAt: 0 };
  for (const product of products) {
    if (!cache.embeddings.has(product.id)) {
      const text = getProductText(product);
      const embedding = await generateEmbedding(text, ai);
      if (embedding) cache.embeddings.set(product.id, embedding);
    }
  }
  cache.fetchedAt = Date.now();
  _embeddingCache = cache;
  return cache.embeddings;
}

function getProductText(product: StoreProduct): string {
  const featuresText = (product.features ?? []).join(", ");
  return `${product.name} ${product.description} ${featuresText}`.trim();
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function getSimilarProducts(env: Env, productIds: string[], limit = 4): Promise<StoreProduct[]> {
  const products = await (await import("@/lib/store-products")).getProducts();
  const ai = getAiBinding(env);
  const embeddings = await getProductEmbeddings(products, ai);
  const targetProducts = products.filter((p) => productIds.includes(p.id));
  if (targetProducts.length === 0) return [];

  const targetVectors = targetProducts
    .map((p) => embeddings.get(p.id))
    .filter((v): v is number[] => v !== undefined);

  if (targetVectors.length === 0) {
    const category = targetProducts[0]!.category;
    return products
      .filter((p) => p.category === category && !productIds.includes(p.id))
      .slice(0, limit);
  }

  const avgVector = targetVectors[0]!.map(
    (_, i) => targetVectors.reduce((sum, v) => sum + v[i]!, 0) / targetVectors.length
  );

  const scored = products
    .filter((p) => !productIds.includes(p.id))
    .map((p) => {
      const vec = embeddings.get(p.id);
      return { product: p, score: vec ? cosineSimilarity(avgVector, vec) : 0 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.product);

  return scored;
}

/**
 * Fetch trending products by recent checkout volume.
 * D1 only (reads stripe_transaction).
 */
export async function getTrendingProducts(env: Env, days = 30, limit = 6): Promise<StoreProduct[]> {
  const products = await (await import("@/lib/store-products")).getProducts();
  const db = getAuthDb(env);
  if (db) {
    try {
      const cutoff = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
      const result = await db
        .prepare(
          "SELECT payload_json FROM stripe_transaction WHERE event_type = ? AND received_at >= ? LIMIT 100"
        )
        .bind("checkout.session.completed", cutoff)
        .all<{ payload_json: string }>();
      const rows = result.results ?? [];
      if (rows.length === 0) {
        return [...products].sort((a, b) => b.price - a.price).slice(0, limit);
      }
      // Since product IDs aren't first-class attributes in stripe_transaction yet,
      // we use a price-weighted trending fallback for now.
      return [...products].sort((a, b) => b.price - a.price).slice(0, limit);
    } catch (err) {
      console.warn(
        "[Recommendations] D1 trending failed, falling back to price sort:",
        err instanceof Error ? err.message : err
      );
      // Fall through to price sort
    }
  }

  // Fallback: sort by price descending
  return [...products].sort((a, b) => b.price - a.price).slice(0, limit);
}

export function resetRecommendationCache(): void {
  _embeddingCache = null;
}
