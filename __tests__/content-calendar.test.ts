import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCalendarItems,
  createCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
} from "@/lib/content-calendar";

// Simulate Notion not configured so tests use the in-memory fallback
vi.mock("@/lib/notion-calendar", () => ({
  notionGetCalendarItems: vi.fn().mockResolvedValue(null),
  notionCreateCalendarItem: vi.fn().mockResolvedValue(null),
  notionUpdateCalendarItem: vi.fn().mockResolvedValue(false),
  notionDeleteCalendarItem: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: vi.fn().mockResolvedValue({}),
  isConfiguredAsync: vi.fn().mockResolvedValue(false),
  isConfigured: vi.fn().mockReturnValue(false),
  getIntegrations: vi.fn().mockReturnValue({}),
  resetIntegrationCacheAsync: vi.fn(),
}));

// Reset the in-memory store between tests
async function clearStore() {
  const all = await getCalendarItems();
  for (const item of all) {
    await deleteCalendarItem(item.id);
  }
}

describe("content-calendar.ts", () => {
  beforeEach(async () => {
    await clearStore();
  });

  // ── createCalendarItem ───────────────────────────────────────────────────────

  describe("createCalendarItem", () => {
    it("creates an item with a generated id", async () => {
      const item = await createCalendarItem({
        title: "Post about AI",
        type: "social_post",
        platform: "linkedin",
        date: "2026-05-01",
        status: "draft",
      });
      expect(item.id).toMatch(/^cal_/);
      expect(item.title).toBe("Post about AI");
      expect(item.platform).toBe("linkedin");
    });

    it("persists items in the store", async () => {
      await createCalendarItem({ title: "A", type: "social_post", platform: "x", date: "2026-05-01", status: "draft" });
      await createCalendarItem({ title: "B", type: "email_campaign", platform: "activecampaign", date: "2026-05-02", status: "scheduled" });
      expect(await getCalendarItems()).toHaveLength(2);
    });
  });

  // ── getCalendarItems ─────────────────────────────────────────────────────────

  describe("getCalendarItems", () => {
    beforeEach(async () => {
      await createCalendarItem({ title: "Past", type: "blog_post", platform: "notion", date: "2026-04-01", status: "published" });
      await createCalendarItem({ title: "Now", type: "consultation", platform: "google_calendar", date: "2026-05-15", status: "scheduled" });
      await createCalendarItem({ title: "Future", type: "ad_campaign", platform: "google", date: "2026-06-01", status: "draft" });
    });

    it("returns all items when no range provided", async () => {
      expect(await getCalendarItems()).toHaveLength(3);
    });

    it("filters by from date", async () => {
      const result = await getCalendarItems("2026-05-01");
      expect(result).toHaveLength(2);
      expect(result.every((i) => i.date >= "2026-05-01")).toBe(true);
    });

    it("filters by to date", async () => {
      const result = await getCalendarItems(undefined, "2026-05-15");
      expect(result).toHaveLength(2);
    });

    it("filters by both from and to", async () => {
      const result = await getCalendarItems("2026-05-01", "2026-05-31");
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Now");
    });
  });

  // ── updateCalendarItem ───────────────────────────────────────────────────────

  describe("updateCalendarItem", () => {
    it("updates fields and returns updated item", async () => {
      const item = await createCalendarItem({ title: "Draft", type: "social_post", platform: "tiktok", date: "2026-05-10", status: "draft" });
      const updated = await updateCalendarItem(item.id, { status: "published", title: "Live Post" });
      expect(updated?.status).toBe("published");
      expect(updated?.title).toBe("Live Post");
      expect(updated?.platform).toBe("tiktok");
    });

    it("returns null for non-existent id", async () => {
      expect(await updateCalendarItem("cal_nonexistent", { status: "cancelled" })).toBeNull();
    });

    it("persists updates in the store", async () => {
      const item = await createCalendarItem({ title: "Old", type: "social_post", platform: "meta", date: "2026-05-01", status: "draft" });
      await updateCalendarItem(item.id, { title: "New" });
      const stored = (await getCalendarItems()).find((i) => i.id === item.id);
      expect(stored?.title).toBe("New");
    });
  });

  // ── deleteCalendarItem ───────────────────────────────────────────────────────

  describe("deleteCalendarItem", () => {
    it("removes item and returns true", async () => {
      const item = await createCalendarItem({ title: "To Delete", type: "social_post", platform: "x", date: "2026-05-01", status: "draft" });
      expect(await deleteCalendarItem(item.id)).toBe(true);
      expect(await getCalendarItems()).toHaveLength(0);
    });

    it("returns false for non-existent id", async () => {
      expect(await deleteCalendarItem("cal_ghost")).toBe(false);
    });
  });
});
