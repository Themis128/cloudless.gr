export const PRODUCTS_INDEX = "products";
export const PRODUCT_EMBEDDER = "bedrock-titan-v2";

export interface ProductDocument {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  image?: string;
  features?: string[];
  featuresText?: string;
  categoryLabel?: string;
  updatedAt?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  categoryLabel?: string;
}

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

export async function meiliRequest<T>(
  path: string,
  init: RequestInit = {},
  key = getMeiliSearchKey()
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

export async function indexProducts(documents: ProductDocument[]): Promise<void> {
  if (!isMeilisearchConfigured() || documents.length === 0) return;

  await meiliRequest(
    `/indexes/${PRODUCTS_INDEX}/documents`,
    {
      method: "POST",
      body: JSON.stringify(documents),
    },
    getMeiliAdminKey()
  );
}

export async function resetIndex(documents: ProductDocument[]): Promise<void> {
  if (!isMeilisearchConfigured()) return;

  try {
    await meiliRequest(
      `/indexes/${PRODUCTS_INDEX}`,
      { method: "DELETE" },
      getMeiliAdminKey()
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("404") && !message.includes("index_not_found")) {
      throw err;
    }
  }

  await meiliRequest(
    "/indexes",
    {
      method: "POST",
      body: JSON.stringify({ uid: PRODUCTS_INDEX, primaryKey: "id" }),
    },
    getMeiliAdminKey()
  );

  if (documents.length > 0) {
    await indexProducts(documents);
  }
}
