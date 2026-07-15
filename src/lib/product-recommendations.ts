import { getProducts, type StoreProduct } from "@/lib/store-products";
import type { ProductOrderSignal } from "@/lib/product-recommendation-signals";

function normalize(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().trim() : "";
}

function featureTokens(product: StoreProduct): Set<string> {
  const rawFeatures = Array.isArray(product.features) ? product.features : [];

  return new Set(
    rawFeatures
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  );
}

function sharedFeatureScore(a: StoreProduct, b: StoreProduct): number {
  const aTokens = featureTokens(a);
  const bTokens = featureTokens(b);

  let score = 0;

  for (const token of aTokens) {
    if (bTokens.has(token)) score += 1;
  }

  return score;
}

export interface ProductRecommendationOptions {
  signals?: ProductOrderSignal[];
}

function coPurchaseScore(
  productId: string,
  relatedProductId: string,
  signals: ProductOrderSignal[] = [],
): number {
  return signals
    .filter((signal) => signal.productId === productId && signal.relatedProductId === relatedProductId)
    .reduce((sum, signal) => sum + signal.count, 0);
}

export async function recommendProductsForProduct(
  productId: string,
  limit = 3,
  options: ProductRecommendationOptions = {},
): Promise<StoreProduct[]> {
  const products = await getProducts();
  const current = products.find((product) => product.id === productId);

  if (!current) return [];

  const currentCategory = normalize(current.category);

  return products
    .filter((product) => product.id !== productId)
    .map((product) => {
      const sameCategory = normalize(product.category) === currentCategory ? 10 : 0;
      const sharedFeatures = sharedFeatureScore(current, product);
      const coPurchased = coPurchaseScore(productId, product.id, options.signals);

      return {
        product,
        score: sameCategory + sharedFeatures + coPurchased,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, Math.max(1, Math.min(limit, 8)))
    .map((item) => item.product);
}
