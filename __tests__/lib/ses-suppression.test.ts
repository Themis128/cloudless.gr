import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ses-suppression-d1", () => ({
  addToSuppressionList: vi.fn().mockResolvedValue(false),
  removeFromSuppressionList: vi.fn().mockResolvedValue(false),
  isSuppressed: vi.fn().mockResolvedValue(false),
  getSuppressedEmails: vi.fn().mockResolvedValue([]),
  setD1Binding: vi.fn(),
}));

import {
  addToSuppressionList,
  removeFromSuppressionList,
  isSuppressed,
  getSuppressedEmails,
  setD1Binding,
} from "@/lib/ses-suppression";

describe("ses-suppression re-exports", () => {
  it("addToSuppressionList is a function", () => {
    expect(typeof addToSuppressionList).toBe("function");
  });

  it("removeFromSuppressionList is a function", () => {
    expect(typeof removeFromSuppressionList).toBe("function");
  });

  it("isSuppressed is a function", () => {
    expect(typeof isSuppressed).toBe("function");
  });

  it("getSuppressedEmails is a function", () => {
    expect(typeof getSuppressedEmails).toBe("function");
  });

  it("setD1Binding is a function", () => {
    expect(typeof setD1Binding).toBe("function");
  });

  it("returns false when no D1 binding", async () => {
    expect(await addToSuppressionList("x@y.com")).toBe(false);
    expect(await isSuppressed("x@y.com")).toBe(false);
    expect(await getSuppressedEmails()).toEqual([]);
  });
});
