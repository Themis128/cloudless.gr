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
  it("layout.tsx lazy-loads CartSlideOver via the ClientCartSlideOver boundary", () => {
    // layout.tsx is a Server Component, so the ssr:false dynamic() boundary for
    // CartSlideOver lives in the ClientCartSlideOver client wrapper (PR #481,
    // fixes a React #418 hydration crash in prod). The layout must use that
    // wrapper and never statically import the heavy CartSlideOver directly.
    const layout = readFileSync(path.resolve("src/app/[locale]/layout.tsx"), "utf-8");
    expect(layout).toContain("ClientCartSlideOver");
    expect(layout).not.toMatch(/^import CartSlideOver from/m);

    // The optimization itself: CartSlideOver is still code-split via next/dynamic
    // with ssr:false in the client wrapper.
    const wrapper = readFileSync(path.resolve("src/components/ClientCartSlideOver.tsx"), "utf-8");
    expect(wrapper).toContain("next/dynamic");
    expect(wrapper).toMatch(/dynamic\(\(\) => import\("@\/components\/store\/CartSlideOver"\)/);
    expect(wrapper).toContain("ssr: false");
  });

  it("ClientDecorators lazy-loads CommandPalette, NeonCursor, KonamiEasterEgg", () => {
    const src = readFileSync(path.resolve("src/components/ClientDecorators.tsx"), "utf-8");
    expect(src).toContain("next/dynamic");
    expect(src).not.toMatch(/^import CommandPalette from/m);
    expect(src).not.toMatch(/^import NeonCursor from/m);
    expect(src).not.toMatch(/^import KonamiEasterEgg from/m);
  });

  it("lighthouse budget has timing entries for all routes", () => {
    const budget: BudgetEntry[] = JSON.parse(
      readFileSync(path.resolve(".github/lighthouse-budget.json"), "utf-8")
    );

    // resourceSizes are intentionally omitted — LHCI v12 resource-summary
    // audit returns undefined (known bug). Bundle sizes are enforced by the
    // separate Bundle Budget Audit workflow instead.
    const globalEntry = budget.find((b) => b.path === "/*");
    expect(globalEntry).toBeDefined();
    if (!globalEntry) throw new Error("globalEntry missing");
    expect(globalEntry.timings).toBeDefined();
    expect(globalEntry.timings?.length).toBeGreaterThan(0);

    const storeEntry = budget.find((b) => b.path === "/*store*");
    expect(storeEntry).toBeDefined();
    if (!storeEntry) throw new Error("storeEntry missing");
    expect(storeEntry.timings).toBeDefined();
  });
});
