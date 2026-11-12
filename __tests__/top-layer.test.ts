import { describe, expect, it, vi } from "vitest";
import { requestDialogClose, supportsTopLayerExit } from "@/lib/top-layer";

describe("top-layer helpers", () => {
  it("supportsTopLayerExit is false under jsdom (no real transitions)", () => {
    expect(supportsTopLayerExit()).toBe(false);
  });

  it("requestDialogClose returns false when close() is unavailable", async () => {
    const dialog = {} as HTMLDialogElement;
    await expect(requestDialogClose(dialog)).resolves.toBe(false);
  });

  it("requestDialogClose runs the data-closing fallback then closes", async () => {
    const close = vi.fn();
    const dialog = {
      close,
      setAttribute: vi.fn(),
      hasAttribute: vi.fn(() => true),
      removeAttribute: vi.fn(),
    } as unknown as HTMLDialogElement;

    await expect(requestDialogClose(dialog)).resolves.toBe(true);
    expect(dialog.setAttribute).toHaveBeenCalledWith("data-closing", "");
    expect(dialog.removeAttribute).toHaveBeenCalledWith("data-closing");
    expect(close).toHaveBeenCalledOnce();
  });

  it("requestDialogClose awaits running animations before closing", async () => {
    const close = vi.fn();
    const dialog = {
      close,
      setAttribute: vi.fn(),
      hasAttribute: vi.fn(() => true),
      removeAttribute: vi.fn(),
      getAnimations: () => [{ finished: Promise.resolve() }],
    } as unknown as HTMLDialogElement;

    await expect(requestDialogClose(dialog)).resolves.toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });

  it("requestDialogClose bails if something else closed it mid-animation", async () => {
    const close = vi.fn();
    const dialog = {
      close,
      setAttribute: vi.fn(),
      hasAttribute: vi.fn(() => false),
      removeAttribute: vi.fn(),
      getAnimations: () => [],
    } as unknown as HTMLDialogElement;

    await expect(requestDialogClose(dialog)).resolves.toBe(true);
    expect(close).not.toHaveBeenCalled();
  });
});
