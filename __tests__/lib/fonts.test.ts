import { describe, it, expect, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: vi.fn((opts: { variable: string }) => ({
    variable: opts.variable,
    className: `font-${opts.variable.replace("--font-", "")}`,
  })),
}));

import { instrumentSans, workSans, geistMono } from "@/lib/fonts";

describe("fonts", () => {
  it("instrumentSans has the correct CSS variable", () => {
    expect(instrumentSans.variable).toBe("--font-instrument-sans");
  });

  it("workSans has the correct CSS variable", () => {
    expect(workSans.variable).toBe("--font-work-sans");
  });

  it("geistMono has the correct CSS variable", () => {
    expect(geistMono.variable).toBe("--font-geist-mono");
  });

  it("all fonts expose a className", () => {
    expect(typeof instrumentSans.className).toBe("string");
    expect(typeof workSans.className).toBe("string");
    expect(typeof geistMono.className).toBe("string");
  });
});
