import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  isAppFlowyConfigured: vi.fn(),
  listAllWorkspaces: vi.fn(),
  listAllViewsDeep: vi.fn(),
  getDocument: vi.fn(),
  extractDocText: vi.fn(),
  markdownToHtml: vi.fn(),
  fetchViewMarkdownMap: vi.fn(),
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: m.isAppFlowyConfigured,
  listAllWorkspaces: m.listAllWorkspaces,
  listAllViewsDeep: m.listAllViewsDeep,
  getDocument: m.getDocument,
  extractDocText: m.extractDocText,
  markdownToHtml: m.markdownToHtml,
  fetchViewMarkdownMap: m.fetchViewMarkdownMap,
}));

import * as blog from "@/lib/appflowy-blog";
import * as docs from "@/lib/appflowy-docs";
import * as studies from "@/lib/appflowy-case-studies";
import * as services from "@/lib/appflowy-services";
import { staticCaseStudies } from "@/lib/cms-static";

const view = (name: string, id = name, edited = "2026-01-02T00:00:00.000Z") => ({
  view_id: id,
  name,
  last_edited_time: edited,
});

function configured(views: ReturnType<typeof view>[]) {
  m.isAppFlowyConfigured.mockResolvedValue(true);
  m.listAllWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
  m.listAllViewsDeep.mockResolvedValue(views);
  m.getDocument.mockResolvedValue({ data: {} });
  m.extractDocText.mockResolvedValue("");
  m.fetchViewMarkdownMap.mockImplementation(async (_ws: string, views: { view_id: string }[]) =>
    new Map(
      await Promise.all(
        views.map(async (v) => {
          try {
            return [v.view_id, await m.extractDocText(await m.getDocument(_ws, v.view_id))] as const;
          } catch {
            return [v.view_id, null] as const;
          }
        })
      )
    )
  );
  m.markdownToHtml.mockResolvedValue("<p>x</p>");
}

beforeEach(() => {
  vi.clearAllMocks();
  configured([]);
});

describe("appflowy-blog", () => {
  it("returns [] when not configured / no workspace", async () => {
    m.isAppFlowyConfigured.mockResolvedValue(false);
    expect(await blog.getPosts()).toEqual([]);
    m.isAppFlowyConfigured.mockResolvedValue(true);
    m.listAllWorkspaces.mockResolvedValue([]);
    expect(await blog.getPosts()).toEqual([]);
    m.listAllWorkspaces.mockRejectedValue(new Error("x"));
    expect(await blog.getPosts()).toEqual([]);
  });

  it("maps [Blog]/[Review] pages, sorts by edited desc, tolerates doc failures", async () => {
    configured([
      view("[Blog] First Post!", "v1", "2026-01-01"),
      view("[Review] Second Post", "v2", "2026-02-01"),
      view("Not a post", "v3"),
    ]);
    m.extractDocText.mockRejectedValue(new Error("doc fail"));
    const posts = await blog.getPosts();
    expect(posts).toHaveLength(2);
    expect(posts[0].slug).toBe("second-post");
    expect(posts[0].published).toBe(false);
    expect(posts[1].slug).toBe("first-post");
    expect(posts[1].published).toBe(true);
    expect(posts[0].html).toBe("");
  });

  it("returns [] when the view listing throws", async () => {
    m.listAllViewsDeep.mockRejectedValue(new Error("views fail"));
    expect(await blog.getPosts()).toEqual([]);
  });

  it("helper queries filter the same post set", async () => {
    configured([view("[Blog] Alpha Cloud", "v1"), view("[Blog] Beta Edge", "v2")]);
    expect(await blog.getPostBySlug("alpha-cloud")).toMatchObject({ title: "Alpha Cloud" });
    expect(await blog.getPostBySlug("nope")).toBeNull();
    expect(await blog.getAllSlugs()).toContain("beta-edge");
    expect(await blog.getFeaturedPosts()).toEqual([]);
    expect(await blog.getCategories()).toEqual(["Cloud"]);
    expect(await blog.getTags()).toEqual([]);
    expect((await blog.getPostsByCategory("Cloud")).length).toBe(2);
    expect(await blog.getPostsByTag("x")).toEqual([]);
    expect((await blog.searchPosts("alpha"))).toHaveLength(1);
    expect((await blog.getRelatedPosts((await blog.getPosts())[0])).length).toBe(1);
  });
});

