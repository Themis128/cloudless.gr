export type CalendarItemType =
  "social_post" | "email_campaign" | "blog_post" | "consultation" | "ad_campaign";

export type CalendarPlatform =
  "meta" | "linkedin" | "tiktok" | "x" | "google" | "activecampaign" | "notion" | "google_calendar";

export interface CalendarItem {
  id: string;
  title: string;
  type: CalendarItemType;
  platform: CalendarPlatform;
  date: string;
  endDate?: string;
  status: "draft" | "scheduled" | "published" | "cancelled";
  url?: string;
  notes?: string;
  postizPostIds?: string[];
  workspaceId?: string;
}

export const CALENDAR_ITEM_COLORS: Record<CalendarItemType, string> = {
  social_post: "#e879f9",
  email_campaign: "#a855f7",
  blog_post: "#22d3ee",
  consultation: "#4ade80",
  ad_campaign: "#fb923c",
};

export const PLATFORM_LABELS: Record<CalendarPlatform, string> = {
  meta: "Meta",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  x: "X",
  google: "Google Ads",
  activecampaign: "Email",
  notion: "Blog",
  google_calendar: "Calendar",
};
