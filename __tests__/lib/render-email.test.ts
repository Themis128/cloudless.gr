import { describe, it, expect, vi } from "vitest";

vi.mock("react-email", () => ({
  render: vi.fn(async (_element: unknown, opts?: { plainText?: boolean }) => {
    return opts?.plainText ? "Plain text content" : "<p>HTML content</p>";
  }),
}));

import { renderEmail } from "@/lib/render-email";
import type { FC } from "react";

const MockEmailComponent: FC<{ name: string }> = ({ name }) => `Hello ${name}` as unknown as ReturnType<FC>;

describe("renderEmail", () => {
  it("returns html and text strings", async () => {
    const result = await renderEmail(MockEmailComponent, { name: "Alice" });
    expect(typeof result.html).toBe("string");
    expect(typeof result.text).toBe("string");
    expect(result.html.length).toBeGreaterThan(0);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("html is different from text", async () => {
    const result = await renderEmail(MockEmailComponent, { name: "Bob" });
    expect(result.html).not.toBe(result.text);
  });
});
