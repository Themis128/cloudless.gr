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
  it("layout.tsx lazy-loads CartSlideOver via next/dynamic", () => {
    const src = readFileSync(
      path.resolve("src/app/[locale]/layout.tsx"),
      "utf-8",
    );
    expect(src).toContain("next/dynamic");
    expect(src).not.toMatch(/^import CartSlideOver from/m);
  });

  it("ClientDecorators lazy-loads CommandPalette, NeonCursor, KonamiEasterEgg", () => {
    const src = readFileSync(
      path.resolve("src/components/ClientDecorators.tsx"),
      "utf-8",
    );
    expect(src).toContain("next/dynamic");
    expect(src).not.toMatch(/^import CommandPalette from/m);
    expect(src).not.toMatch(/^import NeonCursor from/m);
    expect(src).not.toMatch(/^import KonamiEasterEgg from/m);
  });

  it("lighthouse budget covers heaviest route script size", () => {
    const budget: BudgetEntry[] = JSON.parse(
      readFileSync(path.resolve(".github/lighthouse-budget.json"), "utf-8"),
    );

    const globalEntry = budget.find((b) => b.path === "/*");
    expect(globalEntry).toBeDefined();

    const scriptBudget = globalEntry!.resourceSizes?.find(
      (r) => r.resourceType === "script",
    )?.budget;
    // Must cover /store route (~332KB)
    expect(scriptBudget).toBeGreaterThanOrEqual(340);
  });
});
