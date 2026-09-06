/**
 * Tests for appflowy-calendar.ts and appflowy-comments.ts
 * Both are no-op stubs with trivial implementations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// appflowy-calendar
// ---------------------------------------------------------------------------
import {
  getCalendarEvents,
  getPostizGroups,
  syncCalendarEvents,
} from "@/lib/appflowy-calendar";

describe("appflowy-calendar", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("getCalendarEvents returns empty array", async () => {
    await expect(getCalendarEvents()).resolves.toEqual([]);
  });

  it("getPostizGroups returns empty array", async () => {
    await expect(getPostizGroups()).resolves.toEqual([]);
  });

  it("syncCalendarEvents warns and returns false", async () => {
    const result = await syncCalendarEvents();
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("syncCalendarEvents called (no-op)")
    );
  });
});

// ---------------------------------------------------------------------------
// appflowy-comments
// ---------------------------------------------------------------------------
import { listComments, addComment } from "@/lib/appflowy-comments";

describe("appflowy-comments", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("listComments returns empty array", async () => {
    await expect(listComments("page-1")).resolves.toEqual([]);
  });

  it("addComment warns and returns false", async () => {
    const result = await addComment("page-1", "Hello!");
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Would add comment (stub)")
    );
  });
});
