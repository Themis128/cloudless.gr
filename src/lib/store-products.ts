"use server";

/**
 * Server-side store product functions.
 * Fetches live products from Stripe when configured.
 * 
 * For client-safe types and demo data, import from store-products-client.ts
 * For sync product lookups, also import directly from store-products-client.ts
 */

import { listStripeProducts, type StripeProduct } from "@/lib/stripe";
import {
  type ProductCategory,
  type StoreProduct,
  demoProducts,
} from "@/lib/store-products-client";

// ---------------------------------------------------------------------------
// Live product fetching from Stripe (server-only)
// ---------------------------------------------------------------------------

/** Cache for Stripe products (refreshed every 5 minutes) */
let productCache: { products: StoreProduct[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Map a Stripe product to the store product format.
 * Uses product metadata for category, image, and features.
 *
 * Expected Stripe product metadata keys:
 *   - category: "service" | "digital" | "physical" (default: "service")
 *   - image: URL or path (default: /store/default.svg)
 *   - features: comma-separated list
 */
function mapStripeProduct(sp: StripeProduct): StoreProduct {
  const category = (sp.metadata.category as ProductCategory) || "service";
  const image = sp.metadata.image || sp.images[0] || "/store/default.svg";
  const features = sp.metadata.features
    ? sp.metadata.features.split(",").map((f) => f.trim())
    : undefined;

  return {
    id: sp.id,
    name: sp.name,
    description: sp.description ?? "",
    price: sp.defaultPrice?.unitAmount ?? 0,
    currency: (sp.defaultPrice?.currency ?? "EUR").toLowerCase(),
    category,
    image,
    features,
    recurring: sp.defaultPrice?.recurring != null,
    interval: sp.defaultPrice?.recurring?.interval as "month" | "year" | undefined,
  };
}

/**
 * Get all store products. Tries Stripe first, falls back to demo data.
 * Results are cached for 5 minutes.
 * SERVER-ONLY function.
 */
export async function getProducts(): Promise<StoreProduct[]> {
  // Return cache if fresh
  if (productCache && Date.now() - productCache.fetchedAt < CACHE_TTL_MS) {
    return productCache.products;
  }

  // Try fetching from Stripe
  const stripeProducts = await listStripeProducts();

  if (stripeProducts && stripeProducts.length > 0) {
    const mapped = stripeProducts.map(mapStripeProduct);
    productCache = { products: mapped, fetchedAt: Date.now() };
    return mapped;
  }

  // Fall back to demo data
  productCache = { products: demoProducts, fetchedAt: Date.now() };
  return demoProducts;
}

// ---------------------------------------------------------------------------
// Product lookups (use live data when available)
// ---------------------------------------------------------------------------

/**
 * Get a product by ID, checking cache first.
 * SERVER-ONLY function.
 */
export async function getProductByIdAsync(id: string): Promise<StoreProduct | undefined> {
  const products = await getProducts();
  return products.find((p) => p.id === id);
}

/**
 * Get products by category, checking cache first.
 * SERVER-ONLY function.
 */
export async function getProductsByCategoryAsync(
  category: ProductCategory,
): Promise<StoreProduct[]> {
  const products = await getProducts();
  return products.filter((p) => p.category === category);
}

// NOTE: For client-safe exports (types, demo data, sync functions),
// import directly from @/lib/store-products-client
// Re-exports of non-async functions are not allowed in "use server" files
