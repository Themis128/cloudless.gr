import { traceable } from "langsmith/traceable";

import { getProducts, type StoreProduct } from "@/lib/store-products";
import { BEDROCK_EMBED_DIMENSIONS, embedTextWithTitan } from "@/lib/bedrock-embeddings";
import {
  PRODUCT_EMBEDDER,
  PRODUCTS_INDEX,
  getMeiliAdminKey,
  isMeilisearchConfigured,
  meiliRequest,
} from "@/lib/meilisearch";

const SEARCH_TRACE_METADATA = {
  app: "cloudless.gr",
  feature: "R21-search",
  searchBackend: "meilisearch",
  embeddingProvider: "aws-bedrock",
  embeddingModel: "amazon.titan-embed-text-v2:0",
  runtime: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "unknown",
};

const tracedEmbedTextWithTitan = traceable(embedTextWithTitan, {
  name: "cloudless_bedrock_titan_embedding",
  run_type: "chain",
  metadata: SEARCH_TRACE_METADATA,
});

export interface ProductSearchDocument {
  id: string;
  name: string;
  category: string;
  description: string;
  price?: string;
  href: string;
  text: string;
  _vectors?: Record<string, number[]>;
}

export interface ProductSearchHit {
  id: string;
  name: string;
  category: string;
  description: string;
  price?: string;
  href: string;
  _rankingScore?: number;
  _semanticScore?: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function productHref(id: string): string {
  return `/store/${encodeURIComponent(id)}`;
}

export function productToSearchText(product: StoreProduct): string {
  const p = asRecord(product);
  const parts = [
    str(p.name),
    str(p.category),
    str(p.description),
    Array.isArray(p.features) ? p.features.join(" ") : "",
  ];

  return parts.filter(Boolean).join("\n");
}

export function productToSearchDocument(product: StoreProduct): ProductSearchDocument {
  const p = asRecord(product);
  const id = str(p.id);

  return {
    id,
    name: str(p.name),
    category: str(p.category),
    description: str(p.description),
    price: str(p.price) || undefined,
    href: productHref(id),
    text: productToSearchText(product),
  };
}


interface MeiliTaskResponse {
  taskUid?: number;
  uid?: number;
  status?: string;
  error?: {
    message?: string;
    code?: string;
  } | null;
}

function meiliTaskUid(task: MeiliTaskResponse): number | undefined {
  return task.taskUid ?? task.uid;
}

async function waitForMeiliTask(uid: number | undefined): Promise<void> {
  if (uid === undefined) return;

  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    const task = await meiliRequest<MeiliTaskResponse>(
      `/tasks/${uid}`,
      {},
      getMeiliAdminKey(),
    );

    if (task.status === "succeeded") return;

    if (task.status === "failed" || task.status === "canceled") {
      throw new Error(
        `Meilisearch task ${uid} ${task.status}: ${task.error?.message ?? "unknown error"}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for Meilisearch task ${uid}`);
}

async function deleteProductsIndexIfExists(): Promise<void> {
  try {
    const task = await meiliRequest<MeiliTaskResponse>(
      `/indexes/${PRODUCTS_INDEX}`,
      { method: "DELETE" },
      getMeiliAdminKey(),
    );

    await waitForMeiliTask(meiliTaskUid(task));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (!message.includes("404") && !message.includes("index_not_found")) {
      throw err;
    }
  }
}

async function createProductsIndex(): Promise<void> {
  try {
    const task = await meiliRequest<MeiliTaskResponse>(
      "/indexes",
      {
        method: "POST",
        body: JSON.stringify({
          uid: PRODUCTS_INDEX,
          primaryKey: "id",
        }),
      },
      getMeiliAdminKey(),
    );

    await waitForMeiliTask(meiliTaskUid(task));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (!message.includes("409") && !message.includes("index_already_exists")) {
      throw err;
    }
  }
}


export async function ensureProductsSearchIndex(): Promise<void> {
  const task = await meiliRequest<MeiliTaskResponse>(
    `/indexes/${PRODUCTS_INDEX}/settings`,
    {
      method: "PATCH",
      body: JSON.stringify({
        searchableAttributes: ["name", "description", "category", "text"],
        displayedAttributes: ["id", "name", "category", "description", "price", "href"],
        filterableAttributes: ["category"],
        sortableAttributes: ["name"],
        embedders: {
          [PRODUCT_EMBEDDER]: {
            source: "userProvided",
            dimensions: BEDROCK_EMBED_DIMENSIONS,
          },
        },
      }),
    },
    getMeiliAdminKey(),
  );

  await waitForMeiliTask(meiliTaskUid(task));
}

export async function reindexProductsWithEmbeddings(): Promise<{
  indexed: number;
  taskUid?: number;
}> {
  if (!isMeilisearchConfigured()) {
    throw new Error("Meilisearch is not configured");
  }

  await deleteProductsIndexIfExists();
  await createProductsIndex();
  await ensureProductsSearchIndex();

  const products = await getProducts();

  const docs = await Promise.all(
    products.map(async (product) => {
      const doc = productToSearchDocument(product);
      const embedding = await tracedEmbedTextWithTitan(doc.text || doc.name);

      return {
        ...doc,
        _vectors: {
          [PRODUCT_EMBEDDER]: embedding,
        },
      };
    }),
  );

  const task = await meiliRequest<MeiliTaskResponse>(
    `/indexes/${PRODUCTS_INDEX}/documents`,
    {
      method: "POST",
      body: JSON.stringify(docs),
    },
    getMeiliAdminKey(),
  );

  const uid = meiliTaskUid(task);
  await waitForMeiliTask(uid);

  return {
    indexed: docs.length,
    taskUid: uid,
  };
}

async function searchProductsWithMeiliCore(
  query: string,
  limit = 8,
): Promise<ProductSearchHit[]> {
  const vector = await tracedEmbedTextWithTitan(query);

  const res = await meiliRequest<{ hits?: ProductSearchHit[] }>(
    `/indexes/${PRODUCTS_INDEX}/search`,
    {
      method: "POST",
      body: JSON.stringify({
        q: query,
        limit,
        vector,
        hybrid: {
          embedder: PRODUCT_EMBEDDER,
          semanticRatio: 0.55,
        },
        attributesToRetrieve: ["id", "name", "category", "description", "price", "href"],
        showRankingScore: true,
      }),
    },
  );

  return res.hits ?? [];
}

const tracedSearchProductsWithMeili = traceable(searchProductsWithMeiliCore, {
  name: "cloudless_meilisearch_hybrid_product_search",
  run_type: "chain",
  metadata: {
    ...SEARCH_TRACE_METADATA,
    mode: "hybrid",
  },
});

export async function searchProductsWithMeili(
  query: string,
  limit = 8,
): Promise<ProductSearchHit[]> {
  return tracedSearchProductsWithMeili(query, limit);
}

async function searchProductsFallbackCore(
  query: string,
  limit = 8,
): Promise<ProductSearchHit[]> {
  const q = query.toLowerCase();
  const products = await getProducts();

  return products
    .map(productToSearchDocument)
    .filter((p) =>
      [p.name, p.category, p.description, p.text].join(" ").toLowerCase().includes(q),
    )
    .slice(0, limit);
}

const tracedSearchProductsFallback = traceable(searchProductsFallbackCore, {
  name: "cloudless_product_search_fallback",
  run_type: "chain",
  metadata: {
    ...SEARCH_TRACE_METADATA,
    mode: "fallback",
  },
});

export async function searchProductsFallback(
  query: string,
  limit = 8,
): Promise<ProductSearchHit[]> {
  return tracedSearchProductsFallback(query, limit);
}
