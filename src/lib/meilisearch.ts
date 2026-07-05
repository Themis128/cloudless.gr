
/** Create or return the cached Meilisearch client. Returns null when not configured. */
export async function getMeiliClient(): Promise<Meilisearch | null> {
  if (_client && Date.now() - _lastConfigCheck < CONFIG_CACHE_TTL_MS) {
    return _client;
  }

  const cfg = await getConfig();
  const host = cfg.MEILI_HOST;
  const key = cfg.MEILI_SEARCH_KEY || cfg.MEILI_MASTER_KEY;

  if (!host || !key) {
    _client = null;
    _lastConfigCheck = Date.now();
    return null;
  }

  _client = new Meilisearch({ host, apiKey: key });
  _lastConfigCheck = Date.now();
  return _client;
}

/** Check if Meilisearch is configured and reachable. */
export async function isMeiliConfigured(): Promise<boolean> {
  const client = await getMeiliClient();
  if (!client) return false;
  try {
    await client.health();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filter?: string;
}

/**
 * Search the products index in Meilisearch.
 * Returns empty results when Meilisearch is not configured.
 */
export async function searchProducts(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const client = await getMeiliClient();
  if (!client) {
    return {
      hits: [],
      total: 0,
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
      query,
      configured: false,
    };
  }

  try {
    const index = client.index(PRODUCTS_INDEX);
    const result = await index.search(query, {
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
      filter: options.filter,
      attributesToHighlight: ["name", "description", "features"],
    });

    const hits: SearchHit[] = (result.hits ?? []).map((hit: Record<string, unknown>) => ({
      id: String(hit.id ?? ""),
      name: String(hit.name ?? ""),
      description: String(hit.description ?? ""),
      price: Number(hit.price) || 0,
      currency: String(hit.currency ?? "eur"),
      category: String(hit.category ?? "service"),
      image: String(hit.image ?? "/store/default.svg"),
      features: Array.isArray(hit.features) ? (hit.features as string[]) : undefined,
      _formatted: hit._formatted as Record<string, string> | undefined,
    }));

    return {
      hits,
      total: result.estimatedTotalHits ?? result.hits?.length ?? 0,
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
      query,
      configured: true,
    };
  } catch (err) {
    console.warn("[Meilisearch] Search failed:", err);
    return {
      hits: [],
      total: 0,
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
      query,
      configured: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Index management (admin operations)
// ---------------------------------------------------------------------------

export interface ProductDocument {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  image: string;
  features?: string[];
  featuresText?: string;
  categoryLabel?: string;
  updatedAt: string;
}

/**
 * Add or update a batch of product documents in the index.
 * Uses the master key for write access. No-ops when not configured.
 */
export async function indexProducts(documents: ProductDocument[]): Promise<void> {
  if (documents.length === 0) return;

  const client = _client;
  if (!client) return;

  const cfg = await getConfig();
  if (!cfg.MEILI_MASTER_KEY) {
    console.warn("[Meilisearch] MEILI_MASTER_KEY not set — cannot index products");
    return;
  }

  const writeClient = new Meilisearch({
    host: cfg.MEILI_HOST,
    apiKey: cfg.MEILI_MASTER_KEY,
  });

  try {
    const index = writeClient.index(PRODUCTS_INDEX);
    await index.updateSearchableAttributes([
      "name", "description", "featuresText", "categoryLabel",
    ]);
    await index.updateFilterableAttributes(["category", "currency", "price"]);
    await index.addDocuments(documents);
    console.log(`[Meilisearch] Indexed ${documents.length} products`);
  } catch (err) {
    console.warn("[Meilisearch] Indexing failed:", err);
  }
}

/**
 * Delete products from the index by their IDs.
 * No-ops when Meilisearch is not configured.
 */
export async function removeProducts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const client = await getMeiliClient();
  if (!client) return;

  const cfg = await getConfig();
  if (!cfg.MEILI_MASTER_KEY) {
    console.warn("[Meilisearch] MEILI_MASTER_KEY not set — cannot remove products");
    return;
  }

  const writeClient = new Meilisearch({
    host: cfg.MEILI_HOST,
    apiKey: cfg.MEILI_MASTER_KEY,
  });

  try {
    await writeClient.index(PRODUCTS_INDEX).deleteDocuments(ids);
    console.log(`[Meilisearch] Removed ${ids.length} products`);
  } catch (err) {
    console.warn("[Meilisearch] Remove failed:", err);
  }
}

/**
 * Clear and re-populate the entire products index.
 * Used during initial setup or full reindex.
 */
export async function resetIndex(documents: ProductDocument[]): Promise<void> {
  const client = _client;
  if (!client) return;

  const cfg = await getConfig();
  if (!cfg.MEILI_MASTER_KEY) {
    console.warn("[Meilisearch] MEILI_MASTER_KEY not set — cannot reset index");
    return;
  }

  const writeClient = new Meilisearch({
    host: cfg.MEILI_HOST,
    apiKey: cfg.MEILI_MASTER_KEY,
  });

  try {
    await writeClient.deleteIndex(PRODUCTS_INDEX).catch(() => {});
    await writeClient.createIndex(PRODUCTS_INDEX, { primaryKey: "id" });
    const index = writeClient.index(PRODUCTS_INDEX);
    await index.updateSearchableAttributes([
      "name", "description", "featuresText", "categoryLabel",
    ]);
    await index.updateFilterableAttributes(["category", "currency", "price"]);
    if (documents.length > 0) {
      await index.addDocuments(documents);
    }
    console.log(`[Meilisearch] Index reset with ${documents.length} products`);
  } catch (err) {
    console.warn("[Meilisearch] Reset index failed:", err);
  }
}
