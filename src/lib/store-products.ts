/**
 * Server-side store product functions.
 * Loads live products from Stripe and caches results for a short window.
 */

import { listStripeProducts, type StripeProduct } from "@/lib/stripe";
import type {
  ProductCategory,
  StoreProduct,
} from "@/lib/store-products-client";

let productCache: { products: StoreProduct[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeCategory(category: string | undefined): ProductCategory {
  if (
    category === "digital" ||
    category === "physical" ||
    category === "service"
  ) {
    return category;
  }
  return "service";
}

function mapStripeProduct(sp: StripeProduct): StoreProduct {
  const category = normalizeCategory(sp.metadata.category);
  const image = sp.metadata.image || sp.images[0] || "/store/default.svg";
  const features = sp.metadata.features
    ? sp.metadata.features
        .split(",")
        .map((feature) => feature.trim())
        .filter(Boolean)
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
    interval: sp.defaultPrice?.recurring?.interval as
      | "month"
      | "year"
      | undefined,
  };
}

export async function getProducts(): Promise<StoreProduct[]> {
  if (productCache && Date.now() - productCache.fetchedAt < CACHE_TTL_MS) {
    return productCache.products;
  }

  try {
    const stripeProducts = await listStripeProducts();
    const mappedProducts = stripeProducts.map(mapStripeProduct);

    productCache = { products: mappedProducts, fetchedAt: Date.now() };
    return mappedProducts;
  } catch (error) {
    // Missing Stripe credentials in local/dev should not flood logs or break rendering.
    const message = error instanceof Error ? error.message : "Unknown error";
    const isMissingStripeKey = message.includes("STRIPE_SECRET_KEY is not set");

    if (!isMissingStripeKey && process.env.NODE_ENV !== "test") {
      console.warn("[Store] Failed to load products from Stripe.", error);
    }

    productCache = { products: [], fetchedAt: Date.now() };
    return [];
  }
}

export async function getProductByIdAsync(
  id: string,
): Promise<StoreProduct | undefined> {
  const products = await getProducts();
  return products.find((product) => product.id === id);
}

export async function getProductsByCategoryAsync(
  category: ProductCategory,
): Promise<StoreProduct[]> {
  const products = await getProducts();
  return products.filter((product) => product.category === category);
}
