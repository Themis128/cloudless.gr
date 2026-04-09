/**
 * Client-safe store product types and demo data.
 * This file contains no server-side imports or functions.
 */

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
// Category labels and colors for UI
// ---------------------------------------------------------------------------

export const categoryLabels: Record<ProductCategory, string> = {
  service: "Services",
  digital: "Digital Products",
  physical: "Merch & Physical",
};

export const categoryColors: Record<ProductCategory, string> = {
  service: "from-neon-blue/10 to-neon-blue/5",
  digital: "from-neon-cyan/10 to-neon-cyan/5",
  physical: "from-neon-magenta/10 to-neon-magenta/5",
};

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
      "250-page step-by-step guide for migrating enterprise workloads to AWS. Includes battle-tested strategies and checklists.",
    price: 4900,
    currency: "eur",
    category: "digital",
    image: "/store/migration-playbook.svg",
    features: [
      "250+ pages",
      "Real case studies",
      "60+ checklists",
      "Lifetime updates",
      "Email support",
    ],
  },
  {
    id: "dig-analytics-templates",
    name: "Analytics Dashboard Templates",
    description:
      "Production-ready analytics dashboard templates and KPI packs for modern SaaS and e-commerce teams.",
    price: 5900,
    currency: "eur",
    category: "digital",
    image: "/store/analytics-templates.svg",
    features: [
      "Figma + dashboard JSON packs",
      "KPI starter set",
      "Executive summary templates",
      "Lifetime updates",
    ],
  },
  {
    id: "dig-serverless-course",
    name: "Serverless Masterclass",
    description:
      "Video course with hands-on labs. Learn full serverless architecture patterns end-to-end.",
    price: 14900,
    currency: "eur",
    category: "digital",
    image: "/store/serverless-course.svg",
    features: [
      "8 hours of video",
      "40 hands-on labs",
      "Starter template",
      "Community Slack",
      "Certificate",
    ],
  },

  // --- Physical Merch ---
  {
    id: "phy-dev-kit",
    name: "Cloudless Developer Kit",
    description:
      "Limited-edition desk kit with notebook, sticker set, and architecture cheatsheet.",
    price: 3500,
    currency: "eur",
    category: "physical",
    image: "/store/dev-kit.svg",
    features: ["Notebook", "Sticker pack", "Architecture cheatsheet", "Free shipping EU"],
  },
  {
    id: "phy-tshirt",
    name: "Cloudless T-Shirt",
    description:
      "Premium organic cotton t-shirt with embroidered Cloudless logo. Available in S, M, L, XL, XXL.",
    price: 2500,
    currency: "eur",
    category: "physical",
    image: "/store/tshirt.svg",
    features: ["100% organic cotton", "Embroidered logo", "All sizes", "Free shipping EU"],
  },
];

/**
 * Synchronous product lookup (demo data only — used by checkout for validation)
 */
export function getProductById(id: string): StoreProduct | undefined {
  return demoProducts.find((p) => p.id === id);
}

/**
 * Synchronous category lookup (demo data only)
 */
export function getProductsByCategory(category: ProductCategory): StoreProduct[] {
  return demoProducts.filter((p) => p.category === category);
}
