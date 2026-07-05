/**
 * Search index synchronisation — syncs the product catalog to Meilisearch.
 *
 * Used by:
 *   - The admin reindex endpoint (POST /api/admin/search/reindex)
 *   - Stripe webhook handler (index on product create/update)
 *   - Initial bootstrapping script
 *
 * Converts StoreProduct[] → ProductDocument[] and calls indexProducts().
 */

import {
  indexProducts,
  resetIndex,
  type SearchResult,
  type ProductDocument,
} from "@/lib/meilisearch";
import { getProducts, type StoreProduct } from "@/lib/store-products";

/** Category labels for search facets */
export const CATEGORY_LABELS: Record<string, string> = {
  service: "Services",
  digital: "Digital Products",
  physical: "Merch & Physical",
};

/**
 * Convert a StoreProduct to a Meilisearch ProductDocument.
 */
export function toProductDocument(product: StoreProduct): ProductDocument {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    currency: product.currency,
    category: product.category,
    image: product.image,
    features: product.features,
    featuresText: (product.features ?? []).join(", "),
    categoryLabel: CATEGORY_LABELS[product.category] ?? product.category,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Full sync — reads all products from the store catalog and indexes them.
 * Clears the index first then re-populates.
 */
export async function syncAllProducts(): Promise<{
  indexed: number;
  configured: boolean;
}> {
  const products = await getProducts();

  if (products.length === 0) {
    return { indexed: 0, configured: false };
  }

  const documents = products.map(toProductDocument);
  await resetIndex(documents);

  return { indexed: documents.length, configured: true };
}

/**
 * Incremental sync — adds or updates specific products in the index.
 */
export async function syncProductsByIds(ids: string[]): Promise<number> {
  const allProducts = await getProducts();
  const toIndex = allProducts.filter((p) => ids.includes(p.id));

  if (toIndex.length === 0) return 0;

  const documents = toIndex.map(toProductDocument);
  await indexProducts(documents);

  return documents.length;
}

export type { SearchResult, ProductDocument };
