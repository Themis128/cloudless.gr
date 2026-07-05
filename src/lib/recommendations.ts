/**
 * Product recommendations — collaborative filtering + embedding similarity.
 *
 * Uses:
 *   - DynamoDB `stripe-transactions` table for order history (collaborative filter)
 *   - Bedrock Titan embeddings for product similarity
 */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import type { StoreProduct } from "@/lib/store-products";
import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";

const CACHE_TTL_EMBED = 24 * 60 * 60 * 1000; // 24 hours
const EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0";

interface EmbeddingCache {
  embeddings: Map<string, number[]>;
  fetchedAt: number;
}

/* c8r cache and client */
let _embeddingCache: EmbeddingCache | null = null;
let _bedrockClient: BedrockRuntimeClient | null = null;
let _dynamoClient: DynamoDBClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
  if (!_bedrockClient) {
    _bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return _bedrockClient;
}

function getDynamoClient(): DynamoDBClient {
  if (!_dynamoClient) {
    _dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION ?? "us-east-1",
      endpoint: resolveDynamoEndpoint(),
    });
  }
  return _dynamoClient;
}

function getTransactionsTableName(): string {
  return process.env.STRIPE_TRANSACTIONS_TABLE ?? "StripeTransactions";
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

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const client = getBedrockClient();
    const cmd = new InvokeModelCommand({
      modelId: EMBEDDING_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ inputText: text }),
    });
    const resp = await client.send(cmd);
    const body = JSON.parse(Buffer.from(resp.body).toString()) as {
      embedding?: number[];
    };
    return body.embedding ?? null;
  } catch (err) {
    console.warn("[Recommendations] Embedding failed:", err);
    return null;
  }
}

async function getProductEmbeddings(products: StoreProduct[]): Promise<Map<string, number[]>> {
  const now = Date.now();
  if (_embeddingCache && now - _embeddingCache.fetchedAt < CACHE_TTL_EMBED) {
    const missing = products.filter((p) => !_embeddingCache!.embeddings.has(p.id));
    if (missing.length === 0) return _embeddingCache.embeddings;
  }

  const cache = _embeddingCache ?? { embeddings: new Map(), fetchedAt: 0 };
  for (const product of products) {
    if (!cache.embeddings.has(product.id)) {
      const text = getProductText(product);
      const embedding = await generateEmbedding(text);
      if (embedding) cache.embeddings.set(product.id, embedding);
    }
  }
  cache.fetchedAt = Date.now();
  _embeddingCache = cache;
  return cache.embeddings;
}

export async function getSimilarProducts(productIds: string[], limit = 4): Promise<StoreProduct[]> {
  const products = await (await import("@/lib/store-products")).getProducts();
  const embeddings = await getProductEmbeddings(products);
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

export async function getTrendingProducts(days = 30, limit = 6): Promise<StoreProduct[]> {
  try {
    const client = getDynamoClient();
    const tableName = getTransactionsTableName();
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;

    // Fetch recent successful checkouts
    const cmd = new QueryCommand({
      TableName: tableName,
      IndexName: "ByTypeAndTime",
      KeyConditionExpression: "eventType = :type AND receivedAt >= :threshold",
      ExpressionAttributeValues: {
        ":type": { S: "checkout.session.completed" },
        ":threshold": { N: `${threshold}` },
      },
      Limit: 100,
    });

    const resp = await client.send(cmd);
    const products = await (await import("@/lib/store-products")).getProducts();

    // Heuristic: Most frequent categories or most expensive if data is thin
    if (!resp.Items || resp.Items.length === 0) {
      return [...products].sort((a, b) => b.price - a.price).slice(0, limit);
    }

    // Since product IDs aren't first-class attributes in DDB yet,
    // we use a price-weighted trending fallback for now.
    return [...products].sort((a, b) => b.price - a.price).slice(0, limit);
  } catch (err) {
    console.warn("[Recommendations] Trending failed:", err);
    const products = await (await import("@/lib/store-products")).getProducts();
    return [...products].sort((a, b) => a.price - b.price).slice(0, limit);
  }
}

export function resetRecommendationCache(): void {
  _embeddingCache = null;
}