describe("appflowy-docs", () => {
  it("parses category from [bracket] and slash naming", () => {
    expect(docs.parseAppFlowyDocCategory("[Docs][Contracts] MSA")).toEqual({
      category: "Contracts",
      title: "MSA",
    });
    expect(docs.parseAppFlowyDocCategory("[Docs] Contracts / MSA")).toEqual({
      category: "Contracts",
      title: "MSA",
    });
    expect(docs.parseAppFlowyDocCategory("[Docs] Getting started").category).toBe("General");
  });

  it("getDocs filters [Docs] pages and sorts by order then title", async () => {
    configured([
      view("[Docs] B doc", "v2"),
      view("[Docs] A doc", "v1"),
      view("[Blog] not a doc", "v3"),
    ]);
    const list = await docs.getDocs();
    expect(list.map((d) => d.title)).toEqual(["A doc", "B doc"]);
    expect(list[0].url).toBe("/appflowy/view/v1");
    expect(await docs.getDocBySlug("b-doc")).toMatchObject({ id: "v2" });
    expect((await docs.searchDocs("a doc"))[0].title).toBe("A doc");
    expect(await docs.searchDocs("  ")).toEqual([]);
    const grouped = await docs.groupDocsByCategory();
    expect(Object.keys(grouped)).toEqual(["General"]);
  });

  it("getDocs returns [] when views throw / not configured", async () => {
    m.isAppFlowyConfigured.mockResolvedValue(false);
    expect(await docs.getDocs()).toEqual([]);
    m.isAppFlowyConfigured.mockResolvedValue(true);
    m.listAllViewsDeep.mockRejectedValue(new Error("x"));
    expect(await docs.getDocs()).toEqual([]);
  });

  it("getDocContentWithToc builds a deduped toc from markdown headings", async () => {
    m.extractDocText.mockResolvedValue(
      "## Intro\n\nbody\n\n### Details *here*\n\n## Intro\n\n#### skipped\n"
    );
    const out = await docs.getDocContentWithToc("v1");
    expect(out.html).toBe("<p>x</p>");
    expect(out.toc).toEqual([
      { blockId: "intro", text: "Intro", level: 2 },
      { blockId: "details-here", text: "Details here", level: 3 },
      { blockId: "intro-2", text: "Intro", level: 2 },
    ]);
  });

  it("getDocContentWithToc returns empty when no workspace", async () => {
    m.listAllWorkspaces.mockResolvedValue([]);
    expect(await docs.getDocContentWithToc("v1")).toEqual({ html: "", toc: [] });
  });
});

