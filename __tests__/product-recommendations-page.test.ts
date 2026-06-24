import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("R21 product page recommendations integration", () => {
  it("uses the server-side recommendation helper on product detail pages", () => {
    const body = read("src/app/[locale]/store/[id]/page.tsx");

    expect(body).toContain("recommendProductsForProduct");
    expect(body).toContain("RECOMMENDED NEXT");
    expect(body).not.toContain("getProductsByCategory(product.category)");
  });
});
