import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("R21 AI baseline wiring", () => {
  it("exposes a public search API route", () => {
    expect(read("src/app/api/search/route.ts")).toContain("GET");
  });

  it("has product search orchestration", () => {
    const body = read("src/lib/product-search.ts");

    expect(body).toContain("reindexProductsWithEmbeddings");
  });

  it("has Meilisearch integration", () => {
    const body = read("src/lib/meilisearch.ts").toLowerCase();

    expect(body).toContain("meili");
  });

  it("has Bedrock embeddings integration", () => {
    const body = read("src/lib/bedrock-embeddings.ts").toLowerCase();

    expect(body).toContain("embedding");
  });

  it("has an admin reindex route", () => {
    const body = read("src/app/api/admin/search/reindex/route.ts");

    expect(body).toContain("reindexProductsWithEmbeddings");
  });
});
