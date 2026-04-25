import { describe, it, expect, vi, beforeEach } from "vitest";
import { isPixelReady, trackPixelEvent, generateEventId } from "@/lib/meta-pixel";

type WindowWithFbq = { fbq?: unknown };

describe("meta-pixel.ts", () => {
  beforeEach(() => {
    delete (window as unknown as WindowWithFbq).fbq;
  });

  describe("isPixelReady()", () => {
    it("returns false when fbq is not defined", () => {
      expect(isPixelReady()).toBe(false);
    });

    it("returns false when fbq is not a function", () => {
      (window as unknown as WindowWithFbq).fbq = "not-a-function";
      expect(isPixelReady()).toBe(false);
    });

    it("returns true when fbq is a function", () => {
      (window as unknown as WindowWithFbq).fbq = vi.fn();
      expect(isPixelReady()).toBe(true);
    });
  });

  describe("trackPixelEvent()", () => {
    it("does nothing when pixel is not ready", () => {
      expect(() => trackPixelEvent("Lead")).not.toThrow();
    });

    it("calls fbq track with event name and params", () => {
      const fbq = vi.fn();
      (window as unknown as WindowWithFbq).fbq = fbq;
      trackPixelEvent("Lead", { value: 10, currency: "EUR" }, "evt-123");
      expect(fbq).toHaveBeenCalledWith(
        "track",
        "Lead",
        { value: 10, currency: "EUR" },
        { eventID: "evt-123" },
      );
    });

    it("calls fbq without options when no eventId is provided", () => {
      const fbq = vi.fn();
      (window as unknown as WindowWithFbq).fbq = fbq;
      trackPixelEvent("Contact", { content_name: "form" });
      expect(fbq).toHaveBeenCalledWith(
        "track",
        "Contact",
        { content_name: "form" },
        undefined,
      );
    });

    it("defaults to empty params object when none provided", () => {
      const fbq = vi.fn();
      (window as unknown as WindowWithFbq).fbq = fbq;
      trackPixelEvent("Purchase");
      expect(fbq).toHaveBeenCalledWith("track", "Purchase", {}, undefined);
    });
  });

  describe("generateEventId()", () => {
    it("starts with the given prefix", () => {
      const id = generateEventId("lead");
      expect(id.startsWith("lead-")).toBe(true);
    });

    it("includes extra parts in the output", () => {
      const id = generateEventId("order", "user-123", "456");
      expect(id).toContain("user-123");
      expect(id).toContain("456");
    });

    it("generates unique IDs on each call", () => {
      const ids = new Set(Array.from({ length: 30 }, () => generateEventId("test")));
      expect(ids.size).toBe(30);
    });

    it("works with a single prefix and no extra parts", () => {
      const id = generateEventId("evt");
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(5);
    });
  });
});
