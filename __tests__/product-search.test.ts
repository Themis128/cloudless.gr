import { describe, expect, it, vi } from "vitest";

vi.mock("langsmith/traceable", () => ({
  traceable: (fn: unknown) => fn,
}));

vi.mock("@/lib/bedrock-embeddings", () => ({
  BEDROCK_EMBED_DIMENSIONS: 512,
  embedTextWithTitan: vi.fn(async () => [0.1, 0.2, 0.3]),
}));

vi.mock("@/lib/meilisearch", () => ({
  PRODUCT_EMBEDDER: "bedrock-titan-v2",
  PRODUCTS_INDEX: "products",
  getMeiliAdminKey: () => "",
  isMeilisearchConfigured: () => false,
  meiliRequest: vi.fn(),
}));

vi.mock("@/lib/store-products", () => ({
  getProducts: async () => [
    {
      id: "analytics-starter",
      name: "Analytics Starter",
      category: "analytics",
      description: "Athena dashboards and Stripe reporting for SMB teams.",
      price: 490,
      currency: "EUR",
      features: ["Athena dashboards", "Stripe reporting", "weekly insights"],
    },
    {
      id: "serverless-audit",
      name: "Serverless Audit",
      category: "infrastructure",
      description: "Review Lambda, DynamoDB, Cognito, and deployment posture.",
      price: 790,
      currency: "EUR",
      features: ["AWS Lambda review", "DynamoDB cost check"],
    },
    {
      id: "ai-growth-pack",
      name: "AI Growth Pack",
      category: "ai",
      description: "Product copy, search intent, and campaign recommendations.",
      price: 990,
      currency: "EUR",
      features: ["GenAI copy", "recommendations", "semantic search"],
    },
  ],
}));

import {
  productToSearchDocument,
  productToSearchText,
  searchProductsFallback,
} from "@/lib/product-search";

describe("R21 product search baseline", () => {
  it("builds searchable text from name, category, description, and features", () => {
    const text = productToSearchText({
      id: "ai-growth-pack",
      name: "AI Growth Pack",
      category: "ai",
      description: "Campaign recommendations.",
      price: 990,
      currency: "EUR",
      features: ["GenAI copy", "semantic search"],
    } as never);

    expect(text).toContain("AI Growth Pack");
    expect(text).toContain("ai");
    expect(text).toContain("Campaign recommendations.");
    expect(text).toContain("GenAI copy semantic search");
  });

  it("maps products to search documents with encoded store hrefs", () => {
    const doc = productToSearchDocument({
      id: "serverless audit",
      name: "Serverless Audit",
      category: "infrastructure",
      description: "AWS posture review.",
      price: 790,
      currency: "EUR",
      features: [],
    } as never);

    expect(doc).toMatchObject({
      id: "serverless audit",
      name: "Serverless Audit",
      category: "infrastructure",
      description: "AWS posture review.",
      price: "790",
      href: "/store/serverless%20audit",
    });

    expect(doc.text).toContain("Serverless Audit");
    expect(doc.text).toContain("infrastructure");
  });

  it("fallback search matches product features and descriptions", async () => {
    const hits = await searchProductsFallback("semantic", 8);

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      id: "ai-growth-pack",
      name: "AI Growth Pack",
      category: "ai",
    });
  });

  it("fallback search respects the result limit", async () => {
    const hits = await searchProductsFallback("report", 1);

    expect(hits).toHaveLength(1);
  });

  it("fallback search returns an empty list when there are no matches", async () => {
    const hits = await searchProductsFallback("nonexistent-query", 8);

    expect(hits).toEqual([]);
  });
});
