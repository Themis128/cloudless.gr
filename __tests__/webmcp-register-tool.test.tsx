// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import WebMCPProvider from "@/components/WebMCPProvider";

afterEach(() => {
  cleanup();
  delete (document as unknown as Record<string, unknown>).modelContext;
  delete (window as unknown as Record<string, unknown>).modelContext;
});

describe("WebMCPProvider — registerTool draft shape", () => {
  it("registers both tools and aborts them on unmount", () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    (document as unknown as Record<string, unknown>).modelContext = { registerTool };

    const { unmount } = render(<WebMCPProvider />);

    expect(registerTool).toHaveBeenCalledTimes(2);
    const names = registerTool.mock.calls.map(
      (c) => (c[0] as { name: string }).name
    );
    expect(names).toEqual(["book_consultation", "check_availability"]);

    const signal = (registerTool.mock.calls[0][1] as { signal: AbortSignal }).signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);

    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("tolerates registerTool returning void in early Chrome builds", () => {
    const registerTool = vi.fn().mockReturnValue(undefined);
    (document as unknown as Record<string, unknown>).modelContext = { registerTool };

    const { unmount } = render(<WebMCPProvider />);
    expect(registerTool).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("ignores a rejected registerTool promise", () => {
    const registerTool = vi.fn().mockRejectedValue(new Error("not supported"));
    (document as unknown as Record<string, unknown>).modelContext = { registerTool };

    const { unmount } = render(<WebMCPProvider />);
    expect(registerTool).toHaveBeenCalledTimes(2);
    unmount();
  });
});
