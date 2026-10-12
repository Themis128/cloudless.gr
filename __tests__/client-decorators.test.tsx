/**
 * ClientDecorators mounts the client-only decorator layer — the four
 * lazy children are stubbed at the module boundary.
 *
 * @vitest-environment jsdom
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("@/components/ThemePreferenceSync", () => ({
  default: () => <div data-testid="theme-sync" />,
}));
vi.mock("@/components/LenisInitializer", () => ({
  default: () => <div data-testid="lenis" />,
}));
vi.mock("@/components/CommandPalette", () => ({
  default: () => <div data-testid="palette" />,
}));
vi.mock("@/components/NeonCursor", () => ({
  default: () => <div data-testid="cursor" />,
}));
vi.mock("@/components/KonamiEasterEgg", () => ({
  default: () => <div data-testid="konami" />,
}));

import ClientDecorators from "@/components/ClientDecorators";

describe("ClientDecorators", () => {
  it("mounts the full client decorator stack", async () => {
    const c = render(<ClientDecorators />).container;
    // dynamic() children resolve asynchronously
    await vi.waitFor(() => {
      expect(c.querySelector('[data-testid="lenis"]')).not.toBeNull();
      expect(c.querySelector('[data-testid="palette"]')).not.toBeNull();
      expect(c.querySelector('[data-testid="cursor"]')).not.toBeNull();
      expect(c.querySelector('[data-testid="konami"]')).not.toBeNull();
    });
    expect(c.querySelector('[data-testid="theme-sync"]')).not.toBeNull();
  });
});
