import { describe, it, expect } from "vitest";
import {
  CALENDAR_ITEM_COLORS,
  PLATFORM_LABELS,
  type CalendarItemType,
  type CalendarPlatform,
} from "@/lib/calendar-shared";

const ITEM_TYPES: CalendarItemType[] = [
  "social_post", "email_campaign", "blog_post", "consultation", "ad_campaign",
];

const PLATFORMS: CalendarPlatform[] = [
  "meta", "linkedin", "tiktok", "x", "google", "activecampaign", "notion", "google_calendar",
];

describe("CALENDAR_ITEM_COLORS", () => {
  it("has a color for every item type", () => {
    for (const type of ITEM_TYPES) {
      const color = CALENDAR_ITEM_COLORS[type];
      expect(typeof color).toBe("string");
      expect(color.startsWith("#")).toBe(true);
    }
  });
});

describe("PLATFORM_LABELS", () => {
  it("has a label for every platform", () => {
    for (const platform of PLATFORMS) {
      expect(typeof PLATFORM_LABELS[platform]).toBe("string");
      expect(PLATFORM_LABELS[platform].length).toBeGreaterThan(0);
    }
  });
});