describe("appflowy-case-studies", () => {
  const MD = [
    "**Slug**: acme-win",
    "**Client**: Acme",
    "**Industry**: Retail",
    "**Services**: Cloud, SEO",
    "**Tags**: a, b",
    "**Featured**: ✅",
    "**Summary**: s",
    "**Challenge**: c",
    "**Solution**: sol",
    "**Results**: r",
    "**Metric1Label**: uptime",
    "**Metric1Value**: 99.9%",
    "**Metric2Label**: cost",
    "**Metric2Value**: -40%",
    "**CoverImage**: /x.png",
    "**Date**: 2026-03-01",
  ].join("\n");

  it("maps markdown fields into a CaseStudy and sorts desc", async () => {
    configured([
      view("[CaseStudy] Acme Win", "v1", "2026-01-01"),
      view("[CaseStudy] Zeta", "v2", "2026-02-01"),
      view("Other page", "v3"),
    ]);
    m.getDocument.mockImplementation(async (_ws: string, id: string) => ({ id }));
    m.extractDocText.mockImplementation(async (doc: { id: string }) =>
      doc.id === "v1" ? MD : ""
    );
    const all = await studies.getCaseStudies();
    expect(all).toHaveLength(2);
    const acme = all.find((c) => c.slug === "acme-win")!;
    expect(acme.featured).toBe(true);
    expect(acme.services).toEqual(["Cloud", "SEO"]);
    expect(acme.metrics).toEqual([
      { label: "uptime", value: "99.9%" },
      { label: "cost", value: "-40%" },
    ]);
    expect(acme.coverImage).toBe("/x.png");
    const zeta = all.find((c) => c.id === "v2")!;
    expect(zeta.slug).toBe("zeta");
    expect(all[0].id).toBe("v1"); // **Date** field (2026-03-01) beats v2's last_edited
    expect(await studies.getFeaturedCaseStudies()).toHaveLength(1);
  });

  it("tolerates per-doc failures and outer throws", async () => {
    configured([view("[CaseStudy] X", "v1")]);
    m.getDocument.mockRejectedValue(new Error("doc"));
    const all = await studies.getCaseStudies();
    expect(all[0].slug).toBe("x");
    m.listAllViewsDeep.mockRejectedValue(new Error("views"));
    expect(await studies.getCaseStudies()).toEqual([]);
  });

  it("getCaseStudyBySlug returns the match with html, null otherwise", async () => {
    configured([view("[CaseStudy] Acme Win", "v1")]);
    m.extractDocText.mockResolvedValue(MD);
    const hit = await studies.getCaseStudyBySlug("acme-win");
    expect(hit?.html).toBe("<p>x</p>");
    expect(await studies.getCaseStudyBySlug("missing")).toBeNull();
    m.isAppFlowyConfigured.mockResolvedValue(false);
    expect(await studies.getCaseStudyBySlug("acme-win")).toBeNull();
  });

  it("admin list falls back to static when not configured or on throw", async () => {
    m.isAppFlowyConfigured.mockResolvedValue(false);
    expect(await studies.getAllCaseStudiesAdmin()).toBe(staticCaseStudies);
    m.isAppFlowyConfigured.mockResolvedValue(true);
    m.listAllViewsDeep.mockRejectedValue(new Error("views"));
    expect(await studies.getAllCaseStudiesAdmin()).toBe(staticCaseStudies);
    configured([view("[CaseStudy] Live", "v1")]);
    const live = await studies.getAllCaseStudiesAdmin();
    expect(live[0].slug).toBe("live");
  });
});

describe("appflowy-services", () => {
  const MD = [
    "**Slug**: cloud-audit",
    "**Description**: Find the waste",
    "**Price**: From €1,500",
    "**Category**: audit",
    "**Features**: feature one; feature two; feature three",
    "**CTA**: Book an audit",
    "**Icon**: 🔍",
    "**StripePriceId**: price_123",
  ].join("\n");

  it("returns [] when not configured or no workspace exists", async () => {
    m.isAppFlowyConfigured.mockResolvedValue(false);
    expect(await services.getServices()).toEqual([]);
    m.isAppFlowyConfigured.mockResolvedValue(true);
    m.listAllWorkspaces.mockResolvedValue([]);
    expect(await services.getServices()).toEqual([]);
    m.listAllWorkspaces.mockRejectedValue(new Error("ws"));
    expect(await services.getServices()).toEqual([]);
  });

  it("maps every markdown field onto the CloudlessService shape", async () => {
    configured([
      view("[Service] Cloud Audit", "v1"),
      view("[Blog] not a service", "v2"),
    ]);
    m.extractDocText.mockResolvedValue(MD);
    const all = await services.getServices();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({
      id: "v1",
      slug: "cloud-audit",
      name: "Cloud Audit",
      description: "Find the waste",
      price: "From €1,500",
      category: "audit",
      features: ["feature one", "feature two", "feature three"],
      cta: "Book an audit",
      icon: "🔍",
      stripePriceId: "price_123",
    });
  });

  it("falls back to slugified name, consulting category, and default CTA/icon", async () => {
    configured([view("[Service] Managed Edge!", "v1")]);
    const all = await services.getServices();
    expect(all[0].slug).toBe("managed-edge");
    expect(all[0].category).toBe("consulting");
    expect(all[0].cta).toBe("Contact us");
    expect(all[0].icon).toBe("⚡");
    expect(all[0].features).toEqual([]);
    expect(all[0].stripePriceId).toBeUndefined();
  });

  it("tolerates a per-doc failure and outer view-listing throws", async () => {
    configured([view("[Service] X", "v1")]);
    m.getDocument.mockRejectedValue(new Error("doc"));
    const all = await services.getServices();
    expect(all[0].name).toBe("X");
    expect(all[0].slug).toBe("x");
    m.listAllViewsDeep.mockRejectedValue(new Error("views"));
    expect(await services.getServices()).toEqual([]);
  });
});
