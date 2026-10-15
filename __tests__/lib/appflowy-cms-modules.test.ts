/**
 * Combined tests for AppFlowy CMS modules that all follow the same pattern:
 * return empty/null when AppFlowy is not configured.
 */
import { describe, it, expect, vi } from "vitest";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    isAppFlowyConfigured: vi.fn(),
    listAllWorkspaces: vi.fn(),
    listAllViewsDeep: vi.fn(),
    fetchViewMarkdownMap: vi.fn(),
  },
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: mocks.isAppFlowyConfigured,
  listAllWorkspaces: mocks.listAllWorkspaces,
  listAllViewsDeep: mocks.listAllViewsDeep,
  fetchViewMarkdownMap: mocks.fetchViewMarkdownMap,
  listWorkspaceViews: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockResolvedValue(null),
  extractDocText: vi.fn().mockResolvedValue(""),
  markdownToHtml: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));

import {
  getCaseStudies,
  getFeaturedCaseStudies,
  getCaseStudyBySlug,
} from "@/lib/appflowy-case-studies";
import { getFaqs, getFaqsByCategory, getAllFaqsAdmin } from "@/lib/appflowy-faqs";
import { getServices } from "@/lib/appflowy-services";
import { getTestimonials, getFeaturedTestimonials } from "@/lib/appflowy-testimonials";
import { listEditorialPosts, findEditorialPost } from "@/lib/appflowy-blog-admin";

mocks.isAppFlowyConfigured.mockResolvedValue(false);

describe("appflowy-case-studies (not configured)", () => {
  it("getCaseStudies returns []", async () => expect(await getCaseStudies()).toEqual([]));
  it("getFeaturedCaseStudies returns []", async () =>
    expect(await getFeaturedCaseStudies()).toEqual([]));
  it("getCaseStudyBySlug returns null", async () =>
    expect(await getCaseStudyBySlug("slug")).toBeNull());
});

describe("appflowy-faqs (not configured)", () => {
  it("getFaqs returns []", async () => expect(await getFaqs()).toEqual([]));
  it("getFaqsByCategory returns []", async () =>
    expect(await getFaqsByCategory("general")).toEqual([]));
  it("getAllFaqsAdmin returns an array (may be static fallback)", async () =>
    expect(Array.isArray(await getAllFaqsAdmin())).toBe(true));
});

describe("appflowy-services (not configured)", () => {
  it("getServices returns [] or non-empty static fallback", async () => {
    const result = await getServices();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("appflowy-testimonials (not configured)", () => {
  it("getTestimonials returns []", async () => expect(await getTestimonials()).toEqual([]));
  it("getFeaturedTestimonials returns []", async () =>
    expect(await getFeaturedTestimonials()).toEqual([]));
});

describe("appflowy-blog-admin (not configured)", () => {
  it("listEditorialPosts returns []", async () => expect(await listEditorialPosts()).toEqual([]));
  it("findEditorialPost returns null", async () =>
    expect(await findEditorialPost("slug")).toBeNull());
});

describe("appflowy workspace lookup catches", () => {
  it("getFaqs returns [] when listAllWorkspaces throws", async () => {
    mocks.isAppFlowyConfigured.mockResolvedValueOnce(true);
    mocks.listAllWorkspaces.mockRejectedValueOnce(new Error("appflowy down"));
    await expect(getFaqs()).resolves.toEqual([]);
  });

  it("getTestimonials returns [] when listAllWorkspaces throws", async () => {
    mocks.isAppFlowyConfigured.mockResolvedValueOnce(true);
    mocks.listAllWorkspaces.mockRejectedValueOnce(new Error("appflowy down"));
    await expect(getTestimonials()).resolves.toEqual([]);
  });

  it("getCaseStudyBySlug returns null when the view walk throws", async () => {
    mocks.isAppFlowyConfigured.mockResolvedValue(true);
    mocks.listAllWorkspaces.mockResolvedValue([{ workspace_id: "w1" }]);
    mocks.listAllViewsDeep.mockRejectedValue(new Error("views down"));
    await expect(getCaseStudyBySlug("anything")).resolves.toBeNull();
    mocks.isAppFlowyConfigured.mockResolvedValue(false);
  });
});
