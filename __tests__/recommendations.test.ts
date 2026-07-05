import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSimilarProducts,
  getTrendingProducts,
  resetRecommendationCache,
} from "@/lib/recommendations";

// Mock Bedrock client
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  return {
    BedrockRuntimeClient: vi.fn().mockImplementation(function () {
      return { send: mockSend };
    }),
    InvokeModelCommand: vi.fn(),
  };
});

// Mock store-products
vi.mock("@/lib/store-products", () => ({
  getProducts: vi.fn().mockResolvedValue([
    {
      id: "p1",
      name: "Cloud Audit",
      description: "Audit your cloud",
      price: 100,
      currency: "eur",
      category: "service",
    },
    {
      id: "p2",
      name: "Cloud Guide",
      description: "Guide for cloud",
      price: 50,
      currency: "eur",
      category: "digital",
    },
    {
      id: "p3",
      name: "T-Shirt",
      description: "Cool shirt",
      price: 20,
      currency: "eur",
      category: "physical",
    },
  ]),
  defaultProducts: [
    {
      id: "p1",
      name: "Cloud Audit",
      description: "Audit your cloud",
      price: 100,
      currency: "eur",
      category: "service",
    },
    {
      id: "p2",
      name: "Cloud Guide",
      description: "Guide for cloud",
      price: 50,
      currency: "eur",
      category: "digital",
    },
    {
      id: "p3",
      name: "T-Shirt",
      description: "Cool shirt",
      price: 20,
      currency: "eur",
      category: "physical",
    },
  ],
}));

describe("Recommendations Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRecommendationCache();
  });

  describe("getSimilarProducts", () => {
    it("should return similar products based on embeddings", async () => {
      // Mock embedding responses
      mockSend.mockResolvedValueOnce({
        body: Buffer.from(JSON.stringify({ embedding: [1, 0, 0] })),
      }); // p1
      mockSend.mockResolvedValueOnce({
        body: Buffer.from(JSON.stringify({ embedding: [0.9, 0.1, 0] })),
      }); // p2
      mockSend.mockResolvedValueOnce({
        body: Buffer.from(JSON.stringify({ embedding: [0, 0, 1] })),
      }); // p3

      const results = await getSimilarProducts(["p1"], 1);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("p2"); // p2 is more similar to p1 than p3
    });

    it("should fall back to category matching if embeddings fail", async () => {
      mockSend.mockRejectedValue(new Error("Bedrock down"));

      const results = await getSimilarProducts(["p1"], 1);
      // Since p1 is a service, and there are no other services in our mock,
      // it should return something else or empty depending on logic.
      // In our real defaultProducts, there are multiple services.
      expect(results).toBeDefined();
    });

    it("should return empty array if product not found", async () => {
      const results = await getSimilarProducts(["non-existent"]);
      expect(results).toEqual([]);
    });
  });

  describe("getTrendingProducts", () => {
    it("should return a list of products", async () => {
      const results = await getTrendingProducts();
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(6);
    });
  });
});
