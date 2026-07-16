export const PRODUCTS_INDEX = "products";
export const PRODUCT_EMBEDDER = "bedrock-titan-v2";

export function getMeiliHost(): string {
  return (process.env.MEILI_HOST || "").replace(/\/+$/, "");
}

export function getMeiliAdminKey(): string {
  return process.env.MEILI_ADMIN_KEY || process.env.MEILI_MASTER_KEY || "";
}

export function getMeiliSearchKey(): string {
  return process.env.MEILI_SEARCH_KEY || getMeiliAdminKey();
}

export function isMeilisearchConfigured(): boolean {
  return Boolean(getMeiliHost() && getMeiliSearchKey());
}

// Types and functions used by search-index.ts
export type ProductDocument = {
  id: string;
  name: string;
  description: string;
  price?: number;
  currency?: string;
  category?: string;
  image?: string;
  features?: string[];
  featuresText?: string;
  categoryLabel?: string;
  updatedAt?: string;
};

export type SearchResult = {
  hits: ProductDocument[];
  nbHits: number;
  query?: string;
};

export async function indexProducts(_documents: ProductDocument[]): Promise<void> {
  // Placeholder - actual implementation would call Meilisearch API
  console.warn("[Meilisearch] indexProducts not implemented");
}

export async function resetIndex(_documents: ProductDocument[]): Promise<void> {
  // Placeholder - actual implementation would call Meilisearch API
  console.warn("[Meilisearch] resetIndex not implemented");
}

export async function meiliRequest<T>(
  path: string,
  init: RequestInit = {},
  key = getMeiliSearchKey(),
): Promise<T> {
  const host = getMeiliHost();

  if (!host) {
    throw new Error("MEILI_HOST is not configured");
  }

  if (!key) {
    throw new Error("MEILI_SEARCH_KEY / MEILI_ADMIN_KEY / MEILI_MASTER_KEY is not configured");
  }

  const res = await fetch(`${host}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Meilisearch ${res.status} ${res.statusText}: ${body}`);
  }

  return (await res.json()) as T;
}