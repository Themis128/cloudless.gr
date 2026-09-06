import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isPixelReady, trackPixelEvent, generateEventId, PIXEL_ID } from "@/lib/meta-pixel";

describe("PIXEL_ID", () => {
  it("is a string (empty when env var not set)", () => {
    expect(typeof PIXEL_ID).toBe("string");
  });
});

describe("isPixelReady", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false on server (window undefined)", () => {
    const original = globalThis.window;
    Object.defineProperty(globalThis, "window", { value: undefined, configurable: true });
    expect(isPixelReady()).toBe(false);
    Object.defineProperty(globalThis, "window", { value: original, configurable: true });
  });

  it("returns false when fbq is not a function", () => {
    vi.stubGlobal("window", { fbq: undefined });
    expect(isPixelReady()).toBe(false);
  });

  it("returns true when fbq is a function", () => {
    vi.stubGlobal("window", { fbq: vi.fn() });
    expect(isPixelReady()).toBe(true);
  });
});

describe("trackPixelEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a no-op when pixel not ready", () => {
    vi.stubGlobal("window", { fbq: undefined });
    expect(() => trackPixelEvent("Lead")).not.toThrow();
  });

  it("calls fbq with eventName and params when ready", () => {
    const fbq = vi.fn();
    vi.stubGlobal("window", { fbq });
    trackPixelEvent("Lead", { value: 10, currency: "EUR" });
    expect(fbq).toHaveBeenCalledWith("track", "Lead", { value: 10, currency: "EUR" }, undefined);
  });

  it("includes eventID when provided", () => {
    const fbq = vi.fn();
    vi.stubGlobal("window", { fbq });
    trackPixelEvent("Contact", {}, "evt-123");
    expect(fbq).toHaveBeenCalledWith("track", "Contact", {}, { eventID: "evt-123" });
  });

  it("handles fbq throwing without crashing", () => {
    const fbq = vi.fn(() => { throw new Error("fbq error"); });
    vi.stubGlobal("window", { fbq });
    expect(() => trackPixelEvent("Lead")).not.toThrow();
  });
});

describe("generateEventId", () => {
  it("starts with the given prefix", () => {
    const id = generateEventId("lead");
    expect(id.startsWith("lead-")).toBe(true);
  });

  it("includes extra parts", () => {
    const id = generateEventId("purchase", "user-42", 500);
    expect(id).toContain("user-42");
    expect(id).toContain("500");
  });

  it("generates unique ids on each call", () => {
    const a = generateEventId("evt");
    const b = generateEventId("evt");
    expect(a).not.toBe(b);
  });
});
