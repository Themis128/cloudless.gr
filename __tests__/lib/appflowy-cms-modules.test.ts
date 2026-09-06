/**
 * Combined tests for AppFlowy CMS modules that all follow the same pattern:
 * return empty/null when AppFlowy is not configured.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
  listWorkspaceViews: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockResolvedValue(null),
  extractDocText: vi.fn().mockResolvedValue(""),
  markdownToHtml: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));

import { getCaseStudies, getFeaturedCaseStudies, getCaseStudyBySlug } from "@/lib/appflowy-case-studies";
import { getFaqs, getFaqsByCategory, getAllFaqsAdmin } from "@/lib/appflowy-faqs";
import { getServices } from "@/lib/appflowy-services";
import { getTestimonials, getFeaturedTestimonials } from "@/lib/appflowy-testimonials";
import { listEditorialPosts, findEditorialPost } from "@/lib/appflowy-blog-admin";

describe("appflowy-case-studies (not configured)", () => {
  it("getCaseStudies returns []", async () => expect(await getCaseStudies()).toEqual([]));
  it("getFeaturedCaseStudies returns []", async () => expect(await getFeaturedCaseStudies()).toEqual([]));
  it("getCaseStudyBySlug returns null", async () => expect(await getCaseStudyBySlug("slug")).toBeNull());
});

describe("appflowy-faqs (not configured)", () => {
  it("getFaqs returns []", async () => expect(await getFaqs()).toEqual([]));
  it("getFaqsByCategory returns []", async () => expect(await getFaqsByCategory("general")).toEqual([]));
  it("getAllFaqsAdmin returns an array (may be static fallback)", async () => expect(Array.isArray(await getAllFaqsAdmin())).toBe(true));
});

describe("appflowy-services (not configured)", () => {
  it("getServices returns [] or non-empty static fallback", async () => {
    const result = await getServices();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("appflowy-testimonials (not configured)", () => {
  it("getTestimonials returns []", async () => expect(await getTestimonials()).toEqual([]));
  it("getFeaturedTestimonials returns []", async () => expect(await getFeaturedTestimonials()).toEqual([]));
});

describe("appflowy-blog-admin (not configured)", () => {
  it("listEditorialPosts returns []", async () => expect(await listEditorialPosts()).toEqual([]));
  it("findEditorialPost returns null", async () => expect(await findEditorialPost("slug")).toBeNull());
});
