import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

interface BudgetResourceSize {
  resourceType: string;
  budget: number;
}

interface BudgetEntry {
  path: string;
  resourceSizes?: BudgetResourceSize[];
}

describe("bundle optimization", () => {
  it("layout.tsx lazy-loads non-critical components via next/dynamic", () => {
    const src = readFileSync(
      path.resolve("src/app/[locale]/layout.tsx"),
      "utf-8",
    );
    expect(src).toContain("next/dynamic");
    expect(src).toContain("ssr: false");
    // These components should no longer be static imports
    expect(src).not.toMatch(/^import CartSlideOver from/m);
    expect(src).not.toMatch(/^import CommandPalette from/m);
    expect(src).not.toMatch(/^import NeonCursor from/m);
    expect(src).not.toMatch(/^import KonamiEasterEgg from/m);
  });

  it("store page lazy-loads StoreGrid via next/dynamic", () => {
    const src = readFileSync(
      path.resolve("src/app/[locale]/store/page.tsx"),
      "utf-8",
    );
    expect(src).toContain("next/dynamic");
    expect(src).not.toMatch(/^import StoreGrid from/m);
  });

  it("lighthouse budget has path-specific script budgets for /contact and /store", () => {
    const budget: BudgetEntry[] = JSON.parse(
      readFileSync(path.resolve(".github/lighthouse-budget.json"), "utf-8"),
    );

    const scriptBudget = (entry: BudgetEntry) =>
      entry.resourceSizes?.find((r) => r.resourceType === "script")?.budget;

    const globalEntry = budget.find((b) => b.path === "/*");
    const contactEntry = budget.find((b) => b.path === "/contact");
    const storeEntry = budget.find((b) => b.path === "/store");

    expect(globalEntry).toBeDefined();
    expect(contactEntry).toBeDefined();
    expect(storeEntry).toBeDefined();

    // Global budget stays at 300 KB
    expect(scriptBudget(globalEntry!)).toBe(300);

    // Route-specific budgets are higher than global to accommodate their weight
    expect(scriptBudget(contactEntry!)).toBeGreaterThan(300);
    expect(scriptBudget(storeEntry!)).toBeGreaterThan(
      scriptBudget(contactEntry!)!,
    );
  });
});
