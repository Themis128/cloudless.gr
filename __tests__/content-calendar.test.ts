import { describe, it, expect, beforeEach } from "vitest";
import {
  getCalendarItems,
  createCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
} from "@/lib/content-calendar";

// Reset the in-memory store between tests by deleting all items
function clearStore() {
  const all = getCalendarItems();
  all.forEach((item) => deleteCalendarItem(item.id));
}

describe("content-calendar.ts", () => {
  beforeEach(() => {
    clearStore();
  });

  // ── createCalendarItem ───────────────────────────────────────────────────────

  describe("createCalendarItem", () => {
    it("creates an item with a generated id", () => {
      const item = createCalendarItem({
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

    it("persists items in the store", () => {
      createCalendarItem({ title: "A", type: "social_post", platform: "x", date: "2026-05-01", status: "draft" });
      createCalendarItem({ title: "B", type: "email_campaign", platform: "activecampaign", date: "2026-05-02", status: "scheduled" });
      expect(getCalendarItems()).toHaveLength(2);
    });
  });

  // ── getCalendarItems ─────────────────────────────────────────────────────────

  describe("getCalendarItems", () => {
    beforeEach(() => {
      createCalendarItem({ title: "Past", type: "blog_post", platform: "notion", date: "2026-04-01", status: "published" });
      createCalendarItem({ title: "Now", type: "consultation", platform: "google_calendar", date: "2026-05-15", status: "scheduled" });
      createCalendarItem({ title: "Future", type: "ad_campaign", platform: "google", date: "2026-06-01", status: "draft" });
    });

    it("returns all items when no range provided", () => {
      expect(getCalendarItems()).toHaveLength(3);
    });

    it("filters by from date", () => {
      const result = getCalendarItems("2026-05-01");
      expect(result).toHaveLength(2);
      expect(result.every((i) => i.date >= "2026-05-01")).toBe(true);
    });

    it("filters by to date", () => {
      const result = getCalendarItems(undefined, "2026-05-15");
      expect(result).toHaveLength(2);
    });

    it("filters by both from and to", () => {
      const result = getCalendarItems("2026-05-01", "2026-05-31");
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Now");
    });
  });

  // ── updateCalendarItem ───────────────────────────────────────────────────────

  describe("updateCalendarItem", () => {
    it("updates fields and returns updated item", () => {
      const item = createCalendarItem({ title: "Draft", type: "social_post", platform: "tiktok", date: "2026-05-10", status: "draft" });
      const updated = updateCalendarItem(item.id, { status: "published", title: "Live Post" });
      expect(updated?.status).toBe("published");
      expect(updated?.title).toBe("Live Post");
      expect(updated?.platform).toBe("tiktok");
    });

    it("returns null for non-existent id", () => {
      expect(updateCalendarItem("cal_nonexistent", { status: "cancelled" })).toBeNull();
    });

    it("persists updates in the store", () => {
      const item = createCalendarItem({ title: "Old", type: "social_post", platform: "meta", date: "2026-05-01", status: "draft" });
      updateCalendarItem(item.id, { title: "New" });
      const stored = getCalendarItems().find((i) => i.id === item.id);
      expect(stored?.title).toBe("New");
    });
  });

  // ── deleteCalendarItem ───────────────────────────────────────────────────────

  describe("deleteCalendarItem", () => {
    it("removes item and returns true", () => {
      const item = createCalendarItem({ title: "To Delete", type: "social_post", platform: "x", date: "2026-05-01", status: "draft" });
      expect(deleteCalendarItem(item.id)).toBe(true);
      expect(getCalendarItems()).toHaveLength(0);
    });

    it("returns false for non-existent id", () => {
      expect(deleteCalendarItem("cal_ghost")).toBe(false);
    });
  });
});
