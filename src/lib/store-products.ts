/**
 * Store product catalog.
 *
 * Fetches live products from Stripe when configured.
 * Falls back to local demo data when Stripe products aren't set up yet.
 */

import { listStripeProducts, type StripeProduct } from "@/lib/stripe";

export type ProductCategory = "digital" | "physical" | "service";

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price: number; // in cents
  currency: string;
  category: ProductCategory;
  image: string;
  features?: string[];
  recurring?: boolean;
  interval?: "month" | "year";
}

// ---------------------------------------------------------------------------
// Live product fetching from Stripe
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
    interval: sp.defaultPrice?.recurring?.interval as
      | "month"
      | "year"
      | undefined,
  };
}

/**
 * Get all store products. Tries Stripe first, falls back to demo data.
 * Results are cached for 5 minutes.
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

export async function getProductByIdAsync(
  id: string,
): Promise<StoreProduct | undefined> {
  const products = await getProducts();
  return products.find((p) => p.id === id);
}

export async function getProductsByCategoryAsync(
  category: ProductCategory,
): Promise<StoreProduct[]> {
  const products = await getProducts();
  return products.filter((p) => p.category === category);
}

// ---------------------------------------------------------------------------
// Synchronous lookups (demo data only — used by checkout for validation)
// ---------------------------------------------------------------------------

export function getProductById(id: string): StoreProduct | undefined {
  // Check cache first (includes Stripe products if previously fetched)
  if (productCache) {
    return productCache.products.find((p) => p.id === id);
  }
  return demoProducts.find((p) => p.id === id);
}

export function getProductsByCategory(
  category: ProductCategory,
): StoreProduct[] {
  if (productCache) {
    return productCache.products.filter((p) => p.category === category);
  }
  return demoProducts.filter((p) => p.category === category);
}

// ---------------------------------------------------------------------------
// Demo / fallback product catalog
// ---------------------------------------------------------------------------

export const demoProducts: StoreProduct[] = [
  // --- Services ---
  {
    id: "srv-cloud",
    name: "Cloud Architecture Audit",
    description:
      "Comprehensive review of your cloud infrastructure with actionable optimization recommendations. Covers AWS, GCP, and Azure.",
    price: 200000,
    currency: "eur",
    category: "service",
    image: "/store/cloud-audit.svg",
    features: [
      "Full infrastructure review",
      "Cost optimization report",
      "Security assessment",
      "Migration roadmap",
      "1-hour consultation call",
    ],
  },
  {
    id: "srv-serverless",
    name: "Serverless Starter Package",
    description:
      "Get your first serverless application built and deployed. Includes CI/CD pipeline, monitoring, and documentation.",
    price: 240000,
    currency: "eur",
    category: "service",
    image: "/store/serverless-starter.svg",
    features: [
      "Event-driven architecture",
      "AWS Lambda + API Gateway",
      "CI/CD pipeline setup",
      "Monitoring & alerting",
      "Full documentation",
    ],
  },
  {
    id: "srv-analytics",
    name: "Data Analytics & Dashboards",
    description:
      "Custom analytics dashboards and data pipelines to turn your raw data into actionable insights. Includes ETL setup, BI reporting, and real-time monitoring.",
    price: 240000,
    currency: "eur",
    category: "service",
    image: "/store/analytics-dashboards.svg",
    features: [
      "Custom analytics dashboards",
      "ETL pipeline development",
      "Real-time data processing",
      "Business intelligence reporting",
      "Data warehouse design",
    ],
  },
  {
    id: "srv-growth",
    name: "AI Growth Engine",
    description:
      "Monthly AI-powered marketing retainer. SEO, content strategy, paid ads management, and performance reporting.",
    price: 80000,
    currency: "eur",
    category: "service",
    image: "/store/growth-engine.svg",
    features: [
      "AI content strategy",
      "SEO optimization",
      "Paid ads management",
      "Monthly performance report",
      "Dedicated account manager",
    ],
    recurring: true,
    interval: "month",
  },
  // --- Digital Products ---
  {
    id: "dig-cloud-playbook",
    name: "Cloud Migration Playbook",
    description:
      "Step-by-step guide to migrating your infrastructure to the cloud. 120+ pages of battle-tested strategies.",
    price: 4900,
    currency: "eur",
    category: "digital",
    image: "/store/cloud-playbook.svg",
    features: [
      "120+ page PDF guide",
      "Terraform templates",
      "Cost calculator spreadsheet",
      "Migration checklist",
      "Lifetime updates",
    ],
  },
  {
    id: "dig-analytics-templates",
    name: "Analytics Dashboard Templates",
    description:
      "Pre-built dashboard templates for tracking KPIs, marketing metrics, and business intelligence.",
    price: 2900,
    currency: "eur",
    category: "digital",
    image: "/store/analytics-templates.svg",
    features: [
      "10 ready-to-use dashboards",
      "Google Data Studio compatible",
      "Custom metric formulas",
      "Video setup tutorials",
      "Quarterly template updates",
    ],
  },
  {
    id: "dig-serverless-course",
    name: "Serverless Masterclass",
    description:
      "Video course covering serverless architecture from zero to production. 8 modules, 40+ lessons.",
    price: 9900,
    currency: "eur",
    category: "digital",
    image: "/store/serverless-course.svg",
    features: [
      "40+ video lessons",
      "Hands-on projects",
      "Source code included",
      "Community access",
      "Certificate of completion",
    ],
  },
  // --- Physical Products ---
  {
    id: "phy-dev-kit",
    name: "Cloudless Dev Kit",
    description:
      "Premium developer swag box: branded notebook, sticker pack, pen, and a cloud architecture reference card.",
    price: 3500,
    currency: "eur",
    category: "physical",
    image: "/store/dev-kit.svg",
    features: [
      "Premium notebook",
      "Sticker pack (15 stickers)",
      "Branded pen",
      "Architecture reference card",
      "Free shipping in EU",
    ],
  },
  {
    id: "phy-tshirt",
    name: "Cloudless T-Shirt",
    description:
      "Soft cotton developer tee with the Cloudless logo. Available in Navy and White.",
    price: 2500,
    currency: "eur",
    category: "physical",
    image: "/store/tshirt.svg",
    features: [
      "100% organic cotton",
      "Unisex fit",
      "Sizes S-3XL",
      "Embroidered logo",
      "Free shipping in EU",
    ],
  },
];

export const categoryLabels: Record<ProductCategory, string> = {
  service: "Services",
  digital: "Digital Products",
  physical: "Merch & Physical",
};

export const categoryColors: Record<ProductCategory, string> = {
  service: "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20",
  digital: "bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/20",
  physical: "bg-neon-green/10 text-neon-green border border-neon-green/20",
};
