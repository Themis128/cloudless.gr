import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/google-calendar", () => ({
  getUpcomingConsultations: vi.fn().mockResolvedValue([]),
}));

import {
  getCalendarItems,
  createCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
  invalidateConsultationCache,
} from "@/lib/content-calendar";

const createdIds: string[] = [];

beforeEach(async () => {
  // Clean up items created in previous tests
  for (const id of createdIds) {
    await deleteCalendarItem(id);
  }
  createdIds.length = 0;
  invalidateConsultationCache();
});

async function create(overrides: Partial<Parameters<typeof createCalendarItem>[0]> = {}) {
  const item = await createCalendarItem({
    title: "Test post",
    type: "blog_post",
    platform: "meta",
    date: "2026-09-10",
    status: "draft",
    ...overrides,
  });
  createdIds.push(item.id);
  return item;
}

describe("createCalendarItem", () => {
  it("assigns a string id prefixed with cal_", async () => {
    const item = await create();
    expect(item.id).toMatch(/^cal_/);
  });

  it("stores provided fields", async () => {
    const item = await create({ title: "My post", date: "2026-09-15" });
    expect(item.title).toBe("My post");
    expect(item.date).toBe("2026-09-15");
    expect(item.type).toBe("blog_post");
  });
});

describe("getCalendarItems", () => {
  it("returns an item after creation", async () => {
    const item = await create({ date: "2026-09-12" });
    const items = await getCalendarItems();
    expect(items.some((i) => i.id === item.id)).toBe(true);
  });

  it("filters by date range", async () => {
    await create({ date: "2026-09-05" });
    const later = await create({ date: "2026-09-20" });
    const items = await getCalendarItems("2026-09-10", "2026-09-30");
    expect(items.some((i) => i.id === later.id)).toBe(true);
    // earlier item is outside the range
    expect(items.find((i) => i.date === "2026-09-05")).toBeUndefined();
  });

  it("filters by workspaceId", async () => {
    const ws = await create({ workspaceId: "ws-test" });
    const other = await create({ workspaceId: "ws-other" });
    const items = await getCalendarItems(undefined, undefined, { workspaceId: "ws-test" });
    expect(items.some((i) => i.id === ws.id)).toBe(true);
    expect(items.some((i) => i.id === other.id)).toBe(false);
  });

  it("returns items without workspaceId regardless of filter", async () => {
    const noWs = await create();
    const items = await getCalendarItems(undefined, undefined, { workspaceId: "ws-any" });
    expect(items.some((i) => i.id === noWs.id)).toBe(true);
  });
});

describe("updateCalendarItem", () => {
  it("updates the title of an existing item", async () => {
    const item = await create({ title: "Original" });
    const updated = await updateCalendarItem(item.id, { title: "Updated" });
    expect(updated?.title).toBe("Updated");
  });

  it("returns null for a non-existent id", async () => {
    const result = await updateCalendarItem("nonexistent-id", { title: "x" });
    expect(result).toBeNull();
  });
});

describe("deleteCalendarItem", () => {
  it("returns true when item was removed", async () => {
    const item = await createCalendarItem({
      title: "To delete",
      type: "blog_post",
      platform: "meta",
      date: "2026-09-10",
      status: "draft",
    });
    const result = await deleteCalendarItem(item.id);
    expect(result).toBe(true);
  });

  it("returns false for a non-existent id", async () => {
    const result = await deleteCalendarItem("ghost-id-xyz");
    expect(result).toBe(false);
  });
});

describe("invalidateConsultationCache", () => {
  it("does not throw", () => {
    expect(() => invalidateConsultationCache()).not.toThrow();
  });
});
